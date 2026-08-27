import React, { useCallback, useState } from 'react';
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
import { Inquiry, STATUS_LABEL, listInquiries, createInquiry } from '../lib/inquiries';

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
    if (subject.trim() === '' || body.trim() === '' || sending) return;
    setSending(true);
    setError('');
    try {
      const id = await createInquiry(subject.trim(), body.trim(), email);
      setWriting(false);
      setSubject('');
      setBody('');
      setEmail('');
      navigation.navigate('InquiryThread', { id, subject: subject.trim() });
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
                style={inputStyle}
              />
              <View style={{ height: 16 }} />
              <Text style={t.caption(c.textSecondary)}>내용</Text>
              <View style={{ height: 6 }} />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="자세히 적어주시면 더 빨리 도와드릴 수 있어요."
                placeholderTextColor={c.textMuted}
                multiline
                style={[...inputStyle, { minHeight: 140, textAlignVertical: 'top' }]}
              />
              <View style={{ height: 16 }} />
              <Text style={t.caption(c.textSecondary)}>이메일 (선택)</Text>
              <View style={{ height: 6 }} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="앱을 지워도 답변을 받으시려면 입력하세요"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={inputStyle}
              />
              {error !== '' && (
                <Text style={[t.caption(c.accentCoral), { marginTop: 12 }]}>{error}</Text>
              )}
              <View style={{ height: 24 }} />
              <CoralButton
                label={sending ? '보내는 중…' : '문의 보내기'}
                onPress={submit}
                disabled={subject.trim() === '' || body.trim() === '' || sending}
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
                <Text style={[t.caption(c.accentCoral), { textAlign: 'center', marginTop: 24 }]}>
                  {error}
                </Text>
              ) : items.length === 0 ? (
                <Text style={[t.caption(c.textSecondary), { textAlign: 'center', marginTop: 24 }]}>
                  아직 보낸 문의가 없습니다.
                </Text>
              ) : (
                items.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() =>
                      navigation.navigate('InquiryThread', { id: it.id, subject: it.subject })
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
                      {it.created_at.slice(0, 10)} · {STATUS_LABEL[it.status]}
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
