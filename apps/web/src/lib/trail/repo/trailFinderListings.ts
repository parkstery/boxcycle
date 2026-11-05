import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseFirestore } from "../../firebase/app";
import { OPEN_TRAIL_LISTING_STALE_MS, OPEN_TRAIL_LISTINGS_COLLECTION } from "./firestoreOpenTrailListings";
import { parseTrailCoreFields, timestampToMs } from "./trailDocParse";
import type { TrailFinderRow, TrailFinderScope, TrailFinderSort } from "../trailFinder";

/** 한 번에 받는 목록 수 — 거리·시간은 이 안에서 거른다(「더 보기」 로 늘린다) */
export const TRAIL_FINDER_PAGE = 50;

function scopeConstraints(scope: TrailFinderScope): QueryConstraint[] {
  if (scope.type === "continent") return [where("geoContinent", "==", scope.code)];
  if (scope.type === "country") return [where("geoCountry", "==", scope.code)];
  return [];
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * Trail 찾기(시안 ⑦) — 범위(대륙·국가, G4 지역 필드) + 정렬(사람 많은 순·새로 열린 순).
 * 색인: `geoContinent|geoCountry` + `riderCount desc` / `createdAt desc` (firestore.indexes.json).
 * 오래된(갱신이 멈춘) 목록 문서는 메뉴 구독과 같은 기준으로 뺀다.
 */
export async function fetchTrailFinderListings(
  scope: TrailFinderScope,
  sort: TrailFinderSort,
  max = TRAIL_FINDER_PAGE,
): Promise<TrailFinderRow[]> {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, OPEN_TRAIL_LISTINGS_COLLECTION),
    ...scopeConstraints(scope),
    orderBy(sort === "riders" ? "riderCount" : "createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  const nowMs = Date.now();
  const rows: TrailFinderRow[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const updatedMs = timestampToMs(data.updatedAt);
    if (updatedMs == null || nowMs - updatedMs > OPEN_TRAIL_LISTING_STALE_MS) continue;
    const core = parseTrailCoreFields(data);
    rows.push({
      id: d.id,
      displayNumber: core.displayNumber,
      regionLabel: core.regionLabel,
      distanceKm: core.distanceKm,
      publicationId: core.publicationId,
      riderCount: typeof data.riderCount === "number" && Number.isFinite(data.riderCount) ? Math.max(0, Math.floor(data.riderCount)) : 0,
      createdAtMs: timestampToMs(data.createdAt),
      geoContinent: str(data.geoContinent),
      geoCountry: str(data.geoCountry),
    });
  }
  return rows;
}

/** 범위의 Trail 수(대륙 버튼 숫자·「전 세계 N개」) — 집계 1회(색인 1,000건당 읽기 1) */
export async function countTrailFinderListings(scope: TrailFinderScope): Promise<number> {
  const db = getFirebaseFirestore();
  const snap = await getCountFromServer(query(collection(db, OPEN_TRAIL_LISTINGS_COLLECTION), ...scopeConstraints(scope)));
  return snap.data().count;
}
