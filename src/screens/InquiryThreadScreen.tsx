import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground } from '../widgets/common';
import { InquiryMessage, listMessages, sendMessage } from '../lib/inquiries';

/// 문의 스레드 — 소개팅 화면과 같은 말풍선 어법으로 주고받는다.
export function InquiryThreadScreen({
  navigation, route,
}: NativeStackScreenProps<RootStackParamList, 'InquiryThread'>) {
  const c = useColors();
  const t = useTextStyles();
  const { id, subject } = route.params;

  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    setError('');
    listMessages(id)
      .then(setMessages)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // 답변이 달렸는지는 화면에 들어올 때마다 다시 읽어서 확인한다(푸시 알림이 없으므로).
  useFocusEffect(load);

  const send = async () => {
    const body = draft.trim();
    if (body === '' || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(id, body);
      setDraft('');
      const next = await listMessages(id);
      setMessages(next);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
          </Pressable>
          <Text style={[t.screenTitle(c.textPrimary), { fontSize: t.fs(17), flex: 1 }]} numberOfLines={1}>
            {subject}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {loading ? (
              <ActivityIndicator color={c.accentCoral} style={{ marginTop: 24 }} />
            ) : (
              messages.map((m) => {
                const mine = m.sender === 'user';
                return (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '84%',
                      marginTop: 10,
                    }}
                  >
                    {!mine && (
                      <Text style={[t.caption(c.textSecondary), { marginBottom: 4, marginLeft: 4 }]}>
                        운영자
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor: mine
                          ? withAlpha(c.accentCoral, 0.18)
                          : withAlpha(c.surface, 0.82),
                        borderWidth: 1,
                        borderColor: mine ? withAlpha(c.accentCoral, 0.35) : c.border,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderTopLeftRadius: mine ? 16 : 4,
                        borderTopRightRadius: mine ? 4 : 16,
                        borderBottomLeftRadius: 16,
                        borderBottomRightRadius: 16,
                      }}
                    >
                      <Text style={t.chatMessage(c.textPrimary)}>{m.body}</Text>
                    </View>
                    <Text
                      style={[
                        t.caption(c.textMuted),
                        { marginTop: 4, textAlign: mine ? 'right' : 'left' },
                      ]}
                    >
                      {m.created_at.slice(5, 16).replace('T', ' ')}
                    </Text>
                  </View>
                );
              })
            )}
            {error !== '' && (
              <Text style={[t.caption(c.accentCoral), { marginTop: 16, textAlign: 'center' }]}>
                {error}
              </Text>
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: c.border,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="답장을 입력하세요"
              placeholderTextColor={c.textMuted}
              multiline
              style={[
                t.chatMessage(c.textPrimary),
                {
                  flex: 1,
                  maxHeight: 120,
                  backgroundColor: withAlpha(c.surface, 0.72),
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: c.border,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={draft.trim() === '' || sending}
              hitSlop={8}
              style={{ padding: 10, opacity: draft.trim() === '' || sending ? 0.4 : 1 }}
            >
              <MaterialIcons name="send" size={22} color={c.accentCoral} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GlowBackground>
  );
}
