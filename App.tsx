import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useStore } from './src/state/store';
import { useColors, useIsDark } from './src/theme/useColors';
import { allImages } from './src/assets/images';

function Root() {
  const c = useColors();
  const isDark = useIsDark();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
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
    loadPersisted();
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
