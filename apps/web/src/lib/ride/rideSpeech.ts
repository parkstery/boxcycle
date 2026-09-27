/**
 * Web Speech API — 코칭·브리핑 공용. BGM 과 별도 파이프라인.
 * cycle `speak` / `safeSpeechCancel` 패턴 축약.
 */

let speechRequestId = 0;
let speechStartTimeout: ReturnType<typeof setTimeout> | null = null;
const ttsEnabledRef = { current: true };

export function setRideTtsEnabled(enabled: boolean): void {
  ttsEnabledRef.current = enabled;
  if (!enabled) safeRideSpeechCancel();
}

export function getRideTtsEnabled(): boolean {
  return ttsEnabledRef.current;
}

function getSpeechSynthesisSafe(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

export function safeRideSpeechCancel(): void {
  if (speechStartTimeout != null) {
    window.clearTimeout(speechStartTimeout);
    speechStartTimeout = null;
  }
  const synth = getSpeechSynthesisSafe();
  try {
    synth?.cancel();
  } catch {
    /* noop */
  }
}

function pickEnVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  const prefer = (v: SpeechSynthesisVoice) => {
    const lang = (v.lang || "").toLowerCase();
    const name = (v.name || "").toLowerCase();
    return (
      lang.startsWith("en") &&
      (name.includes("female") || name.includes("google us english") || name.includes("samantha"))
    );
  };
  return voices.find(prefer) ?? voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")) ?? null;
}

/** 코칭·격려 멘트 읽기. `setRideTtsEnabled(false)` 이면 무음. */
export function speakRideText(text: string): void {
  if (!ttsEnabledRef.current) return;
  const normalized = (text || "").trim();
  if (!normalized) return;

  const requestId = ++speechRequestId;
  safeRideSpeechCancel();

  const synth = getSpeechSynthesisSafe();
  if (!synth) return;

  speechStartTimeout = window.setTimeout(() => {
    speechStartTimeout = null;
    if (speechRequestId !== requestId) return;
    const u = new SpeechSynthesisUtterance(normalized);
    u.lang = "en-US";
    const voice = pickEnVoice(synth);
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onstart = () => {
      if (speechRequestId !== requestId) synth.cancel();
    };
    u.onerror = () => {
      /* noop */
    };
    try {
      synth.speak(u);
    } catch {
      /* noop */
    }
  }, 50);
}

export function installRideSpeechVoicesListener(): () => void {
  const synth = getSpeechSynthesisSafe();
  if (!synth) return () => {};
  const onVoices = () => {
    void synth.getVoices();
  };
  synth.addEventListener("voiceschanged", onVoices);
  onVoices();
  return () => synth.removeEventListener("voiceschanged", onVoices);
}
