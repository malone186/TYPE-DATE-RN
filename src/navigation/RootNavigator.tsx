import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useColors } from '../theme/useColors';

import { SplashTitleScreen } from '../screens/SplashTitleScreen';
import { LineSelectScreen } from '../screens/LineSelectScreen';
import { NameInputScreen } from '../screens/NameInputScreen';
import { PrologueScreen } from '../screens/PrologueScreen';
import { CharacterSelectScreen } from '../screens/CharacterSelectScreen';
import { CharacterProfileScreen } from '../screens/CharacterProfileScreen';
import { BlindDateChatScreen } from '../screens/BlindDateChatScreen';
import { AdInterstitialScreen } from '../screens/AdInterstitialScreen';
import { ResultReportScreen } from '../screens/ResultReportScreen';
import { SnsCardScreen } from '../screens/SnsCardScreen';
import { EpilogueScreen } from '../screens/EpilogueScreen';
import { FinalEpilogueScreen } from '../screens/FinalEpilogueScreen';
import { InquiryScreen } from '../screens/InquiryScreen';
import { InquiryThreadScreen } from '../screens/InquiryThreadScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const c = useColors();
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="Splash" component={SplashTitleScreen} />
      <Stack.Screen name="LineSelect" component={LineSelectScreen} />
      <Stack.Screen name="NameInput" component={NameInputScreen} />
      <Stack.Screen name="Prologue" component={PrologueScreen} />
      <Stack.Screen name="CharacterSelect" component={CharacterSelectScreen} />
      <Stack.Screen name="CharacterProfile" component={CharacterProfileScreen} />
      <Stack.Screen name="BlindDateChat" component={BlindDateChatScreen} />
      <Stack.Screen
        name="AdInterstitial"
        component={AdInterstitialScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="ResultReport" component={ResultReportScreen} />
      <Stack.Screen name="SnsCard" component={SnsCardScreen} />
      <Stack.Screen name="Epilogue" component={EpilogueScreen} />
      <Stack.Screen name="FinalEpilogue" component={FinalEpilogueScreen} />
      <Stack.Screen name="Inquiry" component={InquiryScreen} />
      <Stack.Screen name="InquiryThread" component={InquiryThreadScreen} />
    </Stack.Navigator>
  );
}
