import { BlindDate, ChatLine, DateResult } from '../types';
import { FinalEnding, NoMatchEnding, femaleFinalEndings, femaleNoMatchEnding } from './finalEndings';
import { maleFinalEndings, maleNoMatchEnding } from './male/finalEndings';
import { lineForDateId } from './index';

// 16화 완주 후 최종 에필로그 — 가장 잘 맞았던 상대와 연애를 시작하는 마무리 스토리.
// 대본은 상대별로 따로 있다(여자 라인 finalEndings.ts / 남자 라인 male/finalEndings.ts).

export interface FinalMatch {
  episode: BlindDate;
  result: DateResult;
}

const ENDING_RANK: Record<string, number> = { success: 2, friend: 1, fail: 0 };

/// 완료된 결과 중 최고 매칭 상대 선정 — 엔딩 등급(success > friend > fail) 우선,
/// 동률이면 호감도 높은 쪽, 그래도 같으면 먼저 만난 사람.
export function pickBestMatch(
  episodes: BlindDate[],
  results: Record<string, DateResult>,
): FinalMatch | null {
  let best: FinalMatch | null = null;
  let bestIndex = -1;
  episodes.forEach((episode, i) => {
    const result = results[episode.id];
    if (result == null) return;
    if (best == null) {
      best = { episode, result };
      bestIndex = i;
      return;
    }
    const a = ENDING_RANK[result.ending] ?? 0;
    const b = ENDING_RANK[best.result.ending] ?? 0;
    const better =
      a > b ||
      (a === b &&
        (result.likeScore > best.result.likeScore ||
          (result.likeScore === best.result.likeScore && i < bestIndex)));
    if (better) {
      best = { episode, result };
      bestIndex = i;
    }
  });
  return best;
}

/// 상대별 최종 엔딩 — 두 라인 합본. dateId는 라인 간 유일하다.
const finalEndingsByDateId: Record<string, FinalEnding> = {
  ...femaleFinalEndings,
  ...maleFinalEndings,
};

export function finalEndingFor(match: FinalMatch): FinalEnding {
  return finalEndingsByDateId[match.episode.id];
}

/// 열여섯 명 전부와 fail로 끝났는지 — pickBestMatch가 엔딩 등급 우선으로 뽑으므로
/// 최고 매칭이 fail이면 나머지도 전부 fail이다.
export function isNoMatch(match: FinalMatch): boolean {
  return match.result.ending === 'fail';
}

export function noMatchEndingFor(match: FinalMatch): NoMatchEnding {
  return lineForDateId(match.episode.id) === 'male' ? maleNoMatchEnding : femaleNoMatchEnding;
}

/// 최종 에필로그 카톡 대본 — 상대가 먼저 연락해 소개팅이 아닌 진짜 만남을 제안한다.
/// 전원 fail이면 상대 대신 주선자 친구와의 마무리 대화가 재생된다.
/// 본편과 동일하게 "{name}씨" 토큰을 사용자 이름으로 치환한다.
export function buildFinalEpilogueLines(match: FinalMatch, userName: string): ChatLine[] {
  const trimmed = userName.trim();
  const callName = trimmed.length === 0 ? '그쪽' : `${trimmed}씨`;
  const source = isNoMatch(match) ? noMatchEndingFor(match).lines : finalEndingFor(match).lines;
  return source.map((line) => ({
    ...line,
    text: line.text.split('{name}씨').join(callName),
  }));
}
