import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LineStringGeometry } from "./geo";

/**
 * Conquest(정복) v2 — 도로 셀·궤적. 읽기 전용 클라이언트(쓰기는 CF `conquestOnRideCreated`).
 * 설계 SoT: document/260703-Conquest-정복-레이어-설계.md §4.
 */

export type ConquestSummary = {
  /** 신규로 정복한 도로 누적(m) */
  totalMeters: number;
  totalCells: number;
};

export type ConquestTrace = {
  id: string;
  geometry: LineStringGeometry;
  newMeters: number;
};

export function subscribeConquestSummary(
  userId: string,
  onChange: (summary: ConquestSummary | null) => void,
): Unsubscribe {
  const db = getFirestore(getFirebaseApp());
  return onSnapshot(
    doc(db, "conquest", userId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange({
        totalMeters: Math.max(0, Number(data.totalMeters) || 0),
        totalCells: Math.max(0, Number(data.totalCells) || 0),
      });
    },
    () => onChange(null),
  );
}

/** 내 도로 셀 전체(청크 병합) — 라이브 중복 판정·팝업 소유 판정용. v1(타일) 잔재는 걸러냄. */
export async function loadConquestCellIds(userId: string): Promise<string[]> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDocs(collection(db, "conquest", userId, "chunks"));
  const out: string[] = [];
  snap.forEach((chunkDoc) => {
    const cells = chunkDoc.data().cells;
    if (cells && typeof cells === "object") {
      for (const id of Object.keys(cells as Record<string, unknown>)) {
        if (id.startsWith("20_")) out.push(id);
      }
    }
  });
  return out;
}

/** 「내 도로망」 궤적 전체 — 지도 영구 렌더용. path 는 평탄 배열 [lng0,lat0,...] */
export async function loadConquestTraces(userId: string): Promise<ConquestTrace[]> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDocs(collection(db, "conquest", userId, "traces"));
  const out: ConquestTrace[] = [];
  snap.forEach((traceDoc) => {
    const data = traceDoc.data();
    const path = data.path;
    if (!Array.isArray(path) || path.length < 4 || path.length % 2 !== 0) return;
    const coordinates: [number, number][] = [];
    for (let i = 0; i + 1 < path.length; i += 2) {
      const lng = path[i];
      const lat = path[i + 1];
      if (typeof lng !== "number" || typeof lat !== "number") return;
      coordinates.push([lng, lat]);
    }
    if (coordinates.length < 2) return;
    out.push({
      id: traceDoc.id,
      geometry: { type: "LineString", coordinates },
      newMeters: Math.max(0, Number(data.newMeters) || 0),
    });
  });
  return out;
}
