import React, { useState } from 'react';
import { Pressable, TextInput, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { GlowBackground, SoundControlButton, ThemeToggleButton, CoralButton } from '../widgets/common';
import { useStore } from '../state/store';

// Flutter screens/name_input_screen.dart 이식.
export function NameInputScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'NameInput'>) {
  const c = useColors();
  const t = useTextStyles();
  const setUserName = useStore((s) => s.setUserName);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const name = text.trim();
    if (name.length === 0) return;
    setUserName(name);
    navigation.replace('Prologue');
  };

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() =>
                navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Splash')
              }
              hitSlop={8}
              style={{ padding: 8 }}
            >
              <MaterialIcons name="arrow-back-ios" size={20} color={c.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <SoundControlButton />
            <ThemeToggleButton />
          </View>
          <View style={{ flex: 3 }} />
          <Text style={t.screenTitle(c.textPrimary)}>만나기 전에,</Text>
          <View style={{ height: 8 }} />
          <Text style={[t.resultTitle(c.textPrimary), { fontSize: t.fs(20) }]}>
            상대가 당신을 뭐라고 부르면 좋을까요?
          </Text>
          <View style={{ height: 24 }} />
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="이름 또는 닉네임"
            placeholderTextColor={c.textMuted}
            style={[
              t.chatMessage(c.textPrimary),
              {
                backgroundColor: withAlpha(c.surface, 0.72),
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: focused ? 1.5 : 1,
                borderColor: focused ? c.accentCoral : c.border,
              },
            ]}
          />
          <View style={{ flex: 4 }} />
          <CoralButton label="다음" onPress={submit} disabled={text.trim().length === 0} />
          <View style={{ height: 32 }} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
