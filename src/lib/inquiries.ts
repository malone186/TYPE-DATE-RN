import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, ensureSignedIn } from './supabase';

// 1:1 문의 데이터 접근. 화면은 이 함수들만 쓰고 쿼리를 직접 짜지 않는다.

export type InquiryStatus = 'open' | 'answered' | 'closed';

export interface Inquiry {
  id: number;
  created_at: string;
  updated_at: string;
  subject: string;
  status: InquiryStatus;
}

export interface InquiryMessage {
  id: number;
  created_at: string;
  sender: 'user' | 'admin';
  body: string;
}

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  open: '답변 대기',
  answered: '운영자 답변',
  closed: '종료',
};

export const INQUIRY_LIMITS = {
  subject: 100,
  body: 4000,
  email: 254,
} as const;

/// DB RPC의 retry key로 사용할 UUID. 외부 라이브러리 없이 Hermes에서도 동작한다.
export function createInquiryRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function validationError(subject: string, body: string, email: string) {
  if (subject.length < 1 || subject.length > INQUIRY_LIMITS.subject) {
    return '제목은 공백을 제외하고 1~100자로 입력해 주세요.';
  }
  if (body.length < 1 || body.length > INQUIRY_LIMITS.body) {
    return '내용은 공백을 제외하고 1~4,000자로 입력해 주세요.';
  }
  if (email.length > INQUIRY_LIMITS.email) {
    return '이메일은 254자 이내로 입력해 주세요.';
  }
  return null;
}

function messageValidationError(body: string) {
  return body.length < 1 || body.length > INQUIRY_LIMITS.body
    ? '내용은 공백을 제외하고 1~4,000자로 입력해 주세요.'
    : null;
}

/// Supabase의 내부 오류·SQLSTATE를 앱에서 이해할 수 있는 안내로 바꾼다.
export function inquiryErrorMessage(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  const source = `${code} ${message}`.toLowerCase();

  if (source.includes('invalid_subject')) {
    return '제목은 공백을 제외하고 1~100자로 입력해 주세요.';
  }
  if (source.includes('invalid_body') || source.includes('body_length')) {
    return '내용은 공백을 제외하고 1~4,000자로 입력해 주세요.';
  }
  if (source.includes('invalid_email')) {
    return '이메일은 254자 이내로 입력해 주세요.';
  }
  if (source.includes('inquiry_closed')) {
    return '종료된 문의에는 메시지를 보낼 수 없습니다.';
  }
  if (source.includes('inquiry_not_found') || source.includes('pgrst116')) {
    return '문의를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.';
  }
  if (source.includes('not_admin')) {
    return '운영자 권한이 필요합니다.';
  }
  if (source.includes('not_authenticated') || source.includes('42501')) {
    return '문의 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  return '문의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

function inquiryError(error: unknown): Error {
  return new Error(inquiryErrorMessage(error));
}

/// 로그인된 클라이언트를 확보한다. 설정이 없거나 로그인 실패면 null.
async function ready() {
  if (supabase == null) throw new Error('문의 기능을 사용할 수 없습니다.');
  const uid = await ensureSignedIn();
  if (uid == null) throw new Error('문의 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return { db: supabase, uid };
}

export async function listInquiries(): Promise<Inquiry[]> {
  const s = await ready();
  const { data, error } = await s.db
    .from('inquiries')
    .select('id, created_at, updated_at, subject, status')
    .eq('user_id', s.uid)
    .order('updated_at', { ascending: false });
  if (error != null) throw inquiryError(error);
  return (data ?? []) as Inquiry[];
}

export async function getInquiry(inquiryId: number): Promise<Inquiry | null> {
  const s = await ready();
  const { data, error } = await s.db
    .from('inquiries')
    .select('id, created_at, updated_at, subject, status')
    .eq('id', inquiryId)
    .eq('user_id', s.uid)
    .maybeSingle();
  if (error != null) throw inquiryError(error);
  return data as Inquiry | null;
}

let createInFlight: Promise<number> | null = null;

export function createInquiry(
  subject: string,
  body: string,
  email = '',
  requestId = createInquiryRequestId(),
): Promise<number> {
  const cleanSubject = subject.trim();
  const cleanBody = body.trim();
  const cleanEmail = email.trim();
  const invalid = validationError(cleanSubject, cleanBody, cleanEmail);
  if (invalid != null) return Promise.reject(new Error(invalid));
  if (createInFlight != null) return createInFlight;

  const operation = (async () => {
    const s = await ready();

    let deviceId: string | null = null;
    try {
      const saved = await AsyncStorage.getItem('td_device_id');
      deviceId = saved != null && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)
        ? saved
        : null;
    } catch {
      // 문의 저장은 기기 식별자 저장소의 상태와 무관하게 진행한다.
    }

    const { data, error } = await s.db.rpc('create_inquiry', {
      p_subject: cleanSubject,
      p_body: cleanBody,
      p_email: cleanEmail === '' ? null : cleanEmail,
      p_device_id: deviceId,
      p_request_id: requestId,
    });
    if (error != null) throw inquiryError(error);
    const id = typeof data === 'number' ? data : Number(data);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('문의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return id;
  })();

  createInFlight = operation.finally(() => {
    createInFlight = null;
  });
  return createInFlight;
}

export async function listMessages(inquiryId: number): Promise<InquiryMessage[]> {
  const s = await ready();
  const { data, error } = await s.db
    .from('inquiry_messages')
    .select('id, created_at, sender, body')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });
  if (error != null) throw inquiryError(error);
  return (data ?? []) as InquiryMessage[];
}

const sendInFlight = new Map<number, Promise<void>>();

export function sendMessage(
  inquiryId: number,
  body: string,
  requestId = createInquiryRequestId(),
): Promise<void> {
  const cleanBody = body.trim();
  const invalid = messageValidationError(cleanBody);
  if (invalid != null) return Promise.reject(new Error(invalid));
  const existing = sendInFlight.get(inquiryId);
  if (existing != null) return existing;

  const operation = (async () => {
    const s = await ready();
    const { error } = await s.db.rpc('send_inquiry_message', {
      p_inquiry_id: inquiryId,
      p_body: cleanBody,
      p_request_id: requestId,
    });
    if (error != null) throw inquiryError(error);
  })();

  let tracked: Promise<void>;
  tracked = operation.finally(() => {
    if (sendInFlight.get(inquiryId) === tracked) sendInFlight.delete(inquiryId);
  });
  sendInFlight.set(inquiryId, tracked);
  return tracked;
}
