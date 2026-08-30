import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/types';

import { withAlpha } from '../theme/colors';
import { useTextStyles } from '../theme/textStyles';
import { useColors } from '../theme/useColors';
import { useStore } from '../state/store';
import type { ThemeMode } from '../state/store';
import { GlassPanel, FrameAnchoredRight, CoralButton, VolumeSlider } from './common';
import { AD_REMOVE_PRICE, buyRemoveAds } from '../lib/billing';

// 공용 우측 상단 설정 버튼 — 글자 크기, 테마, 사운드, 광고 제거를 다룬다.
// 사운드 버튼과 같은 방식으로, 아이콘을 누르면 헤더 아래에 패널이 열리고 바깥을 누르면 닫힌다.

const FONT_SCALES: { label: string; value: number }[] = [
  { label: '작게', value: 0.85 },
  { label: '보통', value: 1 },
  { label: '크게', value: 1.15 },
  { label: '아주 크게', value: 1.3 },
];

const THEME_MODES: { label: string; value: ThemeMode }[] = [
  { label: '라이트', value: 'light' },
  { label: '다크', value: 'dark' },
  { label: '시스템', value: 'system' },
];

export function SettingsButton() {
  const c = useColors();
  const t = useTextStyles();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [open, setOpen] = useState(false);

  const fontScale = useStore((s) => s.fontScale);
  const setFontScale = useStore((s) => s.setFontScale);
  const adRemoved = useStore((s) => s.adRemoved);
  const themeMode = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);
  const soundMuted = useStore((s) => s.soundMuted);
  const sfxVolume = useStore((s) => s.sfxVolume);
  const toggleSoundMuted = useStore((s) => s.toggleSoundMuted);
  const setSfxVolume = useStore((s) => s.setSfxVolume);

  return (
    <>
      {/* 사진·그라디언트 배경 위에서도 아이콘이 묻히지 않도록 불투명한 원형 칩을 깐다. */}
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => ({
          padding: 8,
          marginLeft: 6,
          marginTop: 4,
          marginRight: 1,
          borderRadius: 999,
          backgroundColor: withAlpha(c.surface, pressed ? 0.98 : 0.88),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withAlpha(c.border, 0.8),
        })}
      >
        <MaterialIcons name="settings" size={22} color={c.textPrimary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <FrameAnchoredRight top={insets.top + 52} width={288}>
          <GlassPanel padding={16}>
            <Text style={t.screenTitle(c.textPrimary)}>설정</Text>

            <View style={{ height: 16 }} />
            <Text style={t.caption(c.textSecondary)}>글자 크기</Text>
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row' }}>
              {FONT_SCALES.map((s, i) => (
                <React.Fragment key={s.value}>
                  {i > 0 && <View style={{ width: 6 }} />}
                  <ScaleChip
                    label={s.label}
                    selected={fontScale === s.value}
                    onPress={() => setFontScale(s.value)}
                  />
                </React.Fragment>
              ))}
            </View>
            <View style={{ height: 10 }} />
            {/* 고른 크기가 실제로 어떻게 보이는지 바로 확인시켜 준다 */}
            <View
              style={{
                padding: 10,
                borderRadius: 10,
                backgroundColor: withAlpha(c.border, 0.35),
              }}
            >
              <Text style={t.chatMessage(c.textPrimary)}>오늘 처음 뵙네요!</Text>
            </View>

            <View style={{ height: 16 }} />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(c.border, 0.9) }} />
            <View style={{ height: 16 }} />

            <Text style={t.caption(c.textSecondary)}>테마</Text>
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row' }}>
              {THEME_MODES.map((mode, i) => (
                <React.Fragment key={mode.value}>
                  {i > 0 && <View style={{ width: 6 }} />}
                  <ScaleChip
                    label={mode.label}
                    selected={themeMode === mode.value}
                    onPress={() => setThemeMode(mode.value)}
                  />
                </React.Fragment>
              ))}
            </View>

            <View style={{ height: 16 }} />
            <Text style={t.caption(c.textSecondary)}>사운드</Text>
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons
                name={soundMuted ? 'volume-off' : 'volume-up'}
                size={20}
                color={soundMuted ? c.textMuted : c.textPrimary}
              />
              <View style={{ width: 8 }} />
              <Text style={[t.caption(c.textPrimary), { flex: 1 }]}>효과음</Text>
              <Pressable
                onPress={toggleSoundMuted}
                hitSlop={6}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: soundMuted ? withAlpha(c.textMuted, 0.2) : c.accentCoral,
                }}
              >
                <Text
                  style={{
                    fontSize: t.fs(12),
                    fontFamily: 'Pretendard-SemiBold',
                    color: soundMuted ? c.textSecondary : '#FFFFFF',
                  }}
                >
                  {soundMuted ? '음소거' : '켜짐'}
                </Text>
              </Pressable>
            </View>
            <View style={{ height: 4 }} />
            <VolumeRow label="효과음 볼륨" value={sfxVolume} disabled={soundMuted} onChange={setSfxVolume} />

            <View style={{ height: 16 }} />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(c.border, 0.9) }} />
            <View style={{ height: 16 }} />

            <Text style={t.caption(c.textSecondary)}>광고</Text>
            <View style={{ height: 8 }} />
            {adRemoved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="check-circle" size={18} color={c.success} />
                <View style={{ width: 6 }} />
                <Text style={t.caption(c.textPrimary)}>광고가 제거되었습니다</Text>
              </View>
            ) : (
              <RemoveAdsButton />
            )}

            <View style={{ height: 16 }} />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(c.border, 0.9) }} />
            <View style={{ height: 8 }} />

            <Pressable
              onPress={() => {
                setOpen(false);
                nav.navigate('Inquiry');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                height: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="chat-bubble-outline" size={18} color={c.textPrimary} />
              <View style={{ width: 8 }} />
              <Text style={[t.caption(c.textPrimary), { flex: 1 }]}>1:1 문의</Text>
              <MaterialIcons name="chevron-right" size={20} color={c.textSecondary} />
            </Pressable>
          </GlassPanel>
        </FrameAnchoredRight>
      </Modal>
    </>
  );
}

/// 광고 제거 구매 버튼 — 설정 패널과 타이틀 화면이 같은 가격·같은 집계 이벤트를 쓰도록 한 곳에 둔다.
/// 이미 제거된 상태인지는 부르는 쪽이 판단한다(설정 패널은 대신 안내 문구를 띄운다).
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
  const t = useTextStyles();
  return (
    <View style={{ opacity: disabled ? 0.4 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={t.caption(c.textSecondary)}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={t.caption(c.textMuted)}>{`${Math.round(value * 100)}%`}</Text>
      </View>
      <VolumeSlider value={value} onChange={onChange} />
    </View>
  );
}

export function RemoveAdsButton({ outlined = false }: { outlined?: boolean }) {
  const c = useColors();
  const t = useTextStyles();
  const [pending, setPending] = useState(false);

  const label = `광고 제거 · ${AD_REMOVE_PRICE.toLocaleString('ko-KR')}원`;
  // 광고 제거는 결제가 확인된 뒤 billing.ts에서 켠다 — 여기서는 결제창만 띄운다.
  // 취소·실패는 스토어가 자체 화면으로 안내하므로 앱에서 따로 알리지 않는다.
  const buy = () => {
    if (pending) return;
    setPending(true);
    void buyRemoveAds().finally(() => setPending(false));
  };

  // 타이틀 화면에서는 시작하기/이어하기와 같은 CTA 규격을 써야 줄이 어긋나 보이지 않는다.
  if (outlined) return <CoralButton label={label} outlined disabled={pending} onPress={buy} />;

  return (
    <Pressable
      onPress={buy}
      style={({ pressed }) => ({
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        backgroundColor: c.accentCoral,
      })}
    >
      <Text style={{ fontSize: t.fs(14), fontFamily: 'Pretendard-SemiBold', color: '#FFFFFF' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScaleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? c.accentCoral : withAlpha(c.surface, pressed ? 0.98 : 0.75),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? c.accentCoral : withAlpha(c.border, 0.9),
      })}
    >
      {/* 칩 라벨은 설정 대상 자체라 배율을 먹이지 않는다 — 커지면 칩이 깨진다 */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          fontFamily: 'Pretendard-SemiBold',
          color: selected ? '#FFFFFF' : c.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
