/**
 * 라이더 조명 조절판(`?lightlab=1`, 지시02) — UI 전용 설정.
 * 광원 참조·강도 반영은 `preservedRiderLayer.ts` 가 맡는다(구조 변경 없음). 이 파일은
 * 슬라이더 범위·프리셋 값·URL 게이트·localStorage 영속화·「값 복사」 텍스트만 다룬다.
 */
import {
  RIDER_LIGHT_LAB_DEFAULT_STATE,
  riderLightLabKeyPosition,
  type RiderLightLabState,
} from "./preservedRiderLayer";

export type { RiderLightLabState };
export { RIDER_LIGHT_LAB_DEFAULT_STATE };

/**
 * ⚠ `import.meta.env.DEV` 로 막지 않는다 — Chief 는 배포본(`boxcycle-dc2df.web.app`)에서
 * 테스트한다. URL 쿼리 `?lightlab=1` 이 없으면 패널을 아예 렌더하지 않는다(일반 사용자 흔적 없음).
 */
export function isRiderLightLabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("lightlab") === "1";
  } catch {
    return false;
  }
}

export type RiderLightLabRange = { min: number; max: number; step: number };

export const RIDER_LIGHT_LAB_RANGES: Record<keyof RiderLightLabState, RiderLightLabRange> = {
  ambient: { min: 0, max: 3, step: 0.05 },
  hemisphere: { min: 0, max: 3, step: 0.05 },
  keyIntensity: { min: 0, max: 4, step: 0.05 },
  keyAzimuthDeg: { min: 0, max: 360, step: 1 },
  keyElevationDeg: { min: 0, max: 90, step: 1 },
};

function clampToRange(value: number, range: RiderLightLabRange): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}

export function sanitizeRiderLightLabState(input: unknown): RiderLightLabState {
  const o = (input && typeof input === "object" ? input : {}) as Partial<RiderLightLabState>;
  return {
    ambient: clampToRange(Number(o.ambient), RIDER_LIGHT_LAB_RANGES.ambient),
    hemisphere: clampToRange(Number(o.hemisphere), RIDER_LIGHT_LAB_RANGES.hemisphere),
    keyIntensity: clampToRange(Number(o.keyIntensity), RIDER_LIGHT_LAB_RANGES.keyIntensity),
    keyAzimuthDeg: clampToRange(Number(o.keyAzimuthDeg), RIDER_LIGHT_LAB_RANGES.keyAzimuthDeg),
    keyElevationDeg: clampToRange(Number(o.keyElevationDeg), RIDER_LIGHT_LAB_RANGES.keyElevationDeg),
  };
}

/**
 * 프리셋 4종 — Key 방향(방위각·고도각)은 기본값 유지, 강도만 바꾼다.
 * 값은 실제로 화면을 보고 정했다(캡처 근거: `document/ops/20260924-camera-qc/.out/jisi02/`).
 */
export type RiderLightLabPresetName = "기본" | "진한 색" | "입체" | "평평";

export const RIDER_LIGHT_LAB_PRESET_NAMES: readonly RiderLightLabPresetName[] = [
  "기본",
  "진한 색",
  "입체",
  "평평",
];

export const RIDER_LIGHT_LAB_PRESETS: Record<RiderLightLabPresetName, RiderLightLabState> = {
  "기본": { ...RIDER_LIGHT_LAB_DEFAULT_STATE },
  "진한 색": {
    ...RIDER_LIGHT_LAB_DEFAULT_STATE,
    ambient: 0.9,
    hemisphere: 1.2,
    keyIntensity: 1.6,
  },
  "입체": {
    ...RIDER_LIGHT_LAB_DEFAULT_STATE,
    ambient: 0.55,
    hemisphere: 0.9,
    keyIntensity: 3.4,
  },
  "평평": {
    ...RIDER_LIGHT_LAB_DEFAULT_STATE,
    ambient: 2.4,
    hemisphere: 2.4,
    keyIntensity: 0.7,
  },
};

const STORAGE_KEY = "rtw:riderLightLab:v1";

export function loadRiderLightLabState(): RiderLightLabState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...RIDER_LIGHT_LAB_DEFAULT_STATE };
    return sanitizeRiderLightLabState(JSON.parse(raw));
  } catch {
    return { ...RIDER_LIGHT_LAB_DEFAULT_STATE };
  }
}

export function saveRiderLightLabState(state: RiderLightLabState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 실패해도 앱이 죽지 않게 — 조절판은 선택 도구일 뿐 */
  }
}

/** 「값 복사」 — 코드에 그대로 붙여넣을 형태(지시02 §4 예시와 동일 포맷). */
export function formatRiderLightLabCodePaste(state: RiderLightLabState): string {
  const pos = riderLightLabKeyPosition(state);
  const i2 = (n: number) => n.toFixed(2);
  const p1 = (n: number) => n.toFixed(1);
  return [
    `AmbientLight(0xffffff, ${i2(state.ambient)})`,
    `HemisphereLight(0xdcecff, 0x657080, ${i2(state.hemisphere)})`,
    `DirectionalLight(0xffffff, ${i2(state.keyIntensity)}) · position(${p1(pos.x)}, ${p1(pos.y)}, ${p1(pos.z)})`,
  ].join("\n");
}
