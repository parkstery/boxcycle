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

/**
 * 인터벌 코칭용 — 별도 선택 없이 가장 자연스러운 영어 음성(2026-11-03 Chief).
 * 브라우저마다 고품질 음성 이름이 다르다: Edge 「… Online (Natural)」, Chrome 「Google US English」,
 * iOS·macOS 「… (Enhanced/Premium)」·Samantha, Android 「… network」. 구식·압축 음성(eSpeak·compact)은 뒤로.
 * 주행 코칭(pickEnVoice)은 그대로 둔다(Chief: 「주행 코칭은 현재 상태를 유지」).
 */
export function naturalEnVoiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">): number {
  const lang = (v.lang || "").toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -Infinity;
  const name = (v.name || "").toLowerCase();
  let s = lang === "en-us" ? 30 : lang === "en-gb" || lang === "en-au" || lang === "en-ca" ? 20 : 10;
  if (name.includes("natural")) s += 100;
  if (name.includes("neural")) s += 90;
  if (name.includes("premium")) s += 80;
  if (name.includes("enhanced")) s += 70;
  if (name.includes("google")) s += 60;
  if (name.includes("online")) s += 40;
  if (name.includes("network")) s += 40;
  if (/\b(samantha|ava|allison|susan|zoe|karen|daniel|serena)\b/.test(name)) s += 25;
  if (v.localService === false) s += 5;
  if (name.includes("espeak") || name.includes("compact") || name.includes("novelty")) s -= 200;
  if (/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy)\b/.test(name)) s -= 200;
  return s;
}

export function pickNaturalEnVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const score = naturalEnVoiceScore(v);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** 인터벌 코칭 읽기 — 영어 문구를 자연스러운 영어 음성으로. */
export function speakIntervalCoachText(text: string): void {
  speakRideText(text, "en-US", pickNaturalEnVoice);
}

/** 코칭·격려 멘트 읽기. `setRideTtsEnabled(false)` 이면 무음. */
export function speakRideText(
  text: string,
  language = "en-US",
  pickVoice?: (voices: readonly SpeechSynthesisVoice[]) => SpeechSynthesisVoice | null,
): void {
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
    u.lang = language;
    const voice = pickVoice
      ? pickVoice(synth.getVoices())
      : language.startsWith("ko")
        ? synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ko"))
        : pickEnVoice(synth);
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
