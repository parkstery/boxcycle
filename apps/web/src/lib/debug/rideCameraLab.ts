/**
 * 주행 Follow Camera 미세조정(`?camlab=1`) — QC 1–6 제품 파라미터 오버레이.
 * FreeCamera/XYZ 리그를 만들지 않는다. tickRideCameraFollow 가 모듈 상태를 읽어
 * distance·pitch·bearing Δ·look-at/framing 만 덮어쓴다.
 */
import { CAMERA1_AERIAL_DISTANCE_M, type Camera1Mode } from "../camera/camera1Mode";
import { getQuickCameraProductTune } from "../camera/quickCameraProductTune";
import { RIDE_RIDER_SCREEN_ANCHOR } from "../camera/rideCameraFraming";
import {
  RIDE_CAMERA_DISTANCE_MIN_M,
  RIDE_CAMERA_PITCH_CLOSE,
  RIDE_CAMERA_PITCH_MAX,
  resolveRideCameraPitchClose,
} from "../map/mapGlobeView";

export type RideCameraLabQc = 1 | 2 | 3 | 4 | 5 | 6;

export type RideCameraLabState = {
  distanceM: number;
  pitchDeg: number;
  /** getCameraForFollowMode bearing 에 더하는 yaw(°) */
  bearingOffsetDeg: number;
  /** lookAtAlongViewM + anchorBias 에 더하는 전방 오프셋(m) */
  lookAtAlongExtraM: number;
  /** 라이더 화면 세로 자리(위에서부터 비율). 제품 기본 `RIDE_RIDER_SCREEN_ANCHOR` */
  screenAnchor: number;
};

export type RideCameraLabRange = { min: number; max: number; step: number };

export const RIDE_CAMERA_LAB_RANGES: Record<keyof RideCameraLabState, RideCameraLabRange> = {
  distanceM: { min: 1, max: 500, step: 0.5 },
  pitchDeg: { min: 0, max: RIDE_CAMERA_PITCH_MAX, step: 0.5 },
  bearingOffsetDeg: { min: -180, max: 180, step: 0.5 },
  lookAtAlongExtraM: { min: -30, max: 30, step: 0.1 },
  screenAnchor: { min: 0.1, max: 0.9, step: 0.01 },
};

/** `?camlab=1` — DEV 게이트 금지(배포본에서 Chief 확인). */
export function isRideCameraLabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("camlab") === "1";
  } catch {
    return false;
  }
}

function clampToRange(value: number, range: RideCameraLabRange): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}

export function sanitizeRideCameraLabState(input: unknown): RideCameraLabState {
  const o = (input && typeof input === "object" ? input : {}) as Partial<RideCameraLabState>;
  return {
    distanceM: clampToRange(Number(o.distanceM), RIDE_CAMERA_LAB_RANGES.distanceM),
    pitchDeg: clampToRange(Number(o.pitchDeg), RIDE_CAMERA_LAB_RANGES.pitchDeg),
    bearingOffsetDeg: clampToRange(Number(o.bearingOffsetDeg), RIDE_CAMERA_LAB_RANGES.bearingOffsetDeg),
    lookAtAlongExtraM: clampToRange(Number(o.lookAtAlongExtraM), RIDE_CAMERA_LAB_RANGES.lookAtAlongExtraM),
    screenAnchor: clampToRange(Number(o.screenAnchor), RIDE_CAMERA_LAB_RANGES.screenAnchor),
  };
}

/** QC 밀착(2–6) 제품 거리 — App `handleQuickCameraSelect` 와 동일식. */
export function rideCameraLabCloseDistanceM(): number {
  return Math.max(5, RIDE_CAMERA_DISTANCE_MIN_M);
}

/**
 * 현재 제품 고정값으로 슬라이더 초기값.
 * QC1 routeFit 은 follow=free(라 fitBounds)라 틱 오버라이드 대상이 아님 — distanceM=0 표식.
 */
export function productDefaultsForQc(qc: RideCameraLabQc, camera1Mode: Camera1Mode): RideCameraLabState {
  const closePitch = resolveRideCameraPitchClose();
  if (qc === 1) {
    if (camera1Mode === "routeFit") {
      return {
        distanceM: 0,
        pitchDeg: 0,
        bearingOffsetDeg: 0,
        lookAtAlongExtraM: 0,
        screenAnchor: RIDE_RIDER_SCREEN_ANCHOR,
      };
    }
    return {
      distanceM: CAMERA1_AERIAL_DISTANCE_M[camera1Mode],
      pitchDeg: 0,
      bearingOffsetDeg: 0,
      lookAtAlongExtraM: 0,
      screenAnchor: RIDE_RIDER_SCREEN_ANCHOR,
    };
  }
  const baked = getQuickCameraProductTune(qc);
  if (baked) {
    return { ...baked };
  }
  return {
    distanceM: rideCameraLabCloseDistanceM(),
    pitchDeg: closePitch,
    bearingOffsetDeg: 0,
    lookAtAlongExtraM: 0,
    screenAnchor: RIDE_RIDER_SCREEN_ANCHOR,
  };
}

const STORAGE_KEY = "rtw:rideCameraLab:v1";

type StoredLab = {
  byQc: Partial<Record<string, RideCameraLabState>>;
};

export function loadRideCameraLabSlot(qc: RideCameraLabQc, camera1Mode: Camera1Mode): RideCameraLabState {
  const defaults = productDefaultsForQc(qc, camera1Mode);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as StoredLab;
    const key = qc === 1 ? `1:${camera1Mode}` : String(qc);
    const slot = parsed?.byQc?.[key];
    if (!slot) return defaults;
    return sanitizeRideCameraLabState({ ...defaults, ...slot });
  } catch {
    return defaults;
  }
}

export function saveRideCameraLabSlot(
  qc: RideCameraLabQc,
  camera1Mode: Camera1Mode,
  state: RideCameraLabState,
): void {
  try {
    const key = qc === 1 ? `1:${camera1Mode}` : String(qc);
    let parsed: StoredLab = { byQc: {} };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        parsed = JSON.parse(raw) as StoredLab;
        if (!parsed.byQc || typeof parsed.byQc !== "object") parsed = { byQc: {} };
      } catch {
        parsed = { byQc: {} };
      }
    }
    parsed.byQc[key] = sanitizeRideCameraLabState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* 조절판은 선택 도구 — 저장 실패해도 앱은 계속 */
  }
}

/** rAF 가 읽는 활성 오버라이드. null 이면 제품 경로 그대로. */
let rideCameraLabOverride: RideCameraLabState | null = null;
let rideCameraLabQc: RideCameraLabQc | null = null;
let rideCameraLabCamera1Mode: Camera1Mode = "routeFit";

export function setRideCameraLabOverride(
  qc: RideCameraLabQc | null,
  camera1Mode: Camera1Mode,
  state: RideCameraLabState | null,
): void {
  rideCameraLabQc = qc;
  rideCameraLabCamera1Mode = camera1Mode;
  if (qc == null || state == null) {
    rideCameraLabOverride = null;
    return;
  }
  // routeFit 은 free — 틱이 early return. 오버라이드 비활성.
  if (qc === 1 && camera1Mode === "routeFit") {
    rideCameraLabOverride = null;
    return;
  }
  rideCameraLabOverride = sanitizeRideCameraLabState(state);
}

export function getRideCameraLabOverride(): RideCameraLabState | null {
  if (!isRideCameraLabEnabled()) return null;
  return rideCameraLabOverride;
}

export function getRideCameraLabActiveMeta(): {
  qc: RideCameraLabQc | null;
  camera1Mode: Camera1Mode;
} {
  return { qc: rideCameraLabQc, camera1Mode: rideCameraLabCamera1Mode };
}

/** 「값 복사」 — 상수 반영용 한 덩어리. */
export function formatRideCameraLabCodePaste(
  qc: RideCameraLabQc,
  camera1Mode: Camera1Mode,
  state: RideCameraLabState,
): string {
  const s = sanitizeRideCameraLabState(state);
  const f1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const f2 = (n: number) => n.toFixed(2);
  const lines = [
    `QC${qc}${qc === 1 ? ` ${camera1Mode}` : ""}`,
    `distanceM: ${f1(s.distanceM)}`,
    `pitchDeg: ${f1(s.pitchDeg)}`,
    `bearingOffsetDeg: ${f1(s.bearingOffsetDeg)}`,
    `lookAtAlongExtraM: ${f1(s.lookAtAlongExtraM)}`,
    `screenAnchor: ${f2(s.screenAnchor)}`,
    `// bake hints:`,
    `// distance → CAMERA1_AERIAL_DISTANCE_M or QC close max(5,MIN) / rideCameraDistanceM`,
    `// pitch → RIDE_CAMERA_PITCH_CLOSE (product ${RIDE_CAMERA_PITCH_CLOSE})`,
    `// bearingOffset → getCameraForFollowMode bearing`,
    `// lookAtAlongExtra / screenAnchor → rideCameraFraming (RIDE_RIDER_SCREEN_ANCHOR=${RIDE_RIDER_SCREEN_ANCHOR})`,
  ];
  return lines.join("\n");
}
