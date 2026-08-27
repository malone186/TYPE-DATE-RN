import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { GlowBackground, GlassPanel, CoralButton } from '../widgets/common';
import { SettingsButton } from '../widgets/SettingsSheet';
import { KakaoChatView } from '../widgets/KakaoChatView';
import { useStore } from '../state/store';
import { lineData, lineForDateId, epilogueLinesByDateId, episode1 } from '../data';
import { TDCharacter } from '../types';

// Flutter screens/epilogue_screen.dart 이식.
// Scene 1(알림) → Scene 2(민준 카톡) → Scene 3(다음 화 예고)
type Step = 'notification' | 'minjun' | 'teaser';

export function EpilogueScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Epilogue'>) {
  const { result } = route.params;
  const [step, setStep] = useState<Step>('notification');
  const isCompleted = useStore((s) => s.isCompleted);
  useStore((s) => s.completedIds);

  const line = lineData(lineForDateId(result.dateId));
  const { episodes } = line;
  const completedCount = episodes.filter((e) => isCompleted(e.id)).length;
  // 16명 전부 완료 → 다음 화 예고 대신 최종 에필로그(최고 매칭 상대와의 엔딩)로 넘어간다.
  const allDone = completedCount >= episodes.length;

  const episodeIndex = episodes.findIndex((e) => e.id === result.dateId);
  const nextEpisode =
    episodeIndex >= 0 && episodeIndex + 1 < episodes.length ? episodes[episodeIndex + 1] : null;

  const goToList = () =>
    navigation.reset({ index: 0, routes: [{ name: 'CharacterSelect' }] });

  if (step === 'notification') {
    return <NotificationScene completedCount={completedCount} onNext={() => setStep('minjun')} />;
  }
  if (step === 'minjun') {
    return (
      <KakaoChatView
        contactName={line.prologueContact}
        lines={epilogueLinesByDateId[result.dateId] ?? epilogueLinesByDateId[episode1.id]}
        completeButtonLabel={allDone ? '마지막 이야기 보기' : '다음 화 예고 보기'}
        onComplete={() => {
          if (allDone) {
            navigation.replace('FinalEpilogue');
          } else {
            setStep('teaser');
          }
        }}
      />
    );
  }
  return (
    <TeaserScene episodeNumber={episodeIndex + 2} nextCharacter={nextEpisode?.character ?? null} onNext={goToList} />
  );
}

function NotificationScene({ completedCount, onNext }: { completedCount: number; onNext: () => void }) {
  const c = useColors();
  const t = useTextStyles();
  const remaining = 16 - completedCount;
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SettingsButton />
          </View>
          <GlassPanel style={{ width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>💘</Text>
              <View style={{ height: 8 }} />
              <Text style={t.screenTitle(c.textPrimary)}>{completedCount}/16 완료</Text>
              <View style={{ height: 16 }} />
              <Text style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}>
                {remaining > 0
                  ? `이번 만남이 끝났어요.\n${remaining}명이 더 기다리고 있어요.\n\n진짜 인연은 아직 시작도 안 했을 수 있어요 👀`
                  : '열여섯 번의 만남이 전부 끝났어요.\n\n그런데, 이 이야기의 진짜 마지막은\n지금부터예요.'}
              </Text>
            </View>
          </GlassPanel>
          <View style={{ height: 32 }} />
          <CoralButton label="계속" onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function TeaserScene({
  episodeNumber,
  nextCharacter,
  onNext,
}: {
  episodeNumber: number;
  nextCharacter: TDCharacter | null;
  onNext: () => void;
}) {
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
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>💘</Text>
                <View style={{ width: 8 }} />
                <Text style={t.screenTitle(c.textPrimary)}>다음 인연</Text>
              </View>
              <View style={{ height: 20 }} />
              <Text style={[t.choiceButton(c.accentLavenderDeep), { fontFamily: 'Pretendard-Bold' }]}>
                {nextCharacter != null ? `${episodeNumber}화 — ${nextCharacter.mbti} ???` : `${episodeNumber}화 — ????`}
              </Text>
              <View style={{ height: 8 }} />
              <Text style={t.chatMessage(c.textPrimary)}>
                {nextCharacter != null ? `"${nextCharacter.intro}"` : '다음 인연을 준비 중이에요.'}
              </Text>
              <View style={{ height: 16 }} />
              <Text style={t.caption(c.textSecondary)}>
                {nextCharacter != null
                  ? '이 사람이 진짜 인연일까요? 캐릭터 목록에서 해금됐어요.'
                  : '업데이트를 기다려주세요!'}
              </Text>
            </View>
          </GlassPanel>
          <View style={{ height: 32 }} />
          <CoralButton label="캐릭터 목록으로" onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
