import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { useColors, useIsDark } from '../theme/useColors';
import { useStore, sessionCurrentTurn, sessionIsLastTurn } from '../state/store';
import { TDCharacter, Turn, Choice, ChatLine, DateResult } from '../types';
import {
  GlowBackground,
  GlassPanel,
  CharacterAvatar,
  MonologuePill,
  TurnProgressBar,
  TypingIndicator,
  SoundControlButton,
  ThemeToggleButton,
  CoralButton,
} from '../widgets/common';
import { ChoiceList } from '../widgets/ChoiceList';
import { LikeEffectOverlay } from '../widgets/LikeEffectOverlay';
import { imageSource } from '../assets/images';
import { playMessageSound, useTypingSound } from '../audio/sounds';
import { track } from '../analytics/track';

// Flutter screens/blind_date_chat_screen.dart 이식.

/// npc 대사에 들어 있는 "{name}씨" 토큰을 사용자가 입력한 이름으로 치환.
/// 이름이 비어 있으면(예외적인 경우) 중립적인 호칭으로 대체.
function applyName(text: string, userName: string): string {
  const trimmed = userName.trim();
  return text.split('{name}씨').join(trimmed.length === 0 ? '그쪽' : `${trimmed}씨`);
}

/// 메시지 길이에 비례한 "입력 중..." 표시 시간 — 카카오톡 대화창과 같은 리듬을 주기 위함.
/// 하한은 도착음(1.06초)이 연달아 겹쳐 들리지 않을 만큼 확보한다.
function typingDelayFor(text: string): number {
  return Math.max(800, Math.min(2000, 450 + text.length * 24));
}

/// 대사가 뜬 뒤 다음 줄로 넘어가기 전 유지 시간 — 대사는 짧게, 안내/독백은 조금 더 길게.
function holdMsFor(isDialogue: boolean): number {
  return isDialogue ? 700 : 900;
}

/// 선택지 표시 순서를 턴마다 무작위로 섞는다 — 데이터상 좋은 답이 앞자리에 몰려 있어도
/// 위치만으로 정답을 외울 수 없게. 라벨(A~D)은 섞인 뒤 위치 기준으로 다시 붙여
/// 점(dot) 색상 그라디언트가 항상 위에서 아래 순서를 유지하게 한다.
function shuffleChoices(choices: Choice[]): Choice[] {
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const labels = ['A', 'B', 'C', 'D'];
  return arr.map((ch, i) => ({ ...ch, label: labels[i] ?? ch.label }));
}

const NPC_RADII = {
  borderTopLeftRadius: 4,
  borderTopRightRadius: 16,
  borderBottomLeftRadius: 16,
  borderBottomRightRadius: 16,
} as const;

const PLAYER_RADII = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 4,
  borderBottomLeftRadius: 16,
  borderBottomRightRadius: 16,
} as const;

/// 소개팅 채팅 화면 — 실제 만나서 대화하는 느낌의 누적형 채팅 스레드.
/// 도입부부터 마지막 턴까지 대화가 전부 위로 계속 쌓이고, 선택지만 화면 하단에 고정된다.
export function BlindDateChatScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'BlindDateChat'>) {
  const c = useColors();
  // 이 파일 안에는 턴을 가리키는 지역 변수 t가 이미 있어 스타일은 ts로 받는다.
  const ts = useTextStyles();
  const isDark = useIsDark();

  const session = useStore((s) => s.session);
  const selectChoice = useStore((s) => s.selectChoice);
  const advanceTurn = useStore((s) => s.advanceTurn);
  const buildResult = useStore((s) => s.buildResult);
  const completeDate = useStore((s) => s.completeDate);
  const userName = useStore((s) => s.userName);
  const adRemoved = useStore((s) => s.adRemoved);

  const character = session.date.character;
  const turn = sessionCurrentTurn(session);
  const displayProgress =
    (session.currentTurnIndex + (session.choicePending ? 1 : 0)) / session.date.turns.length;

  // 진행 중 턴 상태
  const [npcMessageRevealed, setNpcMessageRevealed] = useState(false);
  const [playerPromptRevealed, setPlayerPromptRevealed] = useState(false);
  const [showEffect, setShowEffect] = useState(false);
  const [reactionTyping, setReactionTyping] = useState(false);
  const [reactionRevealed, setReactionRevealed] = useState(false);
  const [exitAsking, setExitAsking] = useState(false);

  // 도입부(도착·인사·착석) — 선택지 없이 자동으로 흘러가다가 턴1로 이어짐
  const [openingDone, setOpeningDone] = useState(false);
  const [openingTyping, setOpeningTyping] = useState(false);
  const [openingRevealCount, setOpeningRevealCount] = useState(0);

  // 마무리(클로징) — 마지막 턴 종료 후, 결과에 따라 갈리는 짧은 연출이 같은 화면에서 이어짐
  const [pendingResult, setPendingResult] = useState<DateResult | null>(null);
  const [closingLines, setClosingLines] = useState<ChatLine[]>([]);
  const [closingRevealCount, setClosingRevealCount] = useState(0);
  const [closingTyping, setClosingTyping] = useState(false);
  const [closingFinished, setClosingFinished] = useState(false);

  // 타이머 콜백 안에서 최신 값을 읽어야 하는 카운터/데이터는 ref로 미러링 (stale closure 방지)
  const openingRevealCountRef = useRef(0);
  const closingRevealCountRef = useRef(0);
  const closingLinesRef = useRef<ChatLine[]>([]);
  const pendingResultRef = useRef<DateResult | null>(null);
  const startedTurnIndexRef = useRef(-1);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);

  const getSession = () => useStore.getState().session;

  const setOpeningReveal = (n: number) => {
    openingRevealCountRef.current = n;
    setOpeningRevealCount(n);
  };
  const setClosingReveal = (n: number) => {
    closingRevealCountRef.current = n;
    setClosingRevealCount(n);
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const startNpcTyping = (npcMessage: string) => {
    typingTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      setNpcMessageRevealed(true);
      playMessageSound();
      scrollToBottom();
    }, typingDelayFor(npcMessage));
  };

  const maybeStartTurn = (turnIndex: number) => {
    if (startedTurnIndexRef.current === turnIndex) return;
    startedTurnIndexRef.current = turnIndex;
    setNpcMessageRevealed(false);
    setPlayerPromptRevealed(false);
    setShowEffect(false);
    setReactionTyping(false);
    setReactionRevealed(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    const t = getSession().date.turns[turnIndex];
    if (t.isPlayerInitiated && t.playerPrompt != null) {
      // 플레이어가 먼저 묻는 장면 — 내 질문 말풍선을 띄운 다음에야 상대가 답한다.
      typingTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        setPlayerPromptRevealed(true);
        playMessageSound();
        scrollToBottom();
        advanceTimer.current = setTimeout(() => {
          if (!mounted.current) return;
          startNpcTyping(t.npcMessage);
        }, 500);
      }, 350);
    } else {
      startNpcTyping(t.npcMessage);
    }
  };

  const onChoiceSelected = (choice: Choice) => {
    // 호감/비호감을 진동으로도 구분해준다 — 이펙트 오버레이와 같은 타이밍.
    void Haptics.notificationAsync(
      choice.likeScore > 0
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    selectChoice(choice);
    track('choice', {
      episodeId: session.date.id,
      props: { turn: turn.turnNumber, label: choice.label, likeScore: choice.likeScore },
    });
    playMessageSound();
    setShowEffect(true);
    scrollToBottom();
  };

  const onEffectFinished = () => {
    if (!mounted.current) return;
    const reactionText = getSession().lastChoice?.npcReaction ?? '';
    setShowEffect(false);
    setReactionTyping(true);
    scrollToBottom();
    advanceTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      setReactionTyping(false);
      setReactionRevealed(true);
      playMessageSound();
      scrollToBottom();
      advanceTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        const s = getSession();
        if (sessionIsLastTurn(s)) {
          const result = buildResult();
          startClosingScene(result);
        } else {
          advanceTurn();
        }
      }, 650);
    }, typingDelayFor(reactionText));
  };

  const startClosingScene = (result: DateResult) => {
    const lines = getSession().date.closingScripts[result.ending] ?? [];
    pendingResultRef.current = result;
    setPendingResult(result);
    closingLinesRef.current = lines;
    setClosingLines(lines);
    setClosingReveal(0);
    scrollToBottom();
    scheduleClosingLine();
  };

  const scheduleClosingLine = () => {
    if (closingRevealCountRef.current >= closingLinesRef.current.length) {
      setClosingFinished(true);
      scrollToBottom();
      return;
    }
    const next = closingLinesRef.current[closingRevealCountRef.current];
    const isDialogue = !next.isSystemNote && !next.isMonologue;
    // "입력 중..."은 상대(NPC) 대사에만 — 주인공(me) 대사는 짧은 딜레이 후 바로 표시
    const isNpcDialogue = isDialogue && next.sender !== 'me';
    if (isNpcDialogue) setClosingTyping(true);
    const preDelay = isNpcDialogue ? typingDelayFor(next.text) : isDialogue ? 600 : 400;
    typingTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      setClosingTyping(false);
      setClosingReveal(closingRevealCountRef.current + 1);
      if (isDialogue) playMessageSound();
      scrollToBottom();
      const holdMs = holdMsFor(isDialogue);
      advanceTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        scheduleClosingLine();
      }, holdMs);
    }, preDelay);
  };

  const scheduleOpeningLine = () => {
    const opening = getSession().date.openingScript;
    if (openingRevealCountRef.current >= opening.length) {
      advanceTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        setOpeningDone(true);
      }, 650);
      return;
    }
    const next = opening[openingRevealCountRef.current];
    const isDialogue = !next.isSystemNote && !next.isMonologue;
    // "입력 중..."은 상대(NPC) 대사에만 — 주인공(me) 대사는 짧은 딜레이 후 바로 표시
    const isNpcDialogue = isDialogue && next.sender !== 'me';
    if (isNpcDialogue) setOpeningTyping(true);
    const preDelay = isNpcDialogue ? typingDelayFor(next.text) : isDialogue ? 600 : 400;
    typingTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      setOpeningTyping(false);
      setOpeningReveal(openingRevealCountRef.current + 1);
      if (isDialogue) playMessageSound();
      scrollToBottom();
      const holdMs = holdMsFor(isDialogue);
      advanceTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        scheduleOpeningLine();
      }, holdMs);
    }, preDelay);
  };

  const goToResult = () => {
    const result = pendingResultRef.current;
    if (result == null) return;
    // 진행 저장은 광고보다 먼저 — 광고 화면에서 이탈해도 이번 회차는 완료로 남는다.
    void completeDate(result);
    // 완주 기록도 광고보다 먼저 — 광고에서 이탈해도 완주 통계는 남아야 한다.
    track('episode_complete', {
      episodeId: result.dateId,
      props: {
        ending: result.ending,
        styleType: result.styleType,
        likeScore: result.likeScore,
      },
    });
    if (adRemoved) {
      navigation.replace('ResultReport', { result });
    } else {
      navigation.replace('AdInterstitial', { result });
    }
  };

  // initState + dispose 대응
  useEffect(() => {
    mounted.current = true;
    const opening = getSession().date.openingScript;
    if (opening.length === 0) {
      setOpeningDone(true);
    } else {
      // 다음 이벤트 루프로 미뤄서 시작.
      typingTimer.current = setTimeout(scheduleOpeningLine, 0);
    }
    return () => {
      mounted.current = false;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flutter build 안의 `if (_openingDone) _maybeStartTurn(session.currentTurnIndex)` 대응.
  useEffect(() => {
    if (openingDone) {
      maybeStartTurn(session.currentTurnIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingDone, session.currentTurnIndex]);

  // 현재 턴 동안은 순서가 유지되고, 턴이 바뀔 때마다 새로 섞인다.
  const shuffledChoices = useMemo(
    () => shuffleChoices(turn.choices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.date.id, session.currentTurnIndex],
  );

  // 세션은 저장되지 않으므로 나가면 이 회차 진행이 사라진다 — 진행 중일 때만 한 번 묻는다.
  // Alert는 웹에서 동작하지 않으므로(react-native-web에서 no-op) 앱 내 모달로 확인받는다.
  const confirmExit = () => {
    const inProgress = session.currentTurnIndex > 0 || session.lastChoice != null;
    if (inProgress) {
      setExitAsking(true);
    } else {
      navigation.goBack();
    }
  };

  const opening = session.date.openingScript;
  const openingVisible = opening.slice(0, openingRevealCount);
  const showChoices =
    openingDone && npcMessageRevealed && session.lastChoice == null && !showEffect;

  return (
    <GlowBackground photoBackground photoSource={imageSource(character.backgroundPath ?? undefined)}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* 헤더 — 사진 배경 위에서도 이름·진행도·테마 버튼이 읽히도록 반불투명 바를 깐다 */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: withAlpha(c.surface, isDark ? 0.82 : 0.88),
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: withAlpha(c.border, 0.7),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={confirmExit} hitSlop={8}>
              <MaterialIcons name="arrow-back-ios" size={16} color={c.textPrimary} />
            </Pressable>
            <View style={{ width: 8 }} />
            <CharacterAvatar character={character} size={32} />
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={ts.screenTitle(c.textPrimary)}>
                {character.name}
              </Text>
              <Text numberOfLines={1} style={ts.caption(c.textSecondary)}>
                {`${character.mbti} · ${character.age}`}
              </Text>
            </View>
            {openingDone && (
              <Text style={ts.caption(c.textMuted)}>
                {`${turn.turnNumber} / ${session.date.turns.length}`}
              </Text>
            )}
            <SoundControlButton />
            <ThemeToggleButton />
          </View>
          {openingDone && (
            <>
              <View style={{ height: 10 }} />
              <TurnProgressBar progress={displayProgress} />
            </>
          )}
        </View>

        {/* 누적 대화 스레드 — 도입부 + 지금까지의 모든 턴이 계속 쌓인다 */}
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 16 }}
            onContentSizeChange={scrollToBottom}
          >
            {openingVisible.map((line, i) => (
              <OpeningLine key={`op-${i}`} character={character} line={line} userName={userName} />
            ))}
            {!openingDone && openingTyping && <TypingRow character={character} />}

            {openingDone && (
              <>
                {/* 이미 끝난 턴들 — 계속 쌓이는 대화 기록 */}
                {session.history.map((choice, i) => (
                  <CompletedTurnBlock
                    key={`turn-${i}`}
                    character={character}
                    turn={session.date.turns[i]}
                    choice={choice}
                    userName={userName}
                  />
                ))}

                {/* 진행 중인 현재 턴 */}
                {turn.isPlayerInitiated && turn.playerPrompt != null ? (
                  <>
                    {playerPromptRevealed && (
                      <>
                        <PlayerBubble text={turn.playerPrompt} />
                        <View style={{ height: 14 }} />
                      </>
                    )}
                    {playerPromptRevealed && !npcMessageRevealed && (
                      <TypingRow character={character} />
                    )}
                  </>
                ) : (
                  !npcMessageRevealed && <TypingRow character={character} />
                )}

                {npcMessageRevealed && (
                  <>
                    <NpcBubble character={character} text={applyName(turn.npcMessage, userName)} />
                    <View style={{ height: 10 }} />
                    <MonologueBubble text={turn.monologue} />
                    {session.lastChoice != null && (
                      <>
                        <View style={{ height: 18 }} />
                        <PlayerBubble text={session.lastChoice.text} />
                        {reactionTyping ? (
                          <>
                            <View style={{ height: 14 }} />
                            <TypingRow character={character} />
                          </>
                        ) : (
                          reactionRevealed && (
                            <>
                              <View style={{ height: 14 }} />
                              <NpcBubble
                                character={character}
                                text={applyName(session.lastChoice.npcReaction, userName)}
                              />
                            </>
                          )
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {pendingResult != null && (
              <>
                <View style={{ height: 18 }} />
                {closingLines.slice(0, closingRevealCount).map((line, i) => (
                  <OpeningLine
                    key={`cl-${i}`}
                    character={character}
                    line={line}
                    userName={userName}
                  />
                ))}
                {closingTyping && <TypingRow character={character} />}
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {showEffect && session.lastChoice != null && (
            <LikeEffectOverlay
              isLike={session.lastChoice.likeScore > 0}
              onFinished={onEffectFinished}
            />
          )}
        </View>

        {/* 선택지 — 화면 하단에 고정, 배경은 투명 */}
        {showChoices && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            <ChoiceList choices={shuffledChoices} selected={null} onSelect={onChoiceSelected} />
          </View>
        )}
        {closingFinished && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            <CoralButton label="결과 확인하기" onPress={goToResult} />
          </View>
        )}

        <ExitConfirmModal
          visible={exitAsking}
          onStay={() => setExitAsking(false)}
          onLeave={() => {
            setExitAsking(false);
            track('episode_quit', {
              episodeId: session.date.id,
              props: { turn: turn.turnNumber },
            });
            navigation.goBack();
          }}
        />
      </SafeAreaView>
    </GlowBackground>
  );
}

/// 소개팅 도중 나가기 확인 — 진행이 저장되지 않는다는 걸 알리고 한 번 되묻는다.
function ExitConfirmModal({
  visible,
  onStay,
  onLeave,
}: {
  visible: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  const c = useColors();
  const ts = useTextStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View
        style={{
          flex: 1,
          padding: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha('#000000', 0.45),
        }}
      >
        <GlassPanel style={{ width: '100%', maxWidth: 360 }}>
          <Text style={[ts.screenTitle(c.textPrimary), { textAlign: 'center' }]}>
            소개팅을 그만둘까요?
          </Text>
          <View style={{ height: 10 }} />
          <Text style={[ts.chatMessage(c.textSecondary), { textAlign: 'center' }]}>
            지금 나가면 이 회차 진행이 저장되지 않아요.{'\n'}처음부터 다시 해야 해요.
          </Text>
          <View style={{ height: 20 }} />
          <CoralButton label="계속하기" onPress={onStay} />
          <View style={{ height: 10 }} />
          <CoralButton label="나가기" outlined onPress={onLeave} />
        </GlassPanel>
      </View>
    </Modal>
  );
}

/// 도입부/클로징 한 줄 렌더 — 시스템 안내 / 독백 / 내 메시지 / 상대 메시지
function OpeningLine({
  character,
  line,
  userName,
}: {
  character: TDCharacter;
  line: ChatLine;
  userName: string;
}) {
  const c = useColors();
  const ts = useTextStyles();
  if (line.isSystemNote) {
    return (
      <View style={{ paddingVertical: 10, alignItems: 'center' }}>
        <Text style={[ts.caption(c.textMuted), { textAlign: 'center' }]}>
          {line.text}
        </Text>
      </View>
    );
  }
  if (line.isMonologue) {
    return (
      <View style={{ paddingVertical: 10 }}>
        <MonologueBubble text={line.text} />
      </View>
    );
  }
  if (line.sender === 'me') {
    return (
      <View style={{ marginBottom: 14 }}>
        <PlayerBubble text={line.text} />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 14 }}>
      <NpcBubble character={character} text={applyName(line.text, userName)} />
    </View>
  );
}

/// 완료된 턴 하나를 통째로 — 상대 메시지 + 독백 + 내가 보낸 메시지 + 상대 반응
function CompletedTurnBlock({
  character,
  turn,
  choice,
  userName,
}: {
  character: TDCharacter;
  turn: Turn;
  choice: Choice;
  userName: string;
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      {turn.isPlayerInitiated && turn.playerPrompt != null && (
        <>
          <PlayerBubble text={turn.playerPrompt} />
          <View style={{ height: 14 }} />
        </>
      )}
      <NpcBubble character={character} text={applyName(turn.npcMessage, userName)} />
      <View style={{ height: 10 }} />
      <MonologueBubble text={turn.monologue} />
      <View style={{ height: 14 }} />
      <PlayerBubble text={choice.text} />
      <View style={{ height: 14 }} />
      <NpcBubble character={character} text={applyName(choice.npcReaction, userName)} />
    </View>
  );
}

function TypingRow({ character }: { character: TDCharacter }) {
  const c = useColors();
  const isDark = useIsDark();
  useTypingSound();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <CharacterAvatar character={character} size={24} />
      <View style={{ width: 8 }} />
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: withAlpha(c.surface, 0.72),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: withAlpha(c.border, 0.6),
          }}
        >
          <TypingIndicator />
        </View>
      </View>
    </View>
  );
}

function NpcBubble({ character, text }: { character: TDCharacter; text: string }) {
  const c = useColors();
  const ts = useTextStyles();
  const isDark = useIsDark();
  return (
    <FadeSlideIn>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <CharacterAvatar character={character} size={24} />
        <View style={{ width: 8 }} />
        <View style={{ maxWidth: '78%', overflow: 'hidden', ...NPC_RADII }}>
          <BlurView
            intensity={24}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: withAlpha(c.surface, 0.72),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: withAlpha(c.border, 0.6),
              ...NPC_RADII,
            }}
          >
            <Text style={ts.chatMessage(c.textPrimary)}>{text}</Text>
          </View>
        </View>
      </View>
    </FadeSlideIn>
  );
}

/// 선택지를 고르면 실제로 "보낸" 내 메시지 말풍선 — 퀴즈가 아니라 대화처럼 보이게
function PlayerBubble({ text }: { text: string }) {
  const c = useColors();
  const ts = useTextStyles();
  return (
    <FadeSlideIn>
      <View style={{ alignItems: 'flex-end' }}>
        <View
          style={{
            maxWidth: '78%',
            paddingVertical: 10,
            paddingHorizontal: 14,
            backgroundColor: c.accentCoralSoft,
            ...PLAYER_RADII,
          }}
        >
          <Text style={ts.chatMessage('#FFFFFF')}>{text}</Text>
        </View>
      </View>
    </FadeSlideIn>
  );
}

/// 주인공 속마음 — 실제로 보내는 채팅과 구분되도록 이탤릭 텍스트로 은은하게.
function MonologueBubble({ text }: { text: string }) {
  return (
    <FadeSlideIn>
      <View style={{ paddingVertical: 2, paddingHorizontal: 8 }}>
        <MonologuePill text={text} />
      </View>
    </FadeSlideIn>
  );
}

function FadeSlideIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
