import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { GlowBackground } from './common';
import { logoIntroImage } from '../assets/images';

// 앱 진입 인트로 — 로고가 살짝 떠올랐다가 사라지고 타이틀 화면이 드러난다.
// 배경은 타이틀 화면과 같은 GlowBackground를 쓰기 때문에, 오버레이가 걷혀도 배경은 그대로다.

const FADE_IN_MS = 500;
const HOLD_MS = 500;
const FADE_OUT_MS = 600;

export function IntroLogo({ onFinished }: { onFinished: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_IN_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
        Animated.timing(fade, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // 페이드 내내 아주 조금씩 커져서 정지 화면처럼 보이지 않게
      Animated.timing(scale, {
        toValue: 1,
        duration: FADE_IN_MS + HOLD_MS + FADE_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onFinished();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <GlowBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Image
            source={logoIntroImage}
            resizeMode="contain"
            style={{ width: 240, height: 240, opacity: fade, transform: [{ scale }] }}
          />
        </View>
      </GlowBackground>
    </View>
  );
}
