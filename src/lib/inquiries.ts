import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, ensureSignedIn } from './supabase';

// 1:1 문의 데이터 접근. 화면은 이 함수들만 쓰고 쿼리를 직접 짜지 않는다.

export interface Inquiry {
  id: number;
  created_at: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
}

export interface InquiryMessage {
  id: number;
  created_at: string;
  sender: 'user' | 'admin';
  body: string;
}

export const STATUS_LABEL: Record<Inquiry['status'], string> = {
  open: '접수됨',
  answered: '답변 완료',
  closed: '종료',
};

/// 로그인된 클라이언트를 확보한다. 설정이 없거나 로그인 실패면 null.
async function ready() {
  if (supabase == null) return null;
  const uid = await ensureSignedIn();
  return uid == null ? null : { db: supabase, uid };
}

export async function listInquiries(): Promise<Inquiry[]> {
  const s = await ready();
  if (s == null) return [];
  const { data, error } = await s.db
    .from('inquiries')
    .select('id, created_at, subject, status')
    .order('created_at', { ascending: false });
  if (error != null) throw new Error(error.message);
  return (data ?? []) as Inquiry[];
}

export async function createInquiry(subject: string, body: string, email: string) {
  const s = await ready();
  if (s == null) throw new Error('문의 기능을 사용할 수 없습니다.');

  const deviceId = await AsyncStorage.getItem('td_device_id');
  const { data, error } = await s.db
    .from('inquiries')
    .insert({
      user_id: s.uid,
      device_id: deviceId,
      email: email.trim() === '' ? null : email.trim(),
      subject,
    })
    .select('id')
    .single();
  if (error != null) throw new Error(error.message);

  // 첫 메시지가 곧 문의 본문이다.
  const { error: msgError } = await s.db
    .from('inquiry_messages')
    .insert({ inquiry_id: data.id, sender: 'user', body });
  if (msgError != null) throw new Error(msgError.message);

  return data.id as number;
}

export async function listMessages(inquiryId: number): Promise<InquiryMessage[]> {
  const s = await ready();
  if (s == null) return [];
  const { data, error } = await s.db
    .from('inquiry_messages')
    .select('id, created_at, sender, body')
    .eq('inquiry_id', inquiryId)
    .order('created_at');
  if (error != null) throw new Error(error.message);
  return (data ?? []) as InquiryMessage[];
}

export async function sendMessage(inquiryId: number, body: string) {
  const s = await ready();
  if (s == null) throw new Error('문의 기능을 사용할 수 없습니다.');
  const { error } = await s.db
    .from('inquiry_messages')
    .insert({ inquiry_id: inquiryId, sender: 'user', body });
  if (error != null) throw new Error(error.message);
}
