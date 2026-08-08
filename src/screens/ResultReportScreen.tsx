import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DateResult, Ending, StyleInfo, TDCharacter, axisLetters } from '../types';
import { episodeById } from '../data';
import { useColors } from '../theme/useColors';
import { useTextStyles } from '../theme/textStyles';
import { withAlpha } from '../theme/colors';
import { useStore } from '../state/store';
import { GlowBackground, SoundControlButton, ThemeToggleButton, CoralButton } from '../widgets/common';

// Flutter screens/result_report_screen.dart 이식.

// ── 종이 문서 카드 하드코딩 색상 (Dart _DocumentCard 상수) ──
const paperBg = '#FFFDF9';
const paperBorder = '#2B2723';
const paperText = '#1A1714';
const paperSub = '#555050';
const accentBlue = '#2563EB';

// Pretendard 웨이트별 fontFamily (RN은 numeric weight 합성 불가)
const fRegular = 'Pretendard-Regular'; // w400
const fMedium = 'Pretendard-Medium'; // w500
const fSemiBold = 'Pretendard-SemiBold'; // w600
const fBold = 'Pretendard-Bold'; // w700/w800

const axisKeys = ['E', 'N', 'T', 'J'];

const letterWords: Record<string, string> = {
  E: '외향', I: '내향',
  N: '직관', S: '감각',
  T: '사고', F: '감정',
  J: '계획', P: '즉흥',
};

function axisLabel(axis: string): string {
  switch (axis) {
    case 'E':
      return '에너지 방향';
    case 'N':
      return '정보 해석 방식';
    case 'T':
      return '판단 기준';
    case 'J':
      return '생활 패턴';
    default:
      return axis;
  }
}

function endingLabel(e: Ending): string {
  switch (e) {
    case 'success':
      return '💘 성공';
    case 'friend':
      return '🤝 친구';
    case 'fail':
      return '💨 실패';
  }
}

function stampMeta(e: Ending): { emoji: string; color: string } {
  switch (e) {
    case 'success':
      return { emoji: '💘', color: '#E53E3E' };
    case 'friend':
      return { emoji: '🤝', color: '#2B6CB0' };
    case 'fail':
      return { emoji: '💨', color: '#718096' };
  }
}

export function ResultReportScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ResultReport'>) {
  const c = useColors();
  const result = route.params.result;
  const episode = episodeById(result.dateId);
  const style = episode.styleInfo[result.styleType] ?? episode.styleInfo['EF'];
  const character = episode.character;
  const now = new Date(result.completedAt);
  const completedCount = useStore((s) => s.totalCompleted);

  // Flutter 900ms AnimationController..forward()
  const ctrl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(ctrl, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <GlowBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24 }}>
          <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' }}>
            <SoundControlButton />
            <ThemeToggleButton />
          </View>

          <DocumentCard
            result={result}
            character={character}
            style={style}
            now={now}
            ctrl={ctrl}
            completedCount={completedCount}
          />

          <View style={{ height: 24 }} />

          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <CoralButton
                label="카드 공유"
                outlined
                onPress={() => navigation.navigate('SnsCard', { result })}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <CoralButton
                label="다음 소개팅"
                onPress={() => navigation.replace('Epilogue', { result })}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GlowBackground>
  );
}

function DocumentCard({
  result,
  character,
  style,
  now,
  ctrl,
  completedCount,
}: {
  result: DateResult;
  character: TDCharacter;
  style: StyleInfo;
  now: Date;
  ctrl: Animated.Value;
  completedCount: number;
}) {
  return (
    <View
      style={{
        backgroundColor: paperBg,
        borderRadius: 4,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <CoverSection result={result} character={character} style={style} now={now} />
      {/* 구분선 */}
      <View style={{ height: 1.5, backgroundColor: paperBorder }} />
      <BodySection
        result={result}
        character={character}
        style={style}
        ctrl={ctrl}
        completedCount={completedCount}
      />
    </View>
  );
}

// ── 표지 영역 ──────────────────────────────────────────────
function CoverSection({
  result,
  character,
  style,
  now,
}: {
  result: DateResult;
  character: TDCharacter;
  style: StyleInfo;
  now: Date;
}) {
  const t = useTextStyles();
  const stamp = stampMeta(result.ending);
  return (
    <View
      style={{
        width: '100%',
        paddingLeft: 28,
        paddingTop: 36,
        paddingRight: 28,
        paddingBottom: 32,
        borderLeftWidth: 1.5,
        borderTopWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: paperBorder,
      }}
    >
      {/* 제목 */}
      <Text
        style={{
          fontFamily: fBold,
          fontSize: t.fs(20),
          color: paperText,
          lineHeight: t.fs(30),
          letterSpacing: -0.3,
          textAlign: 'center',
        }}
      >
        {`「${character.name}」 소개팅 결과보고서`}
      </Text>

      <View style={{ height: 28 }} />

      {/* 불릿 정보 */}
      <BulletRow label="상대방" value={`${character.name} · ${character.age}세 (${character.mbti})`} isHighlight={false} />
      <View style={{ height: 10 }} />
      <BulletRow label="나의 유형" value={`${style.title} ${style.emoji}`} isHighlight />
      <View style={{ height: 10 }} />
      <BulletRow label="소개팅 결과" value={endingLabel(result.ending)} isHighlight={false} />

      <View style={{ height: 36 }} />

      {/* 날짜 */}
      <Text
        style={{
          fontFamily: fRegular,
          fontSize: t.fs(13),
          color: paperSub,
          letterSpacing: 1.5,
          textAlign: 'center',
        }}
      >
        {`${now.getFullYear()}년  ${now.getMonth() + 1}월  ${now.getDate()}일`}
      </Text>

      <View style={{ height: 28 }} />

      {/* 스탬프 영역 */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: fRegular, fontSize: t.fs(13), color: accentBlue }}>TYPE DATE  :</Text>
        <View style={{ width: 40 }} />
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: 2,
            borderColor: stamp.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22 }}>{stamp.emoji}</Text>
        </View>
      </View>

      <View style={{ height: 24 }} />

      {/* 수신인 */}
      <Text
        style={{
          fontFamily: fRegular,
          fontSize: t.fs(13),
          color: paperSub,
          letterSpacing: 2,
          textAlign: 'center',
        }}
      >
        나 귀하
      </Text>
    </View>
  );
}

function BulletRow({
  label,
  value,
  isHighlight,
}: {
  label: string;
  value: string;
  isHighlight: boolean;
}) {
  const t = useTextStyles();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <Text style={{ fontSize: t.fs(13), color: paperText }}>•  </Text>
      <Text style={{ fontFamily: fSemiBold, fontSize: t.fs(13), color: paperText }}>{`${label}  :  `}</Text>
      <Text
        style={{
          flex: 1,
          fontFamily: isHighlight ? fBold : fRegular,
          fontSize: t.fs(13),
          color: isHighlight ? accentBlue : paperText,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── 본문 영역 ──────────────────────────────────────────────
function BodySection({
  result,
  character,
  style,
  ctrl,
  completedCount,
}: {
  result: DateResult;
  character: TDCharacter;
  style: StyleInfo;
  ctrl: Animated.Value;
  completedCount: number;
}) {
  const t = useTextStyles();
  const endingMsg = style.endingMessages[result.ending] ?? '';

  return (
    <View
      style={{
        width: '100%',
        paddingLeft: 28,
        paddingTop: 28,
        paddingRight: 28,
        paddingBottom: 32,
        borderLeftWidth: 1.5,
        borderBottomWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: paperBorder,
      }}
    >
      {/* 1. 성격 유형 분석 */}
      <SectionHeader text="1.  성격 유형 분석" />
      <View style={{ height: 12 }} />
      <AxisOverview result={result} style={style} />
      <View style={{ height: 14 }} />
      <AxisGrid result={result} ctrl={ctrl} />

      <SectionDivider />

      {/* 2. 궁합 */}
      <SectionHeader text="2.  궁합" />
      <View style={{ height: 10 }} />
      <InfoBlock text={`${style.compatibilityStars}  ${style.compatibilityComment}`} />
      <View style={{ height: 12 }} />
      <CompatibilityAxisGrid result={result} character={character} />

      <SectionDivider />

      {/* 3. 잘한 점 */}
      <SectionHeader text="3.  잘한 점" />
      <View style={{ height: 10 }} />
      <InfoBlock text={style.goodPoint} />

      <SectionDivider />

      {/* 4. 아쉬운 점 */}
      <SectionHeader text="4.  아쉬운 점" />
      <View style={{ height: 10 }} />
      <InfoBlock text={style.badPoint} />

      <SectionDivider />

      {/* 5. TYPE DATE 한마디 */}
      <SectionHeader text="5.  TYPE DATE 한마디" />
      <View style={{ height: 10 }} />
      <View
        style={{
          width: '100%',
          padding: 14,
          backgroundColor: '#F0F4FF',
          borderWidth: 1,
          borderColor: '#BFD4F5',
          borderRadius: 4,
        }}
      >
        <Text style={{ fontFamily: fRegular, fontSize: t.fs(13), color: paperText, lineHeight: t.fs(13 * 1.7) }}>
          {endingMsg}
        </Text>
      </View>

      <View style={{ height: 24 }} />

      {/* 진행 현황 */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: fRegular,
            fontSize: t.fs(11),
            color: paperSub,
            letterSpacing: 0.5,
            textAlign: 'center',
          }}
        >
          {`${completedCount} / 16 완료  ·  ${16 - completedCount}명이 기다리고 있어요 👀`}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({ text }: { text: string }) {
  const t = useTextStyles();
  return (
    <Text
      style={{
        fontFamily: fBold,
        fontSize: t.fs(13),
        color: paperText,
        letterSpacing: -0.2,
      }}
    >
      {text}
    </Text>
  );
}

function SectionDivider() {
  return (
    <View style={{ paddingVertical: 18 }}>
      <View style={{ height: 1, backgroundColor: '#DDD8D2' }} />
    </View>
  );
}

function InfoBlock({ text }: { text: string }) {
  const t = useTextStyles();
  return (
    <View
      style={{
        width: '100%',
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#F7F5F2',
        borderLeftWidth: 3,
        borderLeftColor: withAlpha(paperBorder, 0.35),
      }}
    >
      <Text style={{ fontFamily: fRegular, fontSize: t.fs(13), color: paperText, lineHeight: t.fs(13 * 1.7) }}>
        {text}
      </Text>
    </View>
  );
}

function AxisOverview({ result, style }: { result: DateResult; style: StyleInfo }) {
  const t = useTextStyles();
  return (
    <View
      style={{
        width: '100%',
        padding: 14,
        backgroundColor: '#F6F8FF',
        borderWidth: 1,
        borderColor: '#D8E3FF',
        borderRadius: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: accentBlue,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              fontFamily: fBold,
              fontSize: t.fs(12),
              color: '#FFFFFF',
              letterSpacing: 0.8,
            }}
          >
            {axisLetters(result.axisScore)}
          </Text>
        </View>
        <View style={{ width: 8 }} />
        <Text
          style={{
            flex: 1,
            fontFamily: fBold,
            fontSize: t.fs(13),
            color: paperText,
            lineHeight: t.fs(13 * 1.4),
          }}
        >
          {style.title}
        </Text>
      </View>
      <View style={{ height: 10 }} />
      <Text
        style={{
          fontFamily: fRegular,
          fontSize: t.fs(12),
          color: paperSub,
          lineHeight: t.fs(12 * 1.6),
        }}
      >
        {style.summary}
      </Text>
    </View>
  );
}

function AxisGrid({ result, ctrl }: { result: DateResult; ctrl: Animated.Value }) {
  return (
    <View>
      <AxisRow left="E" right="I" result={result} ctrl={ctrl} />
      <View style={{ height: 8 }} />
      <AxisRow left="N" right="S" result={result} ctrl={ctrl} />
      <View style={{ height: 8 }} />
      <AxisRow left="T" right="F" result={result} ctrl={ctrl} />
      <View style={{ height: 8 }} />
      <AxisRow left="J" right="P" result={result} ctrl={ctrl} />
      <View style={{ height: 10 }} />
    </View>
  );
}

function AxisRow({
  left,
  right,
  result,
  ctrl,
}: {
  left: string;
  right: string;
  result: DateResult;
  ctrl: Animated.Value;
}) {
  const t = useTextStyles();
  const l = result.axisScore[left] ?? 0;
  const r = result.axisScore[right] ?? 0;
  const total = l + r === 0 ? 1 : l + r;
  const targetRatio = Math.max(0, Math.min(1, l / total));
  const leftWins = l >= r;
  const leftPercent = Math.round((l / total) * 100);
  const rightPercent = 100 - leftPercent;
  const dominant = leftWins ? left : right;

  // ratio = (l/total)*ctrl + 0.5*(1-ctrl) → 0.5 → targetRatio
  const widthPct = ctrl.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', `${targetRatio * 100}%`],
  });

  const labelStyle = (isWinner: boolean) => ({
    fontFamily: isWinner ? fBold : fMedium,
    fontSize: t.fs(isWinner ? 13 : 12),
    color: isWinner ? accentBlue : withAlpha(paperSub, 0.55),
  });

  return (
    <View
      style={{
        paddingLeft: 10,
        paddingTop: 10,
        paddingRight: 10,
        paddingBottom: 12,
        backgroundColor: '#F9F7F4',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E7E1DA',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            flex: 1,
            fontFamily: fSemiBold,
            fontSize: t.fs(12),
            color: paperText,
          }}
        >
          {axisLabel(left)}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            backgroundColor: withAlpha(accentBlue, 0.08),
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: fBold, fontSize: t.fs(11), color: accentBlue }}>{`${dominant} 우세`}</Text>
        </View>
      </View>

      <View style={{ height: 8 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* 퍼센트 라벨 칸 — 글자가 커지면 칸도 같이 넓혀야 줄바꿈되지 않는다 */}
        <View style={{ width: t.fs(40) }}>
          <Text style={labelStyle(leftWins)}>{`${left}  ${leftPercent}%`}</Text>
        </View>
        <View style={{ width: 8 }} />
        <View
          style={{
            flex: 1,
            height: 10,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: '#E2DDD8',
          }}
        >
          <Animated.View
            style={{
              height: 10,
              width: widthPct,
              backgroundColor: leftWins ? accentBlue : paperBorder,
            }}
          />
        </View>
        <View style={{ width: 8 }} />
        <View style={{ width: t.fs(40) }}>
          <Text style={[labelStyle(!leftWins), { textAlign: 'right' }]}>{`${rightPercent}%  ${right}`}</Text>
        </View>
      </View>
    </View>
  );
}

// ── 나 vs 상대방 성향 비교 ──────────────────────────────────
function CompatibilityAxisGrid({
  result,
  character,
}: {
  result: DateResult;
  character: TDCharacter;
}) {
  const t = useTextStyles();
  const mine = axisLetters(result.axisScore);
  const theirs = character.mbti;
  const matchCount = Array.from({ length: 4 }, (_, i) => mine[i] === theirs[i]).filter(
    (m) => m,
  ).length;

  return (
    <View>
      <Text style={{ fontFamily: fBold, fontSize: t.fs(12), color: accentBlue }}>
        {`나와 ${character.name}, 4개 성향 중 ${matchCount}개 일치`}
      </Text>
      <View style={{ height: 8 }} />
      {axisKeys.map((k, i) => (
        <View key={k}>
          <CompatibilityRow
            label={axisLabel(k)}
            mine={mine[i]}
            theirs={theirs[i]}
            characterName={character.name}
          />
          {i !== axisKeys.length - 1 && <View style={{ height: 6 }} />}
        </View>
      ))}
    </View>
  );
}

function CompatibilityRow({
  label,
  mine,
  theirs,
  characterName,
}: {
  label: string;
  mine: string;
  theirs: string;
  characterName: string;
}) {
  const t = useTextStyles();
  const match = mine === theirs;
  const diffColor = '#B35C00';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: match ? withAlpha(accentBlue, 0.06) : '#F7F5F2',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: match ? withAlpha(accentBlue, 0.3) : '#E7E1DA',
      }}
    >
      {/* 항목 라벨 칸 — 글자가 커지면 칸도 같이 넓혀야 줄바꿈되지 않는다 */}
      <View style={{ width: t.fs(68) }}>
        <Text style={{ fontFamily: fRegular, fontSize: t.fs(11), color: paperSub }}>{label}</Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fSemiBold,
          fontSize: t.fs(12),
          color: paperText,
        }}
      >
        {`나 ${mine}(${letterWords[mine]})  ·  ${characterName} ${theirs}(${letterWords[theirs]})`}
      </Text>
      <Text
        style={{
          fontFamily: fBold,
          fontSize: t.fs(11),
          color: match ? accentBlue : diffColor,
        }}
      >
        {match ? '일치' : '차이'}
      </Text>
    </View>
  );
}
