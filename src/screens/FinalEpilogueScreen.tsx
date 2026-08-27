import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { GlowBackground, GlassPanel, CoralButton, CharacterAvatar } from '../widgets/common';
import { SettingsButton } from '../widgets/SettingsSheet';
import { KakaoChatView } from '../widgets/KakaoChatView';
import { useStore } from '../state/store';
import { lineData } from '../data';
import {
  pickBestMatch,
  buildFinalEpilogueLines,
  finalEndingFor,
  isNoMatch,
  noMatchEndingFor,
  FinalMatch,
} from '../data/finalEpilogue';
import { NoMatchEnding } from '../data/finalEndings';

// 16화 완주 후 최종 에필로그 — 최고 매칭 상대와 연애를 시작하는 엔딩 시퀀스.
// Scene 1(발표 카드) → Scene 2(상대의 고백 카톡) → Scene 3(연애 시작 카드)
// 열여섯 명 전부와 fail로 끝났으면 상대 대신 주선자 친구와의 마무리 엔딩으로 갈린다.
type Step = 'reveal' | 'chat' | 'ending';

export function FinalEpilogueScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FinalEpilogue'>) {
  const [step, setStep] = useState<Step>('reveal');
  const line = useStore((s) => s.line);
  const results = useStore((s) => s.results);
  const userName = useStore((s) => s.userName);

  const { episodes } = lineData(line);
  const match = useMemo(() => pickBestMatch(episodes, results), [episodes, results]);

  const goToList = () =>
    navigation.reset({ index: 0, routes: [{ name: 'CharacterSelect' }] });

  // 결과가 하나도 저장돼 있지 않으면(이론상 도달 불가) 목록으로 되돌린다.
  if (match == null) {
    return <RevealScene match={null} noMatch={null} onNext={goToList} />;
  }

  const noMatch = isNoMatch(match) ? noMatchEndingFor(match) : null;

  if (step === 'reveal') {
    return <RevealScene match={match} noMatch={noMatch} onNext={() => setStep('chat')} />;
  }
  if (step === 'chat') {
    return (
      <KakaoChatView
        contactName={noMatch != null ? noMatch.contactName : match.episode.character.name}
        // 노매치 엔딩은 상대가 주선자 친구라 캐릭터 데이터가 없다 — 그때는 첫 글자 아바타 유지
        avatarCharacter={noMatch != null ? null : match.episode.character}
        lines={buildFinalEpilogueLines(match, userName)}
        completeButtonLabel="계속"
        onComplete={() => setStep('ending')}
      />
    );
  }
  if (noMatch != null) {
    return <NoMatchEndingScene ending={noMatch} onNext={goToList} />;
  }
  return <EndingScene match={match} onNext={goToList} />;
}

/// Scene 1 — 16번의 만남이 끝났고, 가장 오래 남은 한 사람을 공개하는 카드.
function RevealScene({
  match,
  noMatch,
  onNext,
}: {
  match: FinalMatch | null;
  noMatch: NoMatchEnding | null;
  onNext: () => void;
}) {
  const c = useColors();
  const t = useTextStyles();
  const partner = match?.episode.character;
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SettingsButton />
          </View>
          <GlassPanel style={{ width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>{noMatch != null ? '🌙' : '💘'}</Text>
              <View style={{ height: 8 }} />
              <Text style={t.screenTitle(c.textPrimary)}>16 / 16 완료</Text>
              <View style={{ height: 16 }} />
              {noMatch != null ? (
                <Text
                  style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}
                >
                  {noMatch.revealText}
                </Text>
              ) : partner != null ? (
                <Text
                  style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}
                >
                  열여섯 번의 소개팅이 모두 끝났어요.{'\n'}
                  유형 분석도, 궁합 리포트도 다 나왔지만{'\n'}
                  그것보다 확실한 게 하나 있었어요.{'\n'}{'\n'}
                  가장 오래 마음에 남은 사람 — {partner.name}
                </Text>
              ) : (
                <Text
                  style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}
                >
                  저장된 결과가 없어요.{'\n'}소개팅을 먼저 진행해주세요.
                </Text>
              )}
            </View>
          </GlassPanel>
          <View style={{ height: 32 }} />
          <CoralButton label={partner != null ? '그 밤의 이야기' : '목록으로'} onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

/// Scene 3(전원 fail) — 남은 상대가 없는 마무리 카드.
function NoMatchEndingScene({ ending, onNext }: { ending: NoMatchEnding; onNext: () => void }) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SettingsButton />
          </View>
          <GlassPanel style={{ width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🌙</Text>
              <View style={{ height: 12 }} />
              <Text style={t.screenTitle(c.textPrimary)}>{ending.endingTitle}</Text>
              <View style={{ height: 16 }} />
              <Text style={[t.caption(c.textMuted), { textAlign: 'center' }]}>
                {ending.endingCaption}
              </Text>
            </View>
          </GlassPanel>
          <View style={{ height: 32 }} />
          <CoralButton label="처음 목록으로" onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

/// Scene 3 — 연애 시작 카드. 상대 정보와 함께 여정의 마침표를 찍는다.
function EndingScene({ match, onNext }: { match: FinalMatch; onNext: () => void }) {
  const c = useColors();
  const t = useTextStyles();
  const partner = match.episode.character;
  const style = match.episode.styleInfo[match.result.styleType];
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SettingsButton />
          </View>
          <GlassPanel style={{ width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <CharacterAvatar character={partner} size={72} />
              <View style={{ height: 12 }} />
              <Text style={t.screenTitle(c.textPrimary)}>연애 시작</Text>
              <View style={{ height: 6 }} />
              <Text style={t.chatMessage(c.accentLavenderDeep)}>
                {`${partner.name} · ${partner.mbti}`}
              </Text>
              <View style={{ height: 4 }} />
              <Text style={t.caption(c.textSecondary)}>{partner.job}</Text>
              {style != null && (
                <>
                  <View style={{ height: 16 }} />
                  <Text
                    style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}
                  >
                    {style.compatibilityComment}
                  </Text>
                </>
              )}
              <View style={{ height: 16 }} />
              <Text style={[t.caption(c.textMuted), { textAlign: 'center' }]}>
                {finalEndingFor(match).endingCaption}
              </Text>
            </View>
          </GlassPanel>
          <View style={{ height: 32 }} />
          <CoralButton label="처음 목록으로" onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
