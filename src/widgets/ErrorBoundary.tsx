import React from 'react';
import { Text, View } from 'react-native';
import { track } from '../analytics/track';

// 렌더 중 터진 오류를 잡아 기록하고, 빈 화면 대신 복구 버튼을 보여준다.
// 이게 없으면 크래시가 나도 사장님은 문의가 들어와야 알게 된다.

interface Props {
  children: React.ReactNode;
  /// 지금 보고 있던 화면 이름 — 어디서 터졌는지 알아야 고칠 수 있다.
  screen: () => string;
}
interface State {
  failed: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    track('error', {
      props: {
        // 메시지가 길면 집계할 때 같은 오류가 갈라지므로 잘라서 보낸다.
        message: String(error?.message ?? error).slice(0, 200),
        screen: this.props.screen(),
        fatal: 'render',
      },
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 17, fontFamily: 'Pretendard-SemiBold', textAlign: 'center' }}>
          문제가 생겨 화면을 열지 못했어요
        </Text>
        <View style={{ height: 8 }} />
        <Text style={{ fontSize: 14, opacity: 0.7, textAlign: 'center' }}>
          잠시 후 앱을 다시 실행해 주세요.{'\n'}같은 문제가 반복되면 설정 → 1:1 문의로 알려주세요.
        </Text>
      </View>
    );
  }
}
