import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTextStyles } from '../theme/textStyles';
import { TypeDateTokens, withAlpha } from '../theme/colors';
import { useColors, useIsDark } from '../theme/useColors';
import { Choice } from '../types';

// Flutter widgets/choice_list.dart 이식.

/// 선택지 라벨(A/B/C/D)을 브랜드 그라디언트의 한 지점에 매핑 — 점(dot) 색상용.
function dotColorFor(label: string, c: TypeDateTokens): string {
  switch (label) {
    case 'A':
      return c.accentCoral;
    case 'B':
      return c.accentCoralSoft;
    case 'C':
      return c.accentLavender;
    case 'D':
      return c.accentLavenderDeep;
    default:
      return c.accentCoral;
  }
}

/// 선택지 버튼 (A/B/C/D)
export function ChoiceList({
  choices,
  selected,
  onSelect,
}: {
  choices: Choice[];
  selected: Choice | null;
  onSelect: (c: Choice) => void;
}) {
  return (
    <View>
      {choices.map((choice, i) => (
        <View key={choice.label}>
          <ChoiceButton
            choice={choice}
            isSelected={selected === choice}
            isHidden={selected != null && selected !== choice}
            onTap={selected == null ? () => onSelect(choice) : undefined}
          />
          {i !== choices.length - 1 && <View style={{ height: 8 }} />}
        </View>
      ))}
    </View>
  );
}

function ChoiceButton({
  choice,
  isSelected,
  isHidden,
  onTap,
}: {
  choice: Choice;
  isSelected: boolean;
  isHidden: boolean;
  onTap?: () => void;
}) {
  const c = useColors();
  const t = useTextStyles();
  const isDark = useIsDark();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onTap}
      disabled={onTap == null}
      style={{
        opacity: isHidden ? 0 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={{
          minHeight: 44,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: withAlpha(c.surface, pressed ? 0.85 : 0.6),
          borderWidth: isSelected ? 1.5 : 0.5,
          borderColor: isSelected ? c.accentLavenderDeep : withAlpha(c.textPrimary, 0.08),
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            width: 15,
            height: 15,
            marginTop: 2,
            borderRadius: 7.5,
            backgroundColor: dotColorFor(choice.label, c),
          }}
        />
        <View style={{ width: 10 }} />
        <Text style={[t.choiceButton(c.textPrimary), { flex: 1 }]}>{choice.text}</Text>
      </View>
    </Pressable>
  );
}
