import { doc, getDoc, getFirestore, type Timestamp } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";

export type WorldRegionRow = {
  id: string;
  labelKo: string;
  activeCount: number;
};

/** 서버 문서 없을 때 UI용 기본(숫자는 0 — 집계는 서버/배치에서 채움) */
export const WORLD_PRESENCE_DEFAULT_REGIONS: WorldRegionRow[] = [
  { id: "swiss-lakes", labelKo: "스위스 호숫가", activeCount: 0 },
  { id: "seoul-han", labelKo: "서울 한강", activeCount: 0 },
  { id: "tokyo-bay", labelKo: "도쿄만", activeCount: 0 },
];

function parseRegions(raw: unknown): WorldRegionRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WorldRegionRow[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const labelKo = typeof o.labelKo === "string" ? o.labelKo.trim() : "";
    const n = o.activeCount;
    const activeCount =
      typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    if (id && labelKo) out.push({ id, labelKo, activeCount });
  }
  return out.length > 0 ? out : null;
}

export type WorldPresenceFetchResult = {
  regions: WorldRegionRow[];
  fromServer: boolean;
  updatedAtMs: number | null;
};

/**
 * 집계 문서 1건(getDoc) — 구독 폭주 없이 월드 레이어 힌트용.
 * 문서: `appMeta/worldPresence` — regions[], optional updatedAt
 */
export async function fetchWorldPresenceSummary(): Promise<WorldPresenceFetchResult> {
  try {
    const db = getFirestore(getFirebaseApp());
    const snap = await getDoc(doc(db, "appMeta", "worldPresence"));
    if (!snap.exists()) {
      return { regions: WORLD_PRESENCE_DEFAULT_REGIONS, fromServer: false, updatedAtMs: null };
    }
    const data = snap.data() as Record<string, unknown>;
    const regions = parseRegions(data.regions);
    let updatedAtMs: number | null = null;
    const u = data.updatedAt as Timestamp | undefined;
    if (u && typeof u.toMillis === "function") {
      const ms = u.toMillis();
      updatedAtMs = Number.isFinite(ms) ? ms : null;
    }
    return {
      regions: regions ?? WORLD_PRESENCE_DEFAULT_REGIONS,
      fromServer: true,
      updatedAtMs,
    };
  } catch {
    return { regions: WORLD_PRESENCE_DEFAULT_REGIONS, fromServer: false, updatedAtMs: null };
  }
}

/** HUD 한 줄 — 과장 없이 집계만 */
export function formatWorldPresenceHudLine(regions: WorldRegionRow[]): string {
  const nonzero = regions.filter((r) => r.activeCount > 0);
  const total = regions.reduce((s, r) => s + r.activeCount, 0);
  if (nonzero.length === 0) {
    return total > 0
      ? `지금도 다른 라이더가 약 ${total}명 코스에 있어요.`
      : "세계 곳곳의 코스에서 라이딩이 이어지고 있어요. 줌을 축소하면 활동 요약을 볼 수 있어요.";
  }
  const parts = nonzero.slice(0, 3).map((r) => `${r.labelKo} ${r.activeCount}`);
  const tail = nonzero.length > 3 ? ` 외 ${nonzero.length - 3}곳` : "";
  return `지금도 ${parts.join(" · ")}${tail}${total > 0 ? ` · 합계 약 ${total}명` : ""}`;
}
