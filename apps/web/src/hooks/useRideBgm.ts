import { useEffect, useRef } from "react";
import {
  BG_MUSIC_ADVANCE_DEBOUNCE_MS,
  BG_MUSIC_ERROR_SUPPRESS_MS,
  BG_MUSIC_FADE_IN_TARGET,
  BG_MUSIC_FADE_MS,
  BG_MUSIC_NEAR_END_SEC,
  BG_MUSIC_WATCHDOG_MS,
  RIDE_BGM_PLAYLIST,
} from "../lib/rideBgmConstants";

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onDone?: () => void,
): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / durationMs);
    const v = from + (to - from) * u;
    audio.volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : to));
    if (u < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

function nextShuffleIndex(len: number, avoid: number): number {
  if (len <= 1) return 0;
  let n = Math.floor(Math.random() * len);
  let guard = 0;
  while (n === avoid && guard < 8) {
    n = Math.floor(Math.random() * len);
    guard += 1;
  }
  return n;
}

/**
 * 주행 세션 중 BGM 단일 `<audio>` 재생.
 * 세션 시작·곡 종료마다 `nextShuffleIndex`로 랜덤 다음 곡.
 * URL은 `VITE_RIDE_BGM_PLAYLIST_JSON` 우선, 없거나 비면 `RIDE_BGM_BUILTIN_PLAYLIST`.
 */
export function useRideBgm(opts: {
  /** idle 이 아닐 때 */
  sessionActive: boolean;
  musicEnabled: boolean;
  playlist?: readonly string[];
}): void {
  const playlist = opts.playlist ?? RIDE_BGM_PLAYLIST;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const fadeStopRef = useRef<(() => void) | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nearEndHandledRef = useRef(false);
  const lastErrorAtRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const musicEnabledRef = useRef(false);
  sessionActiveRef.current = opts.sessionActive;
  musicEnabledRef.current = opts.musicEnabled;

  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.hidden) {
        a.pause();
        return;
      }
      if (sessionActiveRef.current && musicEnabledRef.current && playlist.length > 0) {
        void a.play().catch(() => {
          /* autoplay 정책 등 */
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playlist.length]);

  useEffect(() => {
    if (!opts.sessionActive || !opts.musicEnabled || playlist.length === 0) {
      const a = audioRef.current;
      if (a) {
        fadeStopRef.current?.();
        fadeStopRef.current = fadeVolume(
          a,
          Math.min(1, Math.max(0, a.volume)),
          0,
          Math.min(BG_MUSIC_FADE_MS, 800),
          () => {
            a.pause();
            a.removeAttribute("src");
            a.load();
          },
        );
      }
      if (advanceTimerRef.current != null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      if (watchdogRef.current != null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      nearEndHandledRef.current = false;
      return () => {
        fadeStopRef.current?.();
        fadeStopRef.current = null;
      };
    }

    const audio =
      audioRef.current ??
      (() => {
        const el = new Audio();
        el.preload = "auto";
        /* Dropbox 등 외부 MP3: crossOrigin 을 쓰면 CORS 실패 시 decode/play 가 막힌다(Web Audio 미사용이므로 불필요). */
        audioRef.current = el;
        return el;
      })();

    let cancelled = false;
    let cancelFade: (() => void) | null = null;

    const clearAdvance = () => {
      if (advanceTimerRef.current != null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };

    const clearWatchdog = () => {
      if (watchdogRef.current != null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    const armWatchdog = () => {
      clearWatchdog();
      watchdogRef.current = window.setInterval(() => {
        if (cancelled || audio.paused || !audio.src) return;
        if (audio.currentTime > 0 && audio.duration > 0 && !audio.ended) {
          const remain = audio.duration - audio.currentTime;
          if (remain > 2 && audio.readyState >= 2 && audio.buffered.length > 0) {
            const end = audio.buffered.end(audio.buffered.length - 1);
            if (end - audio.currentTime < 0.25) {
              audio.dispatchEvent(new Event("ended"));
            }
          }
        }
      }, BG_MUSIC_WATCHDOG_MS);
    };

    const loadAndPlay = (url: string) => {
      nearEndHandledRef.current = false;
      clearAdvance();
      cancelFade?.();
      audio.pause();
      audio.src = url;
      audio.volume = 0;
      void audio
        .play()
        .then(() => {
          cancelFade = fadeVolume(audio, 0, BG_MUSIC_FADE_IN_TARGET, BG_MUSIC_FADE_MS);
          armWatchdog();
        })
        .catch(() => {
          const now = Date.now();
          if (now - lastErrorAtRef.current < BG_MUSIC_ERROR_SUPPRESS_MS) return;
          lastErrorAtRef.current = now;
        });
    };

    const advance = () => {
      if (cancelled || playlist.length === 0) return;
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        if (cancelled) return;
        indexRef.current = nextShuffleIndex(playlist.length, indexRef.current);
        loadAndPlay(playlist[indexRef.current]!);
      }, BG_MUSIC_ADVANCE_DEBOUNCE_MS);
    };

    const onEnded = () => advance();
    const onMediaError = () => {
      if (cancelled || playlist.length === 0) return;
      const now = Date.now();
      if (now - lastErrorAtRef.current < BG_MUSIC_ERROR_SUPPRESS_MS) return;
      lastErrorAtRef.current = now;
      advance();
    };
    const onTimeUpdate = () => {
      if (nearEndHandledRef.current || !audio.duration) return;
      const remain = audio.duration - audio.currentTime;
      if (remain <= BG_MUSIC_NEAR_END_SEC && remain > 0) {
        nearEndHandledRef.current = true;
        advance();
      }
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onMediaError);
    audio.addEventListener("timeupdate", onTimeUpdate);

    indexRef.current = nextShuffleIndex(playlist.length, indexRef.current);
    loadAndPlay(playlist[indexRef.current]!);

    return () => {
      cancelled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onMediaError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      clearAdvance();
      clearWatchdog();
      cancelFade?.();
      cancelFade = null;
      fadeVolume(audio, Math.min(1, Math.max(0, audio.volume)), 0, Math.min(BG_MUSIC_FADE_MS, 800), () => {
        audio.pause();
      });
    };
  }, [opts.sessionActive, opts.musicEnabled, playlist]);
}
