import React, { useCallback, useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { useTextStyles } from '../theme/textStyles';
import { useColors } from '../theme/useColors';
import { GlowBackground } from '../widgets/common';
import { track } from '../analytics/track';
import { loadAndShowResultInterstitial } from '../lib/ads';
import { useStore } from '../state/store';

const MAX_AD_WAIT_MS = 3000;

export function AdInterstitialScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'AdInterstitial'>) {
  const c = useColors();
  const t = useTextStyles();
  const result = route.params.result;
  const adRemoved = useStore((s) => s.adRemoved);
  const billingStatus = useStore((s) => s.billingStatus);
  const finishedRef = useRef(false);
  const adVisibleRef = useRef(false);
  const adOpenedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const finish = useCallback(() => {
    if (finishedRef.current || adVisibleRef.current) return;
    finishedRef.current = true;
    cleanupRef.current?.();
    cleanupRef.current = null;
    navigation.replace('ResultReport', { result });
  }, [navigation, result]);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 소유권 확인 중에는 광고를 요청하지 않는다. 3초 안에 판정되지 않으면
    // 게임 결과를 막지 않고 광고를 생략한다.
    const ownershipChecking =
      billingStatus === 'uninitialized' ||
      billingStatus === 'checking' ||
      billingStatus === 'pending' ||
      billingStatus === 'purchasing' ||
      billingStatus === 'verifying';
    if (adRemoved || billingStatus === 'error') {
      finish();
      return;
    }
    if (ownershipChecking) {
      timer = setTimeout(finish, MAX_AD_WAIT_MS);
      return () => {
        mounted = false;
        if (timer != null) clearTimeout(timer);
      };
    }

    timer = setTimeout(finish, MAX_AD_WAIT_MS);
    void loadAndShowResultInterstitial({
      isCancelled: () => finishedRef.current,
      onOpened: () => {
        if (adOpenedRef.current) return;
        adOpenedRef.current = true;
        adVisibleRef.current = true;
        if (timer != null) clearTimeout(timer);
        track('ad_shown', {
          episodeId: result.dateId,
          props: { placement: 'interstitial_result' },
        });
      },
      onClosed: () => {
        adVisibleRef.current = false;
        finish();
      },
      onError: finish,
    }).then((cleanup) => {
      if (!mounted || finishedRef.current) {
        cleanup?.();
      } else {
        cleanupRef.current = cleanup;
      }
    });

    return () => {
      mounted = false;
      if (timer != null) clearTimeout(timer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [adRemoved, billingStatus, finish, result.dateId]);

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          <Text style={[t.screenTitle(c.textPrimary), { textAlign: 'center' }]}>결과를 준비하고 있어요</Text>
          <View style={{ height: 10 }} />
          <Text style={[t.caption(c.textSecondary), { textAlign: 'center' }]}>잠시만 기다려 주세요.</Text>
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}
