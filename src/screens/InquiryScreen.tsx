import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground, CoralButton } from '../widgets/common';
import { supabaseReady } from '../lib/supabase';
import {
  createInquiry,
  createInquiryRequestId,
  INQUIRY_LIMITS,
  Inquiry,
  STATUS_LABEL,
  listInquiries,
} from '../lib/inquiries';

function formatInquiryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('ko-KR');
}

/// 내 문의 목록 + 새 문의 작성. 가입 절차 없이 익명 계정에 스레드가 묶인다.
export function InquiryScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Inquiry'>) {
  const c = useColors();
  const t = useTextStyles();

  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [writing, setWriting] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const createRequestId = useRef(createInquiryRequestId());
  const createDraftKey = useRef<string | null>(null);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    listInquiries()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 스레드에서 돌아왔을 때 상태(답변 완료 등)가 바로 반영되도록 매번 다시 읽는다.
  useFocusEffect(load);

  const submit = async () => {
    const cleanSubject = subject.trim();
    const cleanBody = body.trim();
    const cleanEmail = email.trim();
    if (sending) return;
    if (cleanSubject.length < 1 || cleanSubject.length > INQUIRY_LIMITS.subject) {
      setError('제목은 공백을 제외하고 1~100자로 입력해 주세요.');
      return;
    }
    if (cleanBody.length < 1 || cleanBody.length > INQUIRY_LIMITS.body) {
      setError('내용은 공백을 제외하고 1~4,000자로 입력해 주세요.');
      return;
    }
    if (cleanEmail.length > INQUIRY_LIMITS.email) {
      setError('이메일은 254자 이내로 입력해 주세요.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const draftKey = `${cleanSubject}\u0000${cleanBody}\u0000${cleanEmail}`;
      if (createDraftKey.current !== draftKey) {
        createDraftKey.current = draftKey;
        createRequestId.current = createInquiryRequestId();
      }
      const id = await createInquiry(cleanSubject, cleanBody, cleanEmail, createRequestId.current);
      setWriting(false);
      setSubject('');
      setBody('');
      setEmail('');
      createDraftKey.current = null;
      createRequestId.current = createInquiryRequestId();
      navigation.navigate('InquiryThread', { id, subject: cleanSubject, status: 'open' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const inputStyle = [
    t.chatMessage(c.textPrimary),
    {
      backgroundColor: withAlpha(c.surface, 0.72),
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
  ];

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, height: 48 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
          </Pressable>
          <Text style={[t.screenTitle(c.textPrimary), { fontSize: t.fs(18) }]}>1:1 문의</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          {!supabaseReady ? (
            <Text style={[t.caption(c.textSecondary), { marginTop: 40, textAlign: 'center' }]}>
              문의 기능이 설정되지 않았습니다.
            </Text>
          ) : writing ? (
            <>
              <View style={{ height: 12 }} />
              <Text style={t.caption(c.textSecondary)}>제목</Text>
              <View style={{ height: 6 }} />
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="어떤 점이 궁금하신가요?"
                placeholderTextColor={c.textMuted}
                editable={!sending}
                maxLength={INQUIRY_LIMITS.subject}
                style={inputStyle}
              />
              <Text style={[t.caption(c.textMuted), { marginTop: 4, textAlign: 'right' }]}>
                {subject.trim().length}/{INQUIRY_LIMITS.subject}
              </Text>
              <View style={{ height: 16 }} />
              <Text style={t.caption(c.textSecondary)}>내용</Text>
              <View style={{ height: 6 }} />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="자세히 적어주시면 더 빨리 도와드릴 수 있어요."
                placeholderTextColor={c.textMuted}
                multiline
                editable={!sending}
                maxLength={INQUIRY_LIMITS.body}
                style={[...inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
              />
              <Text style={[t.caption(c.textMuted), { marginTop: 4, textAlign: 'right' }]}>
                {body.trim().length}/{INQUIRY_LIMITS.body}
              </Text>
              <View style={{ height: 16 }} />
              <Text style={t.caption(c.textSecondary)}>이메일 (선택)</Text>
              <Text style={[t.caption(c.textMuted), { marginTop: 4 }]}>필요한 경우 운영팀이 연락드릴 이메일</Text>
              <View style={{ height: 6 }} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="연락받을 이메일을 입력하세요"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!sending}
                maxLength={INQUIRY_LIMITS.email}
                style={inputStyle}
              />
              {error !== '' && (
                <Text style={[t.caption(c.accentCoral), { marginTop: 12 }]}>{error}</Text>
              )}
              <View style={{ height: 24 }} />
              <CoralButton
                label={sending ? '보내는 중…' : '문의 보내기'}
                onPress={submit}
                disabled={
                  subject.trim() === '' ||
                  subject.trim().length > INQUIRY_LIMITS.subject ||
                  body.trim() === '' ||
                  body.trim().length > INQUIRY_LIMITS.body ||
                  email.trim().length > INQUIRY_LIMITS.email ||
                  sending
                }
              />
              <View style={{ height: 12 }} />
              <Pressable onPress={() => setWriting(false)} style={{ padding: 12 }}>
                <Text style={[t.caption(c.textSecondary), { textAlign: 'center' }]}>취소</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ height: 12 }} />
              <CoralButton label="새 문의 하기" onPress={() => setWriting(true)} />
              <View style={{ height: 20 }} />

              {loading ? (
                <ActivityIndicator color={c.accentCoral} style={{ marginTop: 24 }} />
              ) : error !== '' ? (
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                  <Text style={[t.caption(c.accentCoral), { textAlign: 'center' }]}>{error}</Text>
                  <Pressable onPress={load} style={{ padding: 12 }}>
                    <Text style={t.caption(c.textPrimary)}>다시 시도</Text>
                  </Pressable>
                </View>
              ) : items.length === 0 ? (
                <Text style={[t.caption(c.textSecondary), { textAlign: 'center', marginTop: 24 }]}>
                  아직 보낸 문의가 없습니다.
                </Text>
              ) : (
                items.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() =>
                      navigation.navigate('InquiryThread', {
                        id: it.id,
                        subject: it.subject,
                        status: it.status,
                      })
                    }
                    style={{
                      backgroundColor: withAlpha(c.surface, 0.72),
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                      padding: 16,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={t.chatMessage(c.textPrimary)} numberOfLines={1}>
                      {it.subject}
                    </Text>
                    <View style={{ height: 6 }} />
                    <Text style={t.caption(c.textSecondary)}>
                      최근 활동 {formatInquiryDate(it.updated_at)} · {STATUS_LABEL[it.status]}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GlowBackground>
  );
}
