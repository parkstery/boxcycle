import type { RideMomentSoundKind } from "./rideMoments";

const SOUND_MS: Record<RideMomentSoundKind, { freq: number; dur: number; type: OscillatorType }[]> = {
  start: [{ freq: 523, dur: 0.09, type: "sine" }, { freq: 659, dur: 0.11, type: "sine" }],
  warn: [{ freq: 784, dur: 0.07, type: "triangle" }],
  high: [{ freq: 880, dur: 0.08, type: "sine" }, { freq: 1175, dur: 0.1, type: "sine" }],
  low: [{ freq: 392, dur: 0.12, type: "sine" }],
  finish: [
    { freq: 523, dur: 0.08, type: "sine" },
    { freq: 659, dur: 0.08, type: "sine" },
    { freq: 784, dur: 0.12, type: "sine" },
  ],
  stop: [{ freq: 349, dur: 0.14, type: "sine" }],
};

let sharedCtx: AudioContext | null = null;
let playGeneration = 0;
const liveOscillators = new Set<OscillatorNode>();

function stopLiveOscillators(): void {
  for (const osc of liveOscillators) {
    try { osc.stop(); } catch { /* already stopped */ }
  }
  liveOscillators.clear();
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new Ctor();
    }
    return sharedCtx;
  } catch {
    sharedCtx = null;
    return null;
  }
}

export function cancelRideMomentSound(): void {
  playGeneration += 1;
  stopLiveOscillators();
}

export function playRideMomentSound(kind: RideMomentSoundKind): void {
  if (typeof window === "undefined") return;
  if (window.speechSynthesis?.speaking) return;
  const gen = playGeneration + 1;
  cancelRideMomentSound();
  playGeneration = gen;
  let ctx: AudioContext | null = null;
  try {
    ctx = getContext();
  } catch {
    return;
  }
  if (!ctx) return;
  const notes = SOUND_MS[kind];
  if (!notes) return;
  void ctx.resume().then(() => {
    if (gen !== playGeneration) return;
    let t = ctx.currentTime;
    for (const note of notes) {
      if (gen !== playGeneration) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      liveOscillators.add(osc);
      osc.onended = () => liveOscillators.delete(osc);
      osc.start(t);
      osc.stop(t + note.dur + 0.02);
      t += note.dur * 0.85;
    }
  }).catch(() => {
    /* autoplay / closed context */
  });
}
