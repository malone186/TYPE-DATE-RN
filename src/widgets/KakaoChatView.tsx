import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { TypeDateTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { useColors, useIsDark } from '../theme/useColors';
import { ChatLine, TDCharacter } from '../types';
import { GlowBackground, MonologuePill, SoundControlButton, ThemeToggleButton, TypingIndicator, CoralButton, CharacterAvatar } from './common';
import { playMessageSound, useTypingSound } from '../audio/sounds';

// Flutter widgets/kakao_chat_view.dart 이식.
// 프롤로그/에필로그용 카카오톡 모방 채팅 뷰. 기본 자동 진행, "건너뛰기" 누르면 탭 진행 모드.

/// 실제 주고받는 말풍선인지 — 시스템 안내/독백에는 도착음을 울리지 않는다.
const isDialogue = (line: ChatLine) => !line.isSystemNote && !line.isMonologue;

export function KakaoChatView({
  contactName,
  lines,
  onComplete,
  completeButtonLabel,
  onBack,
  avatarCharacter,
}: {
  contactName: string;
  lines: ChatLine[];
  onComplete: () => void;
  completeButtonLabel?: string | null;
  onBack?: () => void;
  avatarCharacter?: TDCharacter | null; // 넘기면 상대 아바타를 프로필 사진으로, 없으면 이름 첫 글자
}) {
  const c = useColors();
  const isDark = useIsDark();
  const [visibleCount, setVisibleCount] = useState(1);
  const [typing, setTyping] = useState(false);
  const [skipMode, setSkipMode] = useState(false);
  const [finished, setFinished] = useState(false);

  const visibleRef = useRef(1);
  const skipRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const setVisible = (n: number) => {
    visibleRef.current = n;
    setVisibleCount(n);
  };

  const npcInitial = (() => {
    for (const line of lines) {
      if (!line.isSystemNote && line.sender !== 'me') {
        return line.sender.length > 0 ? line.sender.substring(0, 1) : '?';
      }
    }
    return contactName.substring(0, 1);
  })();

  // 대사 표시 후 다음 대사까지 유지하는 시간.
  // 하한은 도착음(1.06초)이 다음 도착음과 겹치지 않을 만큼 확보한다.
  const delayFor = (line: ChatLine): number => {
    if (line.isSystemNote) return 1200;
    return Math.max(700, Math.min(1800, 420 + line.text.length * 22));
  };

  const nextIsNpcMessage = (): boolean => {
    if (visibleRef.current >= lines.length) return false;
    const next = lines[visibleRef.current];
    return !next.isSystemNote && next.sender !== 'me';
  };
  const nextIsMyMessage = (): boolean => {
    if (visibleRef.current >= lines.length) return false;
    const next = lines[visibleRef.current];
    return !next.isSystemNote && next.sender === 'me';
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const scheduleNext = () => {
    if (visibleRef.current >= lines.length) {
      if (completeButtonLabel != null) {
        setFinished(true);
      } else {
        timer.current = setTimeout(onComplete, 900);
      }
      return;
    }

    let preDelay: number;
    if (nextIsNpcMessage()) {
      setTyping(true);
      preDelay = 700;
    } else if (nextIsMyMessage()) {
      preDelay = 550;
    } else {
      preDelay = 400;
    }

    timer.current = setTimeout(() => {
      const line = lines[visibleRef.current];
      setTyping(false);
      setVisible(visibleRef.current + 1);
      if (isDialogue(line)) playMessageSound();
      scrollToBottom();
      timer.current = setTimeout(() => scheduleNext(), delayFor(line));
    }, preDelay);
  };

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enableSkipMode = () => {
    if (timer.current) clearTimeout(timer.current);
    skipRef.current = true;
    setSkipMode(true);
    setTyping(false);
  };

  const advanceOnTap = () => {
    if (!skipRef.current) return;
    if (visibleRef.current >= lines.length) {
      if (completeButtonLabel != null) {
        setFinished(true);
      } else {
        onComplete();
      }
      return;
    }
    // 건너뛰기 모드에서는 대사가 연타로 넘어가므로 도착음을 울리지 않는다.
    setVisible(visibleRef.current + 1);
    scrollToBottom();
  };

  const visibleLines = lines.slice(0, visibleCount);

  return (
    <GlowBackground showLogoWatermark>
      <SafeAreaView style={{ flex: 1 }}>
        {/* 헤더 — 배경 위에서도 이름·버튼이 읽히도록 반불투명 바를 깐다 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: withAlpha(c.surface, isDark ? 0.82 : 0.88),
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: withAlpha(c.border, 0.7),
          }}
        >
          {onBack && (
            <>
              <Pressable onPress={onBack} hitSlop={8}>
                <MaterialIcons name="arrow-back-ios" size={16} color={c.textPrimary} />
              </Pressable>
              <View style={{ width: 12 }} />
            </>
          )}
          <Text style={TypeDateTextStyles.screenTitle(c.textPrimary)}>{contactName}</Text>
          <View style={{ flex: 1 }} />
          {!skipMode ? (
            <Pressable
              onPress={enableSkipMode}
              hitSlop={4}
              style={({ pressed }) => ({
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: withAlpha(c.accentCoral, pressed ? 0.9 : 0.6),
                backgroundColor: withAlpha(c.surface, pressed ? 0.9 : 0.7),
              })}
            >
              <Text style={TypeDateTextStyles.caption(c.accentCoral)}>건너뛰기 ⏭</Text>
            </Pressable>
          ) : (
            <View style={{ paddingHorizontal: 8 }}>
              <Text style={TypeDateTextStyles.caption(c.textMuted)}>탭해서 계속</Text>
            </View>
          )}
          <SoundControlButton />
          <ThemeToggleButton />
        </View>

        <Pressable style={{ flex: 1 }} onPress={skipMode ? advanceOnTap : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
            onContentSizeChange={scrollToBottom}
          >
            {visibleLines.map((line, i) => (
              <ChatLineWidget key={i} line={line} avatarCharacter={avatarCharacter} />
            ))}
            {typing && (
              <View style={{ paddingVertical: 4 }}>
                <TypingBubble senderInitial={npcInitial} avatarCharacter={avatarCharacter} />
              </View>
            )}
          </ScrollView>
        </Pressable>

        {completeButtonLabel != null && finished && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            <CoralButton label={completeButtonLabel} onPress={onComplete} />
          </View>
        )}
      </SafeAreaView>
    </GlowBackground>
  );
}

/// 상대 아바타 — 캐릭터가 있으면 얼굴 사진, 없으면 이름 첫 글자 동그라미.
function NpcAvatar({
  avatarCharacter,
  initial,
}: {
  avatarCharacter?: TDCharacter | null;
  initial: string;
}) {
  const c = useColors();
  if (avatarCharacter != null) {
    return <CharacterAvatar character={avatarCharacter} size={24} useFace />;
  }
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.accentCoralSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 11, color: '#FFFFFF' }}>{initial}</Text>
    </View>
  );
}

function TypingBubble({
  senderInitial,
  avatarCharacter,
}: {
  senderInitial: string;
  avatarCharacter?: TDCharacter | null;
}) {
  const c = useColors();
  useTypingSound();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <NpcAvatar avatarCharacter={avatarCharacter} initial={senderInitial} />
      <View style={{ width: 8 }} />
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: withAlpha(c.surface, 0.8),
          borderWidth: 0.5,
          borderColor: withAlpha(c.border, 0.6),
        }}
      >
        <TypingIndicator />
      </View>
    </View>
  );
}

function ChatLineWidget({
  line,
  avatarCharacter,
}: {
  line: ChatLine;
  avatarCharacter?: TDCharacter | null;
}) {
  const c = useColors();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []);

  if (line.isSystemNote) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <MonologuePill text={`— ${line.text} —`} muted />
      </View>
    );
  }
  if (line.isMonologue) {
    return (
      <View style={{ paddingVertical: 12 }}>
        <MonologuePill text={line.text} />
      </View>
    );
  }

  const isMe = line.sender === 'me';
  const bubbleColor = isMe ? c.accentCoralSoft : withAlpha(c.surface, 0.8);
  const textColor = isMe ? '#FFFFFF' : c.textPrimary;
  const radius = isMe
    ? { borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }
    : { borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 };

  return (
    <View style={{ paddingVertical: 4, flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
      {!isMe && (
        <>
          <NpcAvatar
            avatarCharacter={avatarCharacter}
            initial={line.sender.length > 0 ? line.sender.substring(0, 1) : '?'}
          />
          <View style={{ width: 8 }} />
        </>
      )}
      <Animated.View
        style={{
          maxWidth: '78%',
          opacity: fade,
          transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: bubbleColor,
          borderWidth: isMe ? 0 : 0.5,
          borderColor: isMe ? undefined : withAlpha(c.border, 0.6),
          ...radius,
        }}
      >
        <Text style={TypeDateTextStyles.chatMessage(textColor)}>{line.text}</Text>
      </Animated.View>
    </View>
  );
}
