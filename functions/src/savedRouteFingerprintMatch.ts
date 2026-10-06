/**
 * 퍼블릭 신청 ↔ 저장 경로 지문 대조(순수 판정).
 *
 * 저장 문서의 `routeFingerprint` 필드는 규칙 변경 이전에 옛 방식(좌표열 해시)으로
 * 쓰여 있을 수 있다. 저장값을 그대로 비교하면 같은 geometry 도 항상 불일치한다.
 * 클라 `findExistingSavedRouteByFingerprint` 와 같이 **geometry 로 지금 규칙을
 * 재계산**해 대조한다.
 */
import {
  computeRouteFingerprintHex,
  resolveRouteProfile,
  type LngLat,
} from "./routeFingerprintCore.js";

export const SAVED_ROUTE_SHAPE_MISMATCH_REASON =
  "저장된 경로와 신청한 경로의 모양이 다릅니다. 내 경로에서 다시 선택해 신청하세요.";

export const SAVED_ROUTE_GEOMETRY_UNREADABLE_REASON =
  "저장된 경로의 좌표를 확인할 수 없습니다. 내 경로에서 다시 선택해 신청하세요.";

export type SavedRouteFingerprintMatchInput = {
  /** 신청 geometry 로 지금 규칙으로 계산한 지문 */
  applicantFingerprint: string;
  /** 저장 문서의 routeFingerprint(64자 hex) — 없거나 형식이 아니면 null */
  savedRouteFingerprint: string | null;
  geometryCoordsJson: unknown;
  geometry: unknown;
  profile: unknown;
};

export type SavedRouteFingerprintMatchResult =
  | { ok: true; needsBackfill: boolean }
  | { ok: false; reason: string };

/** Firestore savedRoutes 문서에서 좌표열을 복원(geometryCoordsJson 우선). */
export function decodeSavedRouteCoords(input: {
  geometryCoordsJson: unknown;
  geometry: unknown;
}): LngLat[] | null {
  const json = input.geometryCoordsJson;
  if (typeof json === "string" && json.length > 0) {
    try {
      const coords = JSON.parse(json) as unknown;
      if (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        coords.every(
          (c) =>
            Array.isArray(c) &&
            c.length === 2 &&
            typeof c[0] === "number" &&
            typeof c[1] === "number" &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1]),
        )
      ) {
        return coords as LngLat[];
      }
    } catch {
      /* fallthrough */
    }
  }
  const legacy = input.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (legacy?.type === "LineString" && Array.isArray(legacy.coordinates)) {
    const c = legacy.coordinates as unknown[];
    if (
      c.length >= 2 &&
      c.every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          typeof p[0] === "number" &&
          typeof p[1] === "number" &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]),
      )
    ) {
      return c as LngLat[];
    }
  }
  return null;
}

/**
 * 저장 경로 문서와 신청 지문이 같은 경로인지 판정한다.
 * 통과 + 저장값이 재계산과 다르면 `needsBackfill: true`(호출 측이 필드만 갱신).
 */
export function matchSavedRouteFingerprint(
  input: SavedRouteFingerprintMatchInput,
): SavedRouteFingerprintMatchResult {
  const coords = decodeSavedRouteCoords(input);
  if (!coords) {
    const stored = input.savedRouteFingerprint;
    if (stored && stored.length === 64 && stored === input.applicantFingerprint) {
      return { ok: true, needsBackfill: false };
    }
    return { ok: false, reason: SAVED_ROUTE_GEOMETRY_UNREADABLE_REASON };
  }

  const profile = resolveRouteProfile(input.profile);
  const recomputed = computeRouteFingerprintHex(coords, profile);
  if (recomputed !== input.applicantFingerprint) {
    return { ok: false, reason: SAVED_ROUTE_SHAPE_MISMATCH_REASON };
  }

  const needsBackfill = input.savedRouteFingerprint !== recomputed;
  return { ok: true, needsBackfill };
}
