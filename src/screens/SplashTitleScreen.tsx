import React from 'react';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { GlowBackground, SoundControlButton, ThemeToggleButton, CoralButton } from '../widgets/common';
import { SettingsButton } from '../widgets/SettingsSheet';
import { logoMarkImage } from '../assets/images';

// Flutter screens/splash_title_screen.dart 이식.
export function SplashTitleScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Splash'>) {
  const c = useColors();
  const t = useTextStyles();
  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SoundControlButton />
            <ThemeToggleButton />
            <SettingsButton />
          </View>
          <View style={{ flex: 3 }} />
          <Image source={logoMarkImage} style={{ width: 200, height: 200, alignSelf: 'center' }} resizeMode="contain" />
          <View style={{ height: 8 }} />
          <Text style={[t.caption(c.textSecondary), { textAlign: 'center' }]}>
            당신의 진짜 인연을 찾아드립니다
          </Text>
          <View style={{ flex: 4 }} />
          <CoralButton label="시작하기" onPress={() => navigation.navigate('LineSelect', { next: 'NameInput' })} />
          <View style={{ height: 12 }} />
          <CoralButton label="이어하기" outlined onPress={() => navigation.navigate('LineSelect', { next: 'CharacterSelect' })} />
          <View style={{ height: 32 }} />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
