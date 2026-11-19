import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp, getFirebaseFirestore } from "../../firebase/app";
import type { LineStringGeometry } from "../../geo/geo";
import { trackVisibilityListener } from "../../debug/visibilityReadMeters";
import { normalizeAcquisitionDay } from "../recentNewRoadDisplay";
import { parseConquestPathItem } from "../conquestPathGeometry";
import { roadCacheFor } from "./conquestRoadCache";
import { parseRoadSummaryToken, roadSyncCursor, syncConquestRoadData, type RoadChunk, type RoadSyncToken, type RoadTrace } from "../conquestRoadSync";

/**
 * Conquest(정복) v2 — 도로 셀·궤적. 읽기 전용 클라이언트(쓰기는 CF `conquestOnRideCreated`).
 * 설계 SoT: document/reference/architecture/260703-Conquest-정복-레이어-설계.md §4.
 */

export type ConquestSummary = {
  /** 신규로 정복한 도로 누적(m) */
  totalMeters: number;
  totalCells: number;
  roadSync?: RoadSyncToken | null;
};

export type ConquestTrace = RoadTrace;

export type RecentNewRoad = {
  day: string;
  geometry: LineStringGeometry[];
  newMeters: number;
};

function parseRecentGeometry(raw: unknown): LineStringGeometry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const line = parseConquestPathItem(item);
    return line ? [line] : [];
  });
}

export function subscribeConquestSummary(
  userId: string,
  onChange: (summary: ConquestSummary | null, fromCache: boolean) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return trackVisibilityListener(
    "conquest",
    onSnapshot(
      doc(db, "conquest", userId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) {
          onChange(null, snap.metadata.fromCache);
          return;
        }
        const data = snap.data();
        onChange({
          totalMeters: Math.max(0, Number(data.totalMeters) || 0),
          totalCells: Math.max(0, Number(data.totalCells) || 0),
          roadSync: parseRoadSummaryToken(data),
        }, snap.metadata.fromCache);
      },
      () => onChange(null, false),
    ),
  );
}

export function subscribeRecentNewRoad(
  userId: string,
  onChange: (recent: RecentNewRoad | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return trackVisibilityListener(
    "conquest",
    onSnapshot(
      doc(db, "conquest", userId, "recentNewRoad", "current"),
      (snap) => {
        if (!snap.exists()) {
          onChange(null);
          return;
        }
        const data = snap.data();
        const day = typeof data.day === "string" ? normalizeAcquisitionDay(data.day) : "";
        const geometry = parseRecentGeometry(data.geometry);
        if (!day || geometry.length === 0) {
          onChange(null);
          return;
        }
        onChange({
          day,
          geometry,
          newMeters: Math.max(0, Number(data.newMeters) || 0),
        });
      },
      () => onChange(null),
    ),
  );
}

/** 지역별 누적 한 건(G5) — 서버가 쓰는 `conquest/{uid}/regions/{scopeCode}`. */
export type ConquestRegionTotal = { scopeType: "country" | "admin1"; scopeCode: string; meters: number; cells: number };

/**
 * 내 도로망 지역 칩의 재료 — **국가 문서만** 읽는다(`scopeType == country`, 읽기 수 = 달린 국가 수).
 * 행정구역 문서는 서버가 쌓아 두지만 화면이 쓰기 전까지 읽지 않는다(읽기 절약). 실패하면 빈 배열.
 */
export async function loadConquestRegions(userId: string): Promise<ConquestRegionTotal[]> {
  try {
    const db = getFirebaseFirestore();
    const snap = await getDocs(
      query(collection(db, "conquest", userId, "regions"), where("scopeType", "==", "country")),
    );
    const out: ConquestRegionTotal[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const scopeType = data.scopeType === "admin1" ? "admin1" : data.scopeType === "country" ? "country" : null;
      if (!scopeType) return;
      out.push({
        scopeType,
        scopeCode: d.id,
        meters: Math.max(0, Number(data.meters) || 0),
        cells: Math.max(0, Number(data.cells) || 0),
      });
    });
    return out;
  } catch {
    return [];
  }
}

/**
 * 한 국가의 행정구역 누적 — 국가를 고를 때만 읽는다(문서 id 가 `KR-` 로 시작하는 admin1 문서, 대한민국 17개 이하).
 * 단일 필드 조건 + 문서 id 범위라 복합 색인이 필요 없다(2026-11-06 운영 조회로 확인). 실패하면 빈 배열.
 */
export async function loadConquestAdmin1(userId: string, countryCode: string): Promise<ConquestRegionTotal[]> {
  if (!/^[A-Z]{2}$/.test(countryCode)) return [];
  try {
    const db = getFirebaseFirestore();
    const snap = await getDocs(
      query(
        collection(db, "conquest", userId, "regions"),
        where("scopeType", "==", "admin1"),
        where(documentId(), ">=", `${countryCode}-`),
        where(documentId(), "<", `${countryCode}-\uf8ff`),
      ),
    );
    const out: ConquestRegionTotal[] = [];
    snap.forEach((d) => {
      const data = d.data();
      out.push({
        scopeType: "admin1",
        scopeCode: d.id,
        meters: Math.max(0, Number(data.meters) || 0),
        cells: Math.max(0, Number(data.cells) || 0),
      });
    });
    return out;
  } catch {
    return [];
  }
}

export type RideRegionTotal = { meters: number; sec: number; rideCount: number };

/**
 * 한 지역(국가 `KR` 또는 행정구역 `KR-11`)의 주행 누적 — 문서 1건만 읽는다(컬렉션 전체 읽기 금지).
 * 문서가 없으면(소급 전·그 지역을 달린 적 없음) `{ exists: false }`, 읽기 실패면 null.
 */
export async function loadRideRegionTotal(
  userId: string,
  scopeCode: string,
): Promise<({ exists: true } & RideRegionTotal) | { exists: false } | null> {
  if (!/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(scopeCode)) return null;
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), "conquest", userId, "rideRegions", scopeCode));
    if (!snap.exists()) return { exists: false };
    const data = snap.data();
    return {
      exists: true,
      meters: Math.max(0, Number(data.meters) || 0),
      sec: Math.max(0, Number(data.sec) || 0),
      rideCount: Math.max(0, Number(data.rideCount) || 0),
    };
  } catch {
    return null;
  }
}

function decodeTrace(id: string, data: Record<string, unknown>): ConquestTrace | null {
  const path = data.path;
  if (!Array.isArray(path) || path.length < 4 || path.length % 2 !== 0) return null;
  const coordinates: [number, number][] = [];
  for (let i = 0; i + 1 < path.length; i += 2) {
    const lng = path[i];
    const lat = path[i + 1];
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    coordinates.push([lng, lat]);
  }
  if (coordinates.length < 2) return null;
  return {
    id,
    day: typeof data.day === "string" ? data.day : undefined,
    geometry: { type: "LineString", coordinates },
    newMeters: Math.max(0, Number(data.newMeters) || 0),
  };
}

/** Persistent full baseline plus only changed chunk/trace documents thereafter. */
export async function loadConquestRoadData(userId: string, token: RoadSyncToken | null) {
  const db = getFirebaseFirestore();
  const parent = doc(db, "conquest", userId);
  const namespace = `${getFirebaseApp().options.projectId}:${import.meta.env.VITE_USE_EMULATOR === "1" ? "emulator" : "production"}`;
  const result = await syncConquestRoadData(userId, token, {
    ...roadCacheFor(namespace, userId),
    readToken: async () => parseRoadSummaryToken((await getDocFromServer(parent)).data()),
    readRemote: (since, currentToken) => readConquestRoadRecords(db, userId, since, currentToken),
  });
  const cellDays = new Map<string, string>();
  for (const chunk of result.chunks) for (const [id, day] of Object.entries(chunk.cells)) cellDays.set(id, day);
  return { cellDays, traces: result.traces };
}

/** Shared server query path; exported for emulator verification against actual Rules. */
export async function readConquestRoadRecords(db: Firestore, userId: string, since: number | null, currentToken: RoadSyncToken | null) {
  const parent = doc(db, "conquest", userId);
  const changed = (name: string) => {
    const coll = collection(parent, name);
    return since === null || !currentToken ? query(coll) : query(coll,
      where("roadSyncCursor", ">", roadSyncCursor(currentToken, since)),
      where("roadSyncCursor", "<", `${currentToken.epoch}:\uf8ff`));
  };
  const fetchSnapshot = currentToken ? getDocsFromServer : getDocs;
  const [chunkSnap, traceSnap] = await Promise.all([
    fetchSnapshot(changed("chunks")), fetchSnapshot(changed("traces")),
  ]);
  const chunks: RoadChunk[] = chunkSnap.docs.map(d => {
    const cells: Record<string, string> = {};
    const raw = d.data().cells;
    if (raw && typeof raw === "object") for (const [id, day] of Object.entries(raw)) {
      if (id.startsWith("20_")) cells[id] = typeof day === "string" ? day : "";
    }
    return { id: d.id, cells };
  });
  const traces = traceSnap.docs.flatMap(d => {
    const trace = decodeTrace(d.id, d.data());
    return trace ? [trace] : [];
  });
  return { chunks, traces };
}
