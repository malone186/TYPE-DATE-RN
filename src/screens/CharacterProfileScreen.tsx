import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground, SoundControlButton, ThemeToggleButton, CoralButton } from '../widgets/common';
import { useStore } from '../state/store';
import { characterById, episodeForCharacter } from '../data';
import { imageSource } from '../assets/images';
import { track } from '../analytics/track';

// Flutter screens/character_profile_screen.dart 이식.
export function CharacterProfileScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'CharacterProfile'>) {
  const c = useColors();
  const t = useTextStyles();
  const setSelectedEpisode = useStore((s) => s.setSelectedEpisode);
  const startSession = useStore((s) => s.startSession);

  const character = characterById(route.params.characterId);
  if (!character) return null;
  const face = imageSource(character.facePath);

  const start = () => {
    const episode = episodeForCharacter(character);
    if (!episode) return;
    setSelectedEpisode(episode);
    startSession(episode);
    track('episode_start', { episodeId: episode.id, props: { mbti: character.mbti } });
    navigation.navigate('BlindDateChat');
  };

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        {/* 상단 바 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 8 }}>
            <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <SoundControlButton />
          <ThemeToggleButton />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' }}>
          <View style={{ height: 12 }} />
          {face && (
            <>
              <LinearGradient
                colors={[c.accentCoral, c.accentCoralSoft, c.accentLavender, c.accentLavenderDeep, c.accentCoral]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  padding: 3,
                  shadowColor: c.accentCoral,
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                <View style={{ flex: 1, borderRadius: 80, overflow: 'hidden' }}>
                  <Image source={face} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                </View>
              </LinearGradient>
              <View style={{ height: 20 }} />
            </>
          )}
          <Text style={[t.resultTitle(c.textPrimary), { fontSize: t.fs(20), textAlign: 'center' }]}>
            {character.name} · {character.age}세
          </Text>
          <View style={{ height: 6 }} />
          <Text style={[t.choiceButton(c.accentLavenderDeep), { fontFamily: 'Pretendard-Bold' }]}>
            {character.mbti}
          </Text>
          <View style={{ height: 4 }} />
          <Text style={t.caption(c.textSecondary)}>
            {character.job} · {character.location}
          </Text>
          <View style={{ height: 16 }} />
          <Text style={[t.chatMessage(c.textPrimary), { textAlign: 'center' }]}>{character.intro}</Text>
          <View style={{ height: 16 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {character.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  margin: 4,
                  borderRadius: 999,
                  backgroundColor: withAlpha(c.accentLavender, 0.35),
                }}
              >
                <Text style={t.caption(c.accentLavenderText)}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 32 }} />
          <View style={{ width: '100%' }}>
            <CoralButton label="소개팅 시작" onPress={start} />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </GlowBackground>
  );
}
