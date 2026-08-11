import React from 'react';
import { FlatList, Image, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { CoralButton, GlowBackground, SoundControlButton, ThemeToggleButton } from '../widgets/common';
import { useStore } from '../state/store';
import { lineData } from '../data';
import { imageSource } from '../assets/images';
import { TDCharacter } from '../types';
import { Pressable } from 'react-native';

// Flutter screens/character_select_screen.dart 이식.
// 2열 그리드, 16슬롯, 순차 해금.
export function CharacterSelectScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CharacterSelect'>) {
  const c = useColors();
  const t = useTextStyles();
  const line = useStore((s) => s.line);
  const isCompleted = useStore((s) => s.isCompleted);
  // completedIds 변경 시 리렌더 보장
  useStore((s) => s.completedIds);

  const { episodes, slots } = lineData(line);
  const completedCount = episodes.filter((e) => isCompleted(e.id)).length;

  const { width } = useWindowDimensions();
  const itemWidth = (width - 16 * 2 - 16) / 2;
  const itemHeight = itemWidth / 0.8;

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
            <Pressable
              onPress={() =>
                navigation.canGoBack()
                  ? navigation.goBack()
                  : navigation.navigate('LineSelect', { next: 'CharacterSelect' })
              }
              hitSlop={8}
              style={{ paddingRight: 12 }}
            >
              <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
            </Pressable>
            <Text style={t.screenTitle(c.textPrimary)}>소개팅 상대</Text>
            <View style={{ flex: 1 }} />
            <SoundControlButton />
            <ThemeToggleButton />
          </View>
          <View style={{ height: 4 }} />
          <Text style={t.caption(c.textSecondary)}>{completedCount} / 16 완료</Text>
          {completedCount >= episodes.length && (
            <>
              <View style={{ height: 10 }} />
              <CoralButton
                label="💘 마지막 이야기 다시 보기"
                onPress={() => navigation.navigate('FinalEpilogue')}
              />
            </>
          )}
          <View style={{ height: 12 }} />
          <FlatList
            data={slots}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 16 }}
            contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
            renderItem={({ item, index }) => {
              const hasContent = index < episodes.length;
              const unlocked = hasContent && (index === 0 || isCompleted(episodes[index - 1].id));
              return (
                <CharacterSlot
                  character={item}
                  locked={!unlocked}
                  isCompleted={isCompleted(item.id)}
                  width={itemWidth}
                  height={itemHeight}
                  onTap={unlocked ? () => navigation.navigate('CharacterProfile', { characterId: item.id }) : undefined}
                />
              );
            }}
          />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function CharacterSlot({
  character,
  locked,
  isCompleted,
  width,
  height,
  onTap,
}: {
  character: TDCharacter;
  locked: boolean;
  isCompleted: boolean;
  width: number;
  height: number;
  onTap?: () => void;
}) {
  const c = useColors();
  const t = useTextStyles();
  const img = imageSource(character.imagePath);
  return (
    <Pressable
      onPress={onTap}
      disabled={onTap == null}
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: withAlpha(c.surface, 0.75),
        borderWidth: 1,
        borderColor: withAlpha(c.border, 0.6),
      }}
    >
      <View style={{ flex: 1, backgroundColor: withAlpha(c.bg, 0.45), alignItems: 'center', justifyContent: 'center' }}>
        {locked ? (
          <MaterialIcons name="person-outline" size={40} color={c.textMuted} />
        ) : img ? (
          <Image source={img} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        ) : (
          <MaterialIcons name="person" size={40} color={c.accentCoralSoft} />
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={t.choiceLabel(c.accentLavenderDeep)}>{locked ? '?????' : character.mbti}</Text>
        <View style={{ height: 2 }} />
        <Text numberOfLines={1} style={t.caption(c.textSecondary)}>
          {locked ? '???' : `${character.name} · ${character.age}세`}
        </Text>
      </View>

      {locked && (
        <View style={{ ...absoluteFill, backgroundColor: withAlpha(c.bg, 0.55), alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="lock-outline" size={28} color={c.textMuted} />
        </View>
      )}
      {isCompleted && (
        <View style={{ position: 'absolute', top: 8, right: 8, padding: 4, borderRadius: 999, backgroundColor: c.success }}>
          <MaterialIcons name="check" size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
