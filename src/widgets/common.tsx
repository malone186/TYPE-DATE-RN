import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { TypeDateColors, withAlpha } from '../theme/colors';
import { TypeDateTextStyles } from '../theme/textStyles';
import { useColors, useIsDark } from '../theme/useColors';
import { useStore } from '../state/store';
import { TDCharacter } from '../types';
import { imageSource, logoMarkImage } from '../assets/images';

// Flutter widgets/common.dart 이식.

/// 주인공 속마음/내레이션 공용 렌더 — 이탤릭 텍스트에 반투명 필 배경을 깔아
/// 그라디언트·사진 등 어떤 배경 위에서도 라이트/다크 모두 읽히게 한다.
export function MonologuePill({ text, muted = false }: { text: string; muted?: boolean }) {
  const c = useColors();
  const isDark = useIsDark();
  const textColor = isDark ? c.textSecondary : withAlpha(c.textPrimary, muted ? 0.6 : 0.72);
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          borderRadius: 10,
          paddingVertical: 4,
          paddingHorizontal: 12,
          backgroundColor: withAlpha(c.surface, isDark ? 0.35 : 0.6),
        }}
      >
        <Text style={[TypeDateTextStyles.monologue(textColor), { textAlign: 'center' }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/// 새벽빛 메시 그라디언트를 이루는 부드러운 원형 글로우 한 덩어리.
export function GlowBlob({ color, size, gid }: { color: string; size: number; gid: string }) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.38} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
    </Svg>
  );
}

/// 앱 전체 공용 배경 — bg 위에 코랄/라벤더 글로우가 떠 있는 새벽빛 무드.
export function GlowBackground({
  children,
  showLogoWatermark = false,
  photoBackground = false,
  photoSource,
}: {
  children: React.ReactNode;
  showLogoWatermark?: boolean;
  photoBackground?: boolean;
  photoSource?: ImageSourcePropType; // 없으면 기본 배경(background.png) 사용
}) {
  const c = useColors();
  const isDark = useIsDark();
  const baseGradient = isDark
    ? ['#241E38', '#1F1A30', '#2A2142']
    : ['#CCD2F2', '#DBCDEE', '#EBD3E7'];
  const blobPeriwinkle = isDark ? '#4A3F7A' : '#B9C2F0';
  const blobLavender = isDark ? '#5B4A8C' : '#D8C4EC';
  const blobPink = isDark ? '#6E4A78' : '#EBC8DE';

  const content = (
    <>
      <LinearGradient
        colors={baseGradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {photoBackground && photoSource != null && (
        <>
          <Image
            source={photoSource}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.bg, isDark ? 0.55 : 0.35) }]} />
        </>
      )}
      <View style={[styles.blob, { top: -90, left: -70 }]} pointerEvents="none">
        <GlowBlob color={blobPeriwinkle} size={320} gid="blobA" />
      </View>
      <View style={[styles.blob, { top: 10, right: -110 }]} pointerEvents="none">
        <GlowBlob color={blobLavender} size={300} gid="blobB" />
      </View>
      <View style={[styles.blob, { bottom: -140, right: -60 }]} pointerEvents="none">
        <GlowBlob color={blobPink} size={300} gid="blobC" />
      </View>
      <View style={[styles.blob, { bottom: -110, left: -80 }]} pointerEvents="none">
        <GlowBlob color={blobLavender} size={260} gid="blobD" />
      </View>
      {showLogoWatermark && !photoBackground && (
        <View style={styles.watermarkWrap} pointerEvents="none">
          <Image
            source={logoMarkImage}
            resizeMode="contain"
            style={{ width: '80%', height: '65%', opacity: isDark ? 0.09 : 0.06 }}
          />
        </View>
      )}
      {children}
    </>
  );

  return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>{content}</View>;
}

/// 유리질 블러 패널 — 글로우 배경 위에 떠 있는 반투명 카드/말풍선 공용.
export function GlassPanel({
  children,
  borderRadius = 20,
  padding = 24,
  style,
}: {
  children: React.ReactNode;
  borderRadius?: number;
  padding?: number;
  style?: any;
}) {
  const c = useColors();
  const isDark = useIsDark();
  return (
    <View style={[{ borderRadius, overflow: 'hidden' }, style]}>
      <BlurView intensity={24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={{
          padding,
          borderRadius,
          backgroundColor: withAlpha(c.surface, 0.72),
          borderColor: withAlpha(c.border, 0.6),
          borderWidth: StyleSheet.hairlineWidth,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/// 라이트/다크/시스템 테마를 순환 전환하는 버튼
export function ThemeToggleButton() {
  const c = useColors();
  const mode = useStore((s) => s.themeMode);
  const cycle = useStore((s) => s.cycleThemeMode);
  const icon =
    mode === 'light' ? 'light-mode' : mode === 'dark' ? 'dark-mode' : 'brightness-auto';
  // 사진·그라디언트 배경 위에서도 아이콘이 묻히지 않도록 불투명한 원형 칩을 깐다.
  return (
    <Pressable
      onPress={cycle}
      hitSlop={8}
      style={({ pressed }) => ({
        padding: 8,
        borderRadius: 999,
        backgroundColor: withAlpha(c.surface, pressed ? 0.98 : 0.88),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: withAlpha(c.border, 0.8),
      })}
    >
      <MaterialIcons name={icon as any} size={22} color={c.textPrimary} />
    </Pressable>
  );
}

/// 원형 프사 — 브랜드 그라디언트 글로우 링 + 이미지, 없으면 이니셜 placeholder
export function CharacterAvatar({ character, size = 40 }: { character: TDCharacter; size?: number }) {
  const c = useColors();
  const img = imageSource(character.imagePath);
  return (
    <LinearGradient
      colors={[c.accentCoral, c.accentCoralSoft, c.accentLavender, c.accentLavenderDeep, c.accentCoral]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: 2,
        shadowColor: c.accentCoral,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: c.accentCoralSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {img ? (
          <Image source={img} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ color: '#FFFFFF', fontSize: size * 0.4, fontFamily: 'Pretendard-SemiBold' }}>
            {character.name.length > 0 ? character.name.substring(0, 1) : '?'}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

/// 턴 진행 바
export function TurnProgressBar({ progress }: { progress: number }) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(1, progress));
  const anim = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 300, useNativeDriver: false }).start();
  }, [clamped]);
  const widthPct = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: c.border }}>
      <Animated.View style={{ height: 4, width: widthPct }}>
        <LinearGradient
          colors={[c.accentCoral, c.accentLavender]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/// 타이핑 인디케이터 — 점 3개 순차 바운스
export function TypingIndicator() {
  const c = useColors();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            marginHorizontal: 2,
            borderRadius: 3,
            backgroundColor: c.textMuted,
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  );
}

/// 공통 코랄 CTA 버튼
export function CoralButton({
  label,
  onPress,
  outlined = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  outlined?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        width: '100%',
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        backgroundColor: outlined ? 'transparent' : c.accentCoral,
        borderWidth: outlined ? 1.5 : 0,
        borderColor: outlined ? c.accentCoral : undefined,
      })}
    >
      <Text style={{ fontSize: 15, fontFamily: 'Pretendard-SemiBold', color: outlined ? c.accentCoral : '#FFFFFF' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
