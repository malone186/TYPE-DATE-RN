import { useMemo } from 'react';
import { TextStyle } from 'react-native';
import { useStore } from '../state/store';

// UI 디자인 명세서 v1.0 §2 타입 스케일 (Flutter theme.dart TypeDateTextStyles 이식)
// Flutter의 height(줄간격 배수)는 RN lineHeight(px) = fontSize * height 로 환산.

export const TypeDateTextStyles = {
  resultTitle: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 24 * 1.3,
    color,
  }),

  screenTitle: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    lineHeight: 18 * 1.4,
    color,
  }),

  chatMessage: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color,
  }),

  choiceButton: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 14 * 1.4,
    color,
  }),

  monologue: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 15 * 1.5,
    color,
  }),

  caption: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 13 * 1.4,
    color,
  }),

  choiceLabel: (color: string): TextStyle => ({
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 12,
    color,
  }),
};

type TextStyleSet = typeof TypeDateTextStyles;

/// 설정창에서 고른 글자 크기 배율이 반영된 텍스트 스타일 모음.
/// 사용법은 TypeDateTextStyles와 같고, fontSize/lineHeight에만 배율이 곱해져 나온다.
/// fs(n)은 스타일 셋을 거치지 않는 인라인 fontSize에 같은 배율을 먹일 때 쓴다.
export function useTextStyles(): TextStyleSet & { fs: (size: number) => number } {
  const scale = useStore((s) => s.fontScale);
  return useMemo(() => {
    const scaled: Record<string, (color: string) => TextStyle> = {};
    for (const [name, make] of Object.entries(TypeDateTextStyles)) {
      scaled[name] = (color) => {
        const base = make(color);
        return {
          ...base,
          fontSize: (base.fontSize as number) * scale,
          lineHeight: (base.lineHeight as number) * scale,
        };
      };
    }
    return { ...(scaled as TextStyleSet), fs: (size: number) => size * scale };
  }, [scale]);
}
