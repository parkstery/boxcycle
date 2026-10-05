/**
 * 추정 kcal SoT — gross MET × 체중 × 실제 활동시간.
 * 거리(km)×30 은 신규 세션에서 쓰지 않는다. 체중 가정(70kg) 금지.
 */

export const CALORIES_METHOD_VERSION = "MET-gross-v1" as const;

export const WEIGHT_KG_MIN = 30;
export const WEIGHT_KG_MAX = 300;

export const CALORIE_INTENSITY_OPTIONS = [
  { id: "light", label: "가벼움", met: 4 },
  { id: "moderate", label: "보통", met: 6 },
  { id: "hard", label: "강함", met: 8 },
] as const;

export type CalorieIntensityId = (typeof CALORIE_INTENSITY_OPTIONS)[number]["id"];

export type CaloriesEstimateMeta = {
  version: typeof CALORIES_METHOD_VERSION;
  met: number;
  activeSec: number;
  inputMethod: "cadence";
  estimated: true;
  /** 세션 중 센서 일시 끊김으로 활동초 증가가 빈 구간이 있었음 */
  signalGap: boolean;
};

/** 세션 시작 시 고정 — 주행 중 설정 변경은 다음 주행부터 */
export type CalorieSessionSnapshot = {
  weightKg: number | null;
  met: number | null;
  intensityId: CalorieIntensityId | null;
};

export function parseWeightKg(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  // boolean → Number(true)=1 등 암시 변환 금지
  if (typeof raw === "boolean") return null;
  if (typeof raw === "object") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n < WEIGHT_KG_MIN || n > WEIGHT_KG_MAX) return null;
  return n;
}

/**
 * 활동초는 벽시계 elapsed 를 넘을 수 없다(타이머 드리프트·이중 누적 경계).
 * null(센서 미연결)은 그대로.
 */
export function clampActiveSecForCalories(
  activeSec: number | null | undefined,
  elapsedSec: number,
): number | null {
  if (activeSec == null) return null;
  const active = Number(activeSec);
  if (!Number.isFinite(active) || active < 0) return null;
  const elapsed = Math.max(0, Math.floor(Number(elapsedSec) || 0));
  return Math.min(Math.round(active), elapsed);
}

/** Firestore·로컬 meta 공통 파서. version/NaN 불일치 → null. */
export function parseCaloriesMeta(raw: unknown): CaloriesEstimateMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== CALORIES_METHOD_VERSION) return null;
  const met = Number(o.met);
  const activeSec = Number(o.activeSec);
  if (!Number.isFinite(met) || met <= 0 || !Number.isFinite(activeSec) || activeSec < 0) {
    return null;
  }
  return {
    version: CALORIES_METHOD_VERSION,
    met,
    activeSec: Math.round(activeSec),
    inputMethod: "cadence",
    estimated: true,
    signalGap: Boolean(o.signalGap),
  };
}

export function parseCalorieIntensityId(raw: unknown): CalorieIntensityId | null {
  if (raw === "light" || raw === "moderate" || raw === "hard") return raw;
  return null;
}

export function resolveMet(intensityId: CalorieIntensityId | null | undefined): number | null {
  if (!intensityId) return null;
  const hit = CALORIE_INTENSITY_OPTIONS.find((o) => o.id === intensityId);
  return hit ? hit.met : null;
}

/**
 * gross kcal = MET × weightKg × activeSec/3600.
 * activeSec null = 케이던스 센서 미연결(측정 불가) → null.
 * weight/met 없으면 null(임의 체중·강도 추정 금지).
 * activeSec 0 + 입력 완료 → 0 (정지·미페달, 진짜 0).
 */
export function estimateGrossKcal(input: {
  weightKg: number | null | undefined;
  met: number | null | undefined;
  activeSec: number | null | undefined;
}): number | null {
  const weightKg = parseWeightKg(input.weightKg);
  const met = typeof input.met === "number" && Number.isFinite(input.met) && input.met > 0
    ? input.met
    : null;
  if (weightKg == null || met == null) return null;
  if (input.activeSec == null) return null;
  const activeSec = Number(input.activeSec);
  if (!Number.isFinite(activeSec) || activeSec < 0) return null;
  const kcal = met * weightKg * (activeSec / 3600);
  return Math.round(kcal);
}

export function buildCaloriesMeta(input: {
  met: number;
  activeSec: number;
  signalGap: boolean;
}): CaloriesEstimateMeta {
  return {
    version: CALORIES_METHOD_VERSION,
    met: input.met,
    activeSec: Math.max(0, Math.round(input.activeSec)),
    inputMethod: "cadence",
    estimated: true,
    signalGap: Boolean(input.signalGap),
  };
}

export function formatCaloriesEstimateLabel(kcal: number | null | undefined): string {
  if (kcal == null) return "—";
  const n = Number(kcal);
  if (!Number.isFinite(n) || n < 0) return "—";
  return String(Math.round(n));
}

/** legacy(method 없음) vs MET-gross-v1 구분 */
export function isLegacyDistanceCalories(
  session: { caloriesEstimate?: number | null; caloriesMeta?: CaloriesEstimateMeta | null },
): boolean {
  if (session.caloriesEstimate == null) return false;
  return session.caloriesMeta?.version !== CALORIES_METHOD_VERSION;
}
