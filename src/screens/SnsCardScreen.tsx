import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground, SoundControlButton, ThemeToggleButton } from '../widgets/common';
import { useStore } from '../state/store';
import { episodeById } from '../data';
import { DateResult, Ending, axisLetters } from '../types';

// Flutter screens/sns_card_screen.dart 이식.
export function SnsCardScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'SnsCard'>) {
  const c = useColors();
  const t = useTextStyles();
  const { result } = route.params;

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
          </Pressable>
          <View style={{ width: 4 }} />
          <Text style={t.screenTitle(c.textPrimary)}>공유 카드</Text>
          <View style={{ flex: 1 }} />
          <SoundControlButton />
          <ThemeToggleButton />
        </View>
        <View style={{ flex: 1, padding: 24 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ aspectRatio: 9 / 16, height: '100%', maxHeight: 560 }}>
              <ResultShareCard result={result} />
            </View>
          </View>
          <View style={{ height: 24 }} />
          <Text style={[t.caption(c.textMuted), { textAlign: 'center' }]}>
            스크린샷으로 저장해서 공유해보세요
          </Text>
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function endingEmoji(ending: Ending): string {
  switch (ending) {
    case 'success':
      return '💘';
    case 'friend':
      return '🤝';
    case 'fail':
      return '💨';
  }
}

export function ResultShareCard({ result }: { result: DateResult }) {
  const c = useColors();
  const t = useTextStyles();
  const episode = episodeById(result.dateId);
  const style = episode.styleInfo[result.styleType] ?? episode.styleInfo['EF'];
  const completedCount = useStore((s) => s.totalCompleted);

  return (
    <View
      style={{
        flex: 1,
        padding: 28,
        borderRadius: 24,
        backgroundColor: c.bg,
        borderWidth: 1.5,
        borderColor: c.border,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name="favorite" size={16} color={c.accentCoral} />
        <View style={{ width: 6 }} />
        <Text style={t.choiceLabel(c.textSecondary)}>TYPE DATE</Text>
      </View>
      <View style={{ flex: 2 }} />
      <Text style={{ fontSize: 40 }}>{style.emoji}</Text>
      <View style={{ height: 12 }} />
      <Text style={[t.resultTitle(c.textPrimary), { textAlign: 'center' }]}>{style.title}</Text>
      <View style={{ height: 20 }} />
      <Text style={t.chatMessage(c.textSecondary)}>분석 유형   {axisLetters(result.axisScore)}</Text>
      <View style={{ height: 6 }} />
      <Text style={t.chatMessage(c.accentCoral)}>궁합   {style.compatibilityStars}</Text>
      <View style={{ flex: 1 }} />
      <Text style={[t.monologue(c.textSecondary), { textAlign: 'center', paddingHorizontal: 8 }]}>
        "{style.summary}"
      </Text>
      <View style={{ flex: 2 }} />
      <Text style={t.choiceButton(c.textPrimary)}>
        {endingEmoji(result.ending)}   {completedCount} / 16
      </Text>
    </View>
  );
}
