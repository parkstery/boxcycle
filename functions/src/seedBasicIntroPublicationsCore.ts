import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  BASIC_INTRO_HUB_ROUTE_REVISION,
  BASIC_INTRO_HUB_SEEDS,
} from "./basicIntroHubSeeds.js";
import {
  computeRouteFingerprintHex,
  encodeGeometryCoordsJson,
  type LngLat,
} from "./routeFingerprintCore.js";

export const ROUTE_PUBLICATIONS_COLLECTION = "routePublications";

/**
 * 이번 교체로 물러난 허구 직선 입문 경로.
 * 자동 삭제하지 않는다 — `--archive-legacy` 를 줄 때만 `status: "archived"` 로 내린다.
 */
export const LEGACY_FICTIONAL_PUBLICATION_IDS = [
  "basic-mountain-0_5km",
  "basic-coastal-1_0km",
  "basic-mountain-1_5km",
] as const;

const MAX_DISTANCE_METERS = 500;

function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function polylineLengthMeters(coords: readonly LngLat[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i += 1) sum += haversineMeters(coords[i - 1]!, coords[i]!);
  return sum;
}

export type SeedBasicIntroPublicationAction =
  | "created"
  | "updated"
  | "unchanged"
  | "archived"
  | "legacy-absent";

export type SeedBasicIntroPublicationRow = {
  publicationId: string;
  action: SeedBasicIntroPublicationAction;
  /** 실제 좌표로 재계산한 길이(m) — nominal 을 믿지 않는다 */
  recomputedMeters: number;
  coordinateCount: number;
  existingSeedRevision: number | null;
  targetSeedRevision: number;
  reason: string;
};

export type SeedBasicIntroPublicationsResult = {
  dryRun: boolean;
  archiveLegacy: boolean;
  seedRevision: number;
  publicationIds: readonly string[];
  rows: SeedBasicIntroPublicationRow[];
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  errors: number;
};

/**
 * 입문 publication 3건을 실도로 seed 로 idempotent upsert 한다.
 *
 * - 문서가 없으면 만든다.
 * - 있으면 `basicSeedRevision` 이 현재 리비전과 다를 때만 덮어쓴다(같으면 unchanged).
 * - 삭제는 절대 하지 않는다. 레거시 허구 경로는 `--archive-legacy` 일 때만 archived 로 내린다.
 */
export async function seedBasicIntroPublicationsWithAdminSdk(input: {
  dryRun: boolean;
  archiveLegacy: boolean;
}): Promise<SeedBasicIntroPublicationsResult> {
  const db = getFirestore();
  const result: SeedBasicIntroPublicationsResult = {
    dryRun: input.dryRun,
    archiveLegacy: input.archiveLegacy,
    seedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
    publicationIds: BASIC_INTRO_HUB_SEEDS.map((s) => s.id),
    rows: [],
    created: 0,
    updated: 0,
    unchanged: 0,
    archived: 0,
    errors: 0,
  };

  for (const seed of BASIC_INTRO_HUB_SEEDS) {
    try {
      const coords = seed.coordinates;
      const recomputed = polylineLengthMeters(coords);

      // 자가 검산 — 허구/과길이 seed 가 Firestore 로 들어가는 것을 여기서 막는다.
      if (coords.length < 2) throw new Error(`좌표 부족: ${seed.id}`);
      if (!(recomputed > 0 && recomputed <= MAX_DISTANCE_METERS)) {
        throw new Error(`좌표 재계산 길이 위반: ${seed.id} = ${recomputed.toFixed(1)}m`);
      }

      const ref = db.doc(`${ROUTE_PUBLICATIONS_COLLECTION}/${seed.id}`);
      const snap = await ref.get();
      const existingRevision = snap.exists
        ? (typeof snap.get("basicSeedRevision") === "number"
            ? (snap.get("basicSeedRevision") as number)
            : null)
        : null;

      if (snap.exists && existingRevision === BASIC_INTRO_HUB_ROUTE_REVISION) {
        result.unchanged += 1;
        result.rows.push({
          publicationId: seed.id,
          action: "unchanged",
          recomputedMeters: Number(recomputed.toFixed(2)),
          coordinateCount: coords.length,
          existingSeedRevision: existingRevision,
          targetSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
          reason: "basicSeedRevision 이 이미 최신",
        });
        continue;
      }

      const routeFingerprint = computeRouteFingerprintHex(coords, seed.profile);

      const payload = {
        routeId: seed.id,
        courseId: seed.id,
        publicTitle: seed.title,
        publicSummary: seed.description,
        status: "published",
        revision: 1,
        basicSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
        routeFingerprint,
        geometryCoordsJson: encodeGeometryCoordsJson(coords),
        snapshotProfile: seed.profile,
        snapshotDistanceMeters: seed.distanceMeters,
        snapshotDurationSec: seed.durationSec,
        applicantUid: "",
        sourcePublicRouteRequestId: "",
        presenceEnabled: true,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };

      if (!input.dryRun) await ref.set(payload, { merge: true });

      if (snap.exists) result.updated += 1;
      else result.created += 1;
      result.rows.push({
        publicationId: seed.id,
        action: snap.exists ? "updated" : "created",
        recomputedMeters: Number(recomputed.toFixed(2)),
        coordinateCount: coords.length,
        existingSeedRevision: existingRevision,
        targetSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
        reason: snap.exists
          ? `basicSeedRevision ${existingRevision ?? "없음"} → ${BASIC_INTRO_HUB_ROUTE_REVISION}`
          : "문서 없음 — 신규 생성",
      });
    } catch (e) {
      console.error("[seedBasicIntroPublications]", seed.id, e);
      result.errors += 1;
    }
  }

  for (const legacyId of LEGACY_FICTIONAL_PUBLICATION_IDS) {
    try {
      const ref = db.doc(`${ROUTE_PUBLICATIONS_COLLECTION}/${legacyId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        result.rows.push({
          publicationId: legacyId,
          action: "legacy-absent",
          recomputedMeters: 0,
          coordinateCount: 0,
          existingSeedRevision: null,
          targetSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
          reason: "레거시 문서 없음 — 할 일 없음",
        });
        continue;
      }
      if (!input.archiveLegacy) {
        result.rows.push({
          publicationId: legacyId,
          action: "legacy-absent",
          recomputedMeters: 0,
          coordinateCount: 0,
          existingSeedRevision: null,
          targetSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
          reason: "레거시 문서 존재 — --archive-legacy 없이는 손대지 않음",
        });
        continue;
      }
      if (!input.dryRun) {
        // 삭제하지 않는다. 목록에서만 내린다.
        await ref.set(
          {
            status: "archived",
            presenceEnabled: false,
            archivedReason: "fictional_basic_intro_route_replaced_260816",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      result.archived += 1;
      result.rows.push({
        publicationId: legacyId,
        action: "archived",
        recomputedMeters: 0,
        coordinateCount: 0,
        existingSeedRevision: null,
        targetSeedRevision: BASIC_INTRO_HUB_ROUTE_REVISION,
        reason: "허구 직선 경로 — status archived (삭제 아님)",
      });
    } catch (e) {
      console.error("[seedBasicIntroPublications:legacy]", legacyId, e);
      result.errors += 1;
    }
  }

  return result;
}
