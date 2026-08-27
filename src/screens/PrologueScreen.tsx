import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { GlowBackground, GlassPanel, MonologuePill, CoralButton } from '../widgets/common';
import { KakaoChatView } from '../widgets/KakaoChatView';
import { SettingsButton } from '../widgets/SettingsSheet';
import { lineData } from '../data';
import { useStore } from '../state/store';
import { TDCharacter } from '../types';
import { logoImage } from '../assets/images';

// Flutter screens/prologue_screen.dart 이식.
// Scene 1(민준) → Scene 2(온보딩) → Scene 3(배정 카드)
type Step = 'minjun' | 'onboarding' | 'assignment';

export function PrologueScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Prologue'>) {
  const [step, setStep] = useState<Step>('minjun');
  const line = useStore((s) => s.line);
  const data = lineData(line);

  const goToProfile = () => {
    // 스택을 [CharacterSelect, CharacterProfile(1화 상대)]로 리셋해 뒤로가기 시 목록으로.
    navigation.reset({
      index: 1,
      routes: [
        { name: 'CharacterSelect' },
        { name: 'CharacterProfile', params: { characterId: data.firstEpisode.character.id } },
      ],
    });
  };

  if (step === 'minjun') {
    return (
      <KakaoChatView
        contactName={data.prologueContact}
        lines={data.prologueLines}
        completeButtonLabel="다음"
        onComplete={() => setStep('onboarding')}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
    );
  }
  if (step === 'onboarding') {
    return <OnboardingScene onNext={() => setStep('assignment')} />;
  }
  return <AssignmentScene character={data.firstEpisode.character} onNext={goToProfile} />;
}

function OnboardingScene({ onNext }: { onNext: () => void }) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SettingsButton />
          </View>
          <View style={{ flex: 2 }} />
          <Image source={logoImage} style={{ width: 100, height: 100, alignSelf: 'center' }} resizeMode="contain" />
          <View style={{ height: 32 }} />
          <Text style={[t.screenTitle(c.textPrimary), { textAlign: 'center' }]}>
            "당신의 진짜 인연을 찾아드립니다"
          </Text>
          <View style={{ height: 16 }} />
          <Text style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}>
            16가지 유형의 상대를 만나보세요.{'\n'}16번의 만남이 끝날 때,{'\n'}당신이 진짜 설레는 인연 유형이 밝혀집니다.
          </Text>
          <View style={{ height: 28 }} />
          <MonologuePill text="...혹시 진짜 있긴 한 건가." />
          <View style={{ flex: 3 }} />
          <CoralButton label="시작하기" onPress={onNext} />
          <View style={{ height: 32 }} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function AssignmentScene({ character, onNext }: { character: TDCharacter; onNext: () => void }) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 24, height: 48 }}>
          <SettingsButton />
        </View>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <GlassPanel style={{ width: '100%' }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22 }}>💘</Text>
                <View style={{ width: 8 }} />
                <Text style={t.screenTitle(c.textPrimary)}>첫 번째 인연</Text>
              </View>
              <View style={{ height: 20 }} />
              <InfoRow label="상대" value={`${character.name} (${character.age}세)`} />
              <InfoRow label="직업" value={character.job} />
              <InfoRow label="지역" value={character.location} />
              <InfoRow label="MBTI" value={character.mbti} />
              <View style={{ height: 16 }} />
              <Text style={t.chatMessage(c.textSecondary)}>
                "이 사람이 당신의 인연일까요?"
              </Text>
            </View>
          </GlassPanel>
          <View style={{ height: 16 }} />
          <MonologuePill text="...뭐, 한번 보긴 해야겠지." />
          <View style={{ height: 32 }} />
          <CoralButton label="소개팅 출발하기" onPress={onNext} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
      <View style={{ width: 48 }}>
        <Text style={t.caption(c.textMuted)}>{label}</Text>
      </View>
      <Text style={t.chatMessage(c.textPrimary)}>{value}</Text>
    </View>
  );
}
