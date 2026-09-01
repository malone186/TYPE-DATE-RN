import { beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return {
    query,
    db: {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    },
    ensureSignedIn: vi.fn(async () => 'user-a'),
    getItem: vi.fn(async () => null as string | null),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: doubles.getItem },
}));

vi.mock('./supabase', () => ({
  supabase: doubles.db,
  ensureSignedIn: doubles.ensureSignedIn,
}));

import {
  createInquiry,
  getInquiry,
  listInquiries,
  listMessages,
  sendMessage,
} from './inquiries';

beforeEach(() => {
  vi.clearAllMocks();
  doubles.ensureSignedIn.mockResolvedValue('user-a');
  doubles.getItem.mockResolvedValue(null);
  doubles.db.rpc.mockResolvedValue({ data: null, error: null });
  doubles.query.select.mockReturnValue(doubles.query);
  doubles.query.eq.mockReturnValue(doubles.query);
  doubles.query.order.mockReturnValue(doubles.query);
  doubles.query.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('inquiry data layer', () => {
  it('creates an inquiry and its first message through one RPC', async () => {
    doubles.db.rpc.mockResolvedValue({ data: 42, error: null });

    await expect(createInquiry('  결제 문의  ', '  결제가 되지 않아요  ', '  help@example.com  ', 'request-1'))
      .resolves.toBe(42);

    expect(doubles.db.rpc).toHaveBeenCalledWith('create_inquiry', {
      p_subject: '결제 문의',
      p_body: '결제가 되지 않아요',
      p_email: 'help@example.com',
      p_device_id: null,
      p_request_id: 'request-1',
    });
    expect(doubles.db.from).not.toHaveBeenCalled();
  });

  it('does not leave a body-less inquiry when creation fails', async () => {
    doubles.db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'invalid_body', message: 'invalid_body' },
    });

    await expect(createInquiry('제목', '본문', '', 'request-2'))
      .rejects.toThrow('내용은 공백을 제외하고 1~4,000자로 입력해 주세요.');
    expect(doubles.db.from).not.toHaveBeenCalled();
  });

  it('validates the same limits as the database before sending', async () => {
    await expect(createInquiry(' ', '본문', '', 'request-3'))
      .rejects.toThrow('제목은 공백을 제외하고 1~100자로 입력해 주세요.');
    await expect(createInquiry('제목', 'x'.repeat(4001), '', 'request-4'))
      .rejects.toThrow('내용은 공백을 제외하고 1~4,000자로 입력해 주세요.');
    await expect(createInquiry('제목', '본문', 'x'.repeat(255), 'request-5'))
      .rejects.toThrow('이메일은 254자 이내로 입력해 주세요.');
    expect(doubles.db.rpc).not.toHaveBeenCalled();
  });

  it('reads only the fields protected by the authenticated RLS policy', async () => {
    doubles.query.order.mockResolvedValue({
      data: [{ id: 1, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', subject: '제목', status: 'open' }],
      error: null,
    });

    await expect(listInquiries()).resolves.toHaveLength(1);
    expect(doubles.db.from).toHaveBeenCalledWith('inquiries');
    expect(doubles.query.select).toHaveBeenCalledWith('id, created_at, updated_at, subject, status');
    expect(doubles.query.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(doubles.query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('loads the inquiry status before rendering a thread', async () => {
    doubles.query.maybeSingle.mockResolvedValue({
      data: { id: 9, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', subject: '제목', status: 'closed' },
      error: null,
    });

    await expect(getInquiry(9)).resolves.toMatchObject({ id: 9, status: 'closed' });
    expect(doubles.query.eq).toHaveBeenCalledWith('id', 9);
    expect(doubles.query.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });

  it('sends a user reply atomically and prevents concurrent duplicates', async () => {
    let release: (value: { data: number; error: null }) => void = () => {};
    const pending = new Promise<{ data: number; error: null }>((resolve) => { release = resolve; });
    doubles.db.rpc.mockReturnValue(pending);

    const first = sendMessage(9, '  추가 내용  ', 'reply-1');
    const second = sendMessage(9, '  추가 내용  ', 'reply-1');
    await vi.waitFor(() => expect(doubles.db.rpc).toHaveBeenCalledTimes(1));

    release({ data: 11, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(doubles.db.rpc).toHaveBeenCalledWith('send_inquiry_message', {
      p_inquiry_id: 9,
      p_body: '추가 내용',
      p_request_id: 'reply-1',
    });
  });

  it('keeps the draft retryable when a closed inquiry rejects a reply', async () => {
    doubles.db.rpc.mockResolvedValue({
      data: null,
      error: { code: 'inquiry_closed', message: 'inquiry_closed' },
    });

    await expect(sendMessage(9, '답장', 'reply-2'))
      .rejects.toThrow('종료된 문의에는 메시지를 보낼 수 없습니다.');
    expect(doubles.db.rpc).toHaveBeenCalledTimes(1);
  });

  it('reads messages through the user-scoped thread query', async () => {
    doubles.query.order.mockResolvedValue({
      data: [{ id: 1, created_at: '2026-09-01T00:00:00Z', sender: 'user', body: '본문' }],
      error: null,
    });

    await expect(listMessages(9)).resolves.toHaveLength(1);
    expect(doubles.db.from).toHaveBeenCalledWith('inquiry_messages');
    expect(doubles.query.eq).toHaveBeenCalledWith('inquiry_id', 9);
  });
});
