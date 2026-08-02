import { useEffect } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useStore } from '../state/store';

// 채팅 연출용 사운드 — 메시지 도착음(1회), "입력 중" 타이핑음(반복).
// 플레이어는 앱 전체에서 하나씩만 만들어 재사용한다(메시지가 빠르게 이어져도 새로 로드하지 않게).
// 소리는 어디까지나 부가 연출이므로, 재생 실패가 대화 진행을 막지 않도록 전부 조용히 삼킨다.

/// 타이핑음은 계속 깔리는 소리라 도착음보다 낮게 — 효과음 볼륨에 곱해서 쓴다.
const TYPING_RELATIVE = 0.5;

let messagePlayer: AudioPlayer | null = null;
let typingPlayer: AudioPlayer | null = null;

function messageSound(): AudioPlayer | null {
  if (messagePlayer == null) {
    try {
      messagePlayer = createAudioPlayer(require('../../assets/sound/message_done.mp3'));
    } catch {
      return null;
    }
  }
  return messagePlayer;
}

function typingSound(): AudioPlayer | null {
  if (typingPlayer == null) {
    try {
      typingPlayer = createAudioPlayer(require('../../assets/sound/typing_loop.mp3'));
      typingPlayer.loop = true;
    } catch {
      return null;
    }
  }
  return typingPlayer;
}

/// 효과음에 실제로 적용할 볼륨 — 음소거면 0.
function effectVolume(): number {
  const s = useStore.getState();
  return s.soundMuted ? 0 : s.sfxVolume;
}

/// 말풍선이 실제로 새로 도착하는 순간에만 호출 — 시스템 안내/독백에는 쓰지 않는다.
export function playMessageSound() {
  const volume = effectVolume();
  if (volume <= 0) return;
  const p = messageSound();
  if (p == null) return;
  try {
    p.volume = volume;
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // 무시
  }
}

/// "입력 중..." 표시가 떠 있는 동안만 반복 재생.
export function useTypingSound() {
  useEffect(() => {
    const volume = effectVolume() * TYPING_RELATIVE;
    if (volume <= 0) return;
    const p = typingSound();
    if (p == null) return;
    try {
      p.volume = volume;
      void p.seekTo(0).catch(() => {});
      p.play();
    } catch {
      // 무시
    }
    return () => {
      try {
        p.pause();
      } catch {
        // 무시
      }
    };
  }, []);
}
