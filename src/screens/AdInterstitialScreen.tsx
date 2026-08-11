import React, { useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/colors';
import { useTextStyles } from '../theme/textStyles';
import { useColors } from '../theme/useColors';
import { GlowBackground, CoralButton } from '../widgets/common';

// 데이트가 끝나고 결과 리포트로 넘어가기 전에 끼는 전면 광고.
// 지금은 SDK 없이 자리만 잡아둔 더미 뷰 — 나중에 이 박스를 실제 광고 뷰로 교체하면 된다.

const COUNTDOWN_SECONDS = 5;

export function AdInterstitialScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'AdInterstitial'>) {
  const c = useColors();
  const t = useTextStyles();
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  // 뒤로가기로 광고를 건너뛰지 못하게 막는다 — 결과는 아래 버튼으로만 열린다.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const done = remaining <= 0;

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ height: 12 }} />
          <Text style={[t.caption(c.textSecondary), { textAlign: 'center' }]}>
            {done ? '광고가 끝났어요' : `${remaining}초 후 결과를 볼 수 있어요`}
          </Text>

          <View style={{ height: 16 }} />

          {/* 광고 자리 — 실제 배너/전면 광고 뷰로 교체될 영역 */}
          <View
            style={{
              flex: 1,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: withAlpha(c.surface, 0.75),
              borderWidth: 1,
              borderColor: withAlpha(c.border, 0.9),
            }}
          >
            <Text style={t.screenTitle(c.textMuted)}>광고 영역</Text>
            <View style={{ height: 6 }} />
            <Text style={t.caption(c.textMuted)}>Advertisement</Text>
          </View>

          <View style={{ height: 20 }} />
          <CoralButton
            label={done ? '결과 보고서 보기' : `결과 보고서 보기 (${remaining})`}
            disabled={!done}
            onPress={() => navigation.replace('ResultReport', { result: route.params.result })}
          />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
