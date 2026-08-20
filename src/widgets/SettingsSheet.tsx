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
import { GlassPanel, FrameAnchoredRight } from './common';
import { track } from '../analytics/track';

// 메인(타이틀) 화면 우측 상단 설정 버튼 — 글자 크기와 광고 제거를 다룬다.
// 사운드 버튼과 같은 방식으로, 아이콘을 누르면 헤더 아래에 패널이 열리고 바깥을 누르면 닫힌다.

/// 광고 제거 가격(원) — 버튼 문구와 수익 집계가 같은 값을 보게 한 곳에 둔다.
const AD_REMOVE_PRICE = 2200;

const FONT_SCALES: { label: string; value: number }[] = [
  { label: '작게', value: 0.85 },
  { label: '보통', value: 1 },
  { label: '크게', value: 1.15 },
  { label: '아주 크게', value: 1.3 },
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
  const removeAds = useStore((s) => s.removeAds);

  return (
    <>
      {/* 사진·그라디언트 배경 위에서도 아이콘이 묻히지 않도록 불투명한 원형 칩을 깐다. */}
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => ({
          padding: 8,
          marginLeft: 6,
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
              <Text style={t.chatMessage(c.textPrimary)}>미리보기 — 오늘 처음 뵙네요!</Text>
            </View>

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
              <Pressable
                onPress={() => {
                  // 결제 SDK를 붙이면 '결제 성공' 콜백으로 옮겨야 한다.
                  // 지금은 결제 없이 켜지므로 이 값은 매출이 아니라 '전환 의사'다.
                  track('remove_ads', { props: { price: AD_REMOVE_PRICE } });
                  removeAds();
                }}
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
                  광고 제거 · {AD_REMOVE_PRICE.toLocaleString('ko-KR')}원
                </Text>
              </Pressable>
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
