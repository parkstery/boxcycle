import { FALLBACK_TIPS } from "../../services/phraseManifest";

/**
 * HUD·배너용 코칭 문구 한국어 표시. TTS·phraseManifest 의 영문 tip 텍스트는 그대로 둔다.
 * tip_0 … tip_31 — FALLBACK_TIPS 와 동일 순서(phraseManifest.ts).
 */
const COACHING_TIPS_DISPLAY_KO: readonly string[] = [
  "등을 펴고 힘을 빼세요. 언덕이 알아서 올라올 거예요.",
  "코어를 잡아요. 몸이 통통 튀지 않게 해요.",
  "일어서서 밟아요. 선을 지키며 밀어 올려요.",
  "최대로 쏘세요. 라인을 놓치지 마세요.",
  "골반을 고정해요. 다리가 일하게 해요.",
  "깊게 숨 쉬고 길게 내쉬어요.",
  "페달 전체에 고르게 힘을 줘요.",
  "마음은 가볍게, 다리는 단단하게 가요.",
  "아래로 숨을 내리며 가요.",
  "숨을 가다듬은 다음 속도를 올려요.",
  "호흡이 안정되면 다리도 따라올 거예요.",
  "와트를 아껴요. 효율적으로 달려요.",
  "손에 힘을 빼요. 손등이 하얗게 눌리지 않게 해요.",
  "출력을 줄이고 리듬을 찾아요.",
  "자리를 잡아요. 이 구간은 꽤 길어요.",
  "서두르지 마세요. 똑똑하게 가요.",
  "팔꿈치를 부드럽게 두세요. 상체는 조용히 가요.",
  "동그랗게 돌려요. 밟아 찧지 마세요.",
  "발끝은 가볍게, 케이던스는 빠르게 가요.",
  "케이던스를 유지해요. 속도는 신경 쓰지 마세요.",
  "시선은 앞으로. 라인이 깨끗하게 이어져요.",
  "여기서 페달을 띄워 보세요.",
  "리듬이 몸을 이끌게 해요.",
  "속도는 일정하게, 동작은 부드럽게 가요.",
  "가볍게 돌려요. 다리를 쉬게 해요.",
  "힘을 빼고 숨을 고르세요.",
  "다리에 힘을 빼요. 몸을 느슨하게 해요.",
  "중력이 도와줄 거예요.",
  "중력이 도와줄 거예요.",
  "지금 집중해요. 앞으로 자유로운 속도가 있어요.",
  "몸을 낮추고 미끄러지듯 가요.",
  "가볍게 돌리며 즐겨요.",
];

export function coachingTipDisplayKo(tipId: string | undefined, fallbackEnglish: string): string {
  // Fresh-tip rotation can retain the previous tipId; the actual displayed text wins.
  const text = fallbackEnglish.replace(/\s*\(R\d+\)\s*$/, "").trim();
  const currentIndex = FALLBACK_TIPS.indexOf(text);
  if (currentIndex >= 0) return COACHING_TIPS_DISPLAY_KO[currentIndex]!;
  if (!tipId?.startsWith("tip_")) return fallbackEnglish.replace(/\s*\(R\d+\)\s*$/, "").trim();
  const idx = Number.parseInt(tipId.slice(4), 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= COACHING_TIPS_DISPLAY_KO.length) {
    return fallbackEnglish.replace(/\s*\(R\d+\)\s*$/, "").trim();
  }
  return COACHING_TIPS_DISPLAY_KO[idx]!;
}
