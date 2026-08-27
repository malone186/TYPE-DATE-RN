import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground } from '../widgets/common';
import { SettingsButton } from '../widgets/SettingsSheet';
import { useStore } from '../state/store';
import { LINE_DATA, LineKey } from '../data';

// 스플래시 다음 라인 선택 화면. 여자 ver(주인공 남) / 남자 ver(주인공 여)를 고른다.
export function LineSelectScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'LineSelect'>) {
  const c = useColors();
  const t = useTextStyles();
  const setLine = useStore((s) => s.setLine);

  const pick = async (line: LineKey) => {
    await setLine(line);
    navigation.navigate(route.params.next);
  };

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => navigation.replace('Splash')}
              hitSlop={8}
              style={{ padding: 8 }}
            >
              <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <SettingsButton />
          </View>
          <View style={{ flex: 2 }} />
          <Text style={[t.screenTitle(c.textPrimary), { textAlign: 'center' }]}>
            어떤 이야기를 시작할까요?
          </Text>
          <View style={{ height: 8 }} />
          <Text style={[t.chatMessage(c.textSecondary), { textAlign: 'center' }]}>
            버전에 따라 주인공과 만나는 상대가 바뀌어요.
          </Text>
          <View style={{ height: 32 }} />
          <LineCard emoji="👩" data={LINE_DATA.female} onPress={() => pick('female')} />
          <View style={{ height: 16 }} />
          <LineCard emoji="👨" data={LINE_DATA.male} onPress={() => pick('male')} />
          <View style={{ flex: 3 }} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

function LineCard({
  emoji,
  data,
  onPress,
}: {
  emoji: string;
  data: { label: string; protagonist: string };
  onPress: () => void;
}) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 18,
        paddingVertical: 22,
        paddingHorizontal: 20,
        backgroundColor: withAlpha(c.surface, pressed ? 0.9 : 0.75),
        borderWidth: 1,
        borderColor: withAlpha(c.accentCoral, pressed ? 0.9 : 0.5),
        flexDirection: 'row',
        alignItems: 'center',
      })}
    >
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
      <View style={{ width: 16 }} />
      <View style={{ flex: 1 }}>
        <Text style={t.resultTitle(c.textPrimary)}>{data.label}</Text>
        <View style={{ height: 4 }} />
        <Text style={t.caption(c.textSecondary)}>{data.protagonist}</Text>
      </View>
    </Pressable>
  );
}
