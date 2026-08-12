import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useStore } from './src/state/store';
import { useColors, useIsDark } from './src/theme/useColors';
import { allImages } from './src/assets/images';
import { IntroLogo } from './src/widgets/IntroLogo';
import { track } from './src/analytics/track';
import { ErrorBoundary } from './src/widgets/ErrorBoundary';

// 화면 이탈 지점을 보려면 진입 기록이 필요한데, 스크린마다 심는 대신 여기 한 곳에서 잡는다.
const navRef = createNavigationContainerRef();
let lastScreen = '';

function logScreen() {
  const name = navRef.getCurrentRoute()?.name;
  if (name != null && name !== lastScreen) {
    lastScreen = name;
    track('screen_view', { props: { screen: name } });
  }
}

// ErrorBoundary는 렌더 중 오류만 잡는다. 타이머·비동기에서 터진 건 여기서 받는다.
// 기존 핸들러(개발 중 빨간 화면)는 그대로 이어서 호출한다.
const prevGlobalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((e, isFatal) => {
  track('error', {
    props: {
      message: String(e?.message ?? e).slice(0, 200),
      screen: lastScreen,
      fatal: isFatal ? 'fatal' : 'async',
    },
  });
  prevGlobalHandler(e, isFatal);
});

function Root() {
  const c = useColors();
  const isDark = useIsDark();
  // 로딩이 끝난 직후 로고 인트로를 한 번 보여주고, 끝나면 타이틀 화면이 드러난다.
  const [introDone, setIntroDone] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ErrorBoundary screen={() => lastScreen}>
        <NavigationContainer ref={navRef} onReady={logScreen} onStateChange={logScreen}>
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
      {!introDone && <IntroLogo onFinished={() => setIntroDone(true)} />}
    </View>
  );
}

// 폰트·이미지 로딩이 끝날 때까지 스플래시를 띄워둔다 — 그동안 빈 화면이 보이지 않게.
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const loadPersisted = useStore((s) => s.loadPersisted);
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.ttf'),
  });

  // 화면 전환 시 사진이 뜨는 지연을 없애기 위해 시작 시 전체 이미지를 미리 캐싱한다.
  const [imagesLoaded, setImagesLoaded] = useState(false);
  useEffect(() => {
    // 라인(남/여)이 복원된 뒤에 보내야 방문 기록에 올바른 라인이 남는다.
    void loadPersisted().then(() => track('app_open'));
    Asset.loadAsync(allImages)
      .catch(() => {})
      .finally(() => setImagesLoaded(true));
  }, []);

  const ready = fontsLoaded && imagesLoaded;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
