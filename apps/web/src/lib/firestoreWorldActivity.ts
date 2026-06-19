import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { lastSeenAtToMillis } from "./firestoreTrail";

/** `worldActivity/global` — 줌 아웃 시 월드 레이어 힌트(저빈도 getDoc) */
export type WorldActivitySnapshot = {
  activePublicationCount: number;
  livePulseCount: number;
  recentRideCount30d: number;
  highlightedPublications: string[];
  updatedAtMs: number | null;
};

const GLOBAL_DOC_ID = "global";
const COLLECTION = "worldActivity";

function stringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

function parseWorldActivityDoc(data: Record<string, unknown>): WorldActivitySnapshot {
  const activePublicationCount =
    typeof data.activePublicationCount === "number" && Number.isFinite(data.activePublicationCount)
      ? Math.max(0, Math.floor(data.activePublicationCount))
      : 0;
  const livePulseCount =
    typeof data.livePulseCount === "number" && Number.isFinite(data.livePulseCount)
      ? Math.max(0, Math.floor(data.livePulseCount))
      : 0;
  const recentRideCount30d =
    typeof data.recentRideCount30d === "number" && Number.isFinite(data.recentRideCount30d)
      ? Math.max(0, Math.floor(data.recentRideCount30d))
      : 0;
  return {
    activePublicationCount,
    livePulseCount,
    recentRideCount30d,
    highlightedPublications: stringIds(data.highlightedPublications),
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
  };
}

export async function fetchWorldActivityGlobal(): Promise<WorldActivitySnapshot | null> {
  const db = getFirestore(getFirebaseApp());
  const snap = await getDoc(doc(db, COLLECTION, GLOBAL_DOC_ID));
  if (!snap.exists()) return null;
  return parseWorldActivityDoc(snap.data() as Record<string, unknown>);
}

export function formatWorldActivityHudLine(snapshot: WorldActivitySnapshot | null): string | null {
  if (!snapshot) return null;
  const parts: string[] = [];
  if (snapshot.livePulseCount > 0) parts.push(`라이브 ${snapshot.livePulseCount}`);
  if (snapshot.activePublicationCount > 0) parts.push(`활성 경로 ${snapshot.activePublicationCount}`);
  if (snapshot.recentRideCount30d > 0) parts.push(`30일 ${snapshot.recentRideCount30d}회`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** `appMeta/worldPresence` + `worldActivity/global` 한 줄 병합 */
export function mergeWorldHudLines(
  presenceLine: string | null | undefined,
  activityLine: string | null | undefined,
): string | null {
  const p = presenceLine?.trim();
  const a = activityLine?.trim();
  if (p && a) return `${a} · ${p}`;
  return a || p || null;
}
