import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/// 사운드 설정 버튼 — 우측 상단에서 음소거 토글 + 효과음 볼륨을 조절한다.
/// 아이콘을 누르면 헤더 아래쪽에 볼륨 박스가 열리고, 바깥을 누르면 닫힌다.
export function SoundControlButton() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const muted = useStore((s) => s.soundMuted);
  const sfxVolume = useStore((s) => s.sfxVolume);
  const toggleMuted = useStore((s) => s.toggleSoundMuted);
  const setSfxVolume = useStore((s) => s.setSfxVolume);

  return (
    <>
      {/* 사진·그라디언트 배경 위에서도 아이콘이 묻히지 않도록 불투명한 원형 칩을 깐다. */}
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => ({
          padding: 8,
          marginRight: 6,
          borderRadius: 999,
          backgroundColor: withAlpha(c.surface, pressed ? 0.98 : 0.88),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withAlpha(c.border, 0.8),
        })}
      >
        <MaterialIcons
          name={muted ? 'volume-off' : 'volume-up'}
          size={22}
          color={muted ? c.textMuted : c.textPrimary}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={{ position: 'absolute', top: insets.top + 52, right: 12, width: 248 }}>
          <GlassPanel padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={TypeDateTextStyles.caption(c.textSecondary)}>사운드</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={toggleMuted}
                hitSlop={6}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: muted ? withAlpha(c.textMuted, 0.2) : c.accentCoral,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Pretendard-SemiBold',
                    color: muted ? c.textSecondary : '#FFFFFF',
                  }}
                >
                  {muted ? '음소거 중' : '소리 켜짐'}
                </Text>
              </Pressable>
            </View>

            <View style={{ height: 12 }} />
            <VolumeRow label="효과음" value={sfxVolume} disabled={muted} onChange={setSfxVolume} />
          </GlassPanel>
        </View>
      </Modal>
    </>
  );
}

function VolumeRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  return (
    <View style={{ opacity: disabled ? 0.4 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={TypeDateTextStyles.caption(c.textSecondary)}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={TypeDateTextStyles.caption(c.textMuted)}>{`${Math.round(value * 100)}%`}</Text>
      </View>
      <VolumeSlider value={value} onChange={onChange} />
    </View>
  );
}

/// 슬라이더 — 새 의존성 없이 PanResponder로 탭/드래그를 모두 받는다.
/// 트랙의 화면상 좌표는 터치 시작 시 pageX-locationX로 구해두고, 드래그 중에는 그 기준으로 환산한다.
function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const c = useColors();
  const trackWidth = useRef(1);
  const trackOriginX = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(() => {
    const apply = (x: number) => {
      const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
      onChangeRef.current(Math.round(ratio * 100) / 100);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        trackOriginX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        apply(e.nativeEvent.locationX);
      },
      onPanResponderMove: (_, gesture) => apply(gesture.moveX - trackOriginX.current),
    });
  }, []);

  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => {
        trackWidth.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      style={{ paddingVertical: 10 }}
    >
      <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: withAlpha(c.border, 0.9) }}>
        <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: c.accentCoral }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          left: `${pct * 100}%`,
          marginLeft: -9,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: c.accentCoral,
          borderWidth: 2,
          borderColor: '#FFFFFF',
        }}
      />
    </View>
  );
}

/// 원형 프사 — 브랜드 그라디언트 글로우 링 + 이미지, 없으면 이니셜 placeholder
export function CharacterAvatar({
  character,
  size = 40,
  useFace = false,
}: {
  character: TDCharacter;
  size?: number;
  useFace?: boolean; // 작은 동그라미에서는 얼굴 크롭이 더 잘 보인다
}) {
  const c = useColors();
  const img = (useFace ? imageSource(character.facePath) : undefined) ?? imageSource(character.imagePath);
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
