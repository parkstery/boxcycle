/**
 * 목록 지역 필터(Chief 11-06 A안) — 「퍼블릭 경로」·「지금 달리는 Trail」 목록 머리줄의 범위 칩.
 *
 * 필터는 **이미 받은 행을 클라이언트에서 거를 뿐**이다(새 Firestore 읽기·쿼리·색인 없음).
 * 그래서 퍼블릭은 최근 80개(요약 목록 한도) 안에서만, Trail 은 실시간 목록 40개 안에서만 걸러진다.
 * 범위 키: "world" | "continent:AS" | "country:KR". 마지막 범위·최근 고른 곳은 기기에 기억한다.
 */
export type ListRegionKey = "world" | `continent:${string}` | `country:${string}`;
export type ListRegionListId = "public" | "trail";
export type RegionGeo = { geoCountry?: string | null; geoContinent?: string | null };

/** 서버 geoContinent 값(AS·EU·AF·NA·SA·OC·AN) → 한국어 이름. 표시 순서도 이 순서다. */
export const CONTINENT_LABELS: Record<string, string> = {
  AS: "아시아",
  EU: "유럽",
  AF: "아프리카",
  NA: "북아메리카",
  SA: "남아메리카",
  OC: "오세아니아",
  AN: "남극",
};

export const WORLD_REGION: ListRegionKey = "world";
const MAX_RECENT_REGIONS = 3;

const LAST_REGION_STORAGE_KEY = (id: ListRegionListId) => `rtw.listRegion.${id}`;
const RECENT_REGIONS_STORAGE_KEY = "rtw.listRegion.recent";

/** 알 수 없는 값은 세계로 — 저장값이 낡거나 깨져도 목록이 비지 않게 */
export function parseRegionKey(v: unknown): ListRegionKey {
  if (typeof v !== "string") return WORLD_REGION;
  if (v.startsWith("continent:")) {
    const code = v.slice("continent:".length);
    return code in CONTINENT_LABELS ? (`continent:${code}` as ListRegionKey) : WORLD_REGION;
  }
  if (v.startsWith("country:")) {
    const code = v.slice("country:".length);
    return /^[A-Z]{2}$/.test(code) ? (`country:${code}` as ListRegionKey) : WORLD_REGION;
  }
  return WORLD_REGION;
}

/** 국가 코드 → 한국어 이름. geo 도메인은 identity 를 import 할 수 없어 Intl 을 직접 쓴다. 모르면 코드 그대로 */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["ko"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function regionLabel(key: ListRegionKey): string {
  if (key.startsWith("continent:")) return CONTINENT_LABELS[key.slice("continent:".length)] ?? "대륙";
  if (key.startsWith("country:")) return countryName(key.slice("country:".length));
  return "세계";
}

export function filterByRegion<T>(rows: readonly T[], key: ListRegionKey, geoOf: (row: T) => RegionGeo): T[] {
  if (key === WORLD_REGION) return rows.slice();
  if (key.startsWith("continent:")) {
    const code = key.slice("continent:".length);
    return rows.filter((r) => geoOf(r).geoContinent === code);
  }
  const code = key.slice("country:".length);
  return rows.filter((r) => geoOf(r).geoCountry === code);
}

/** 가장 최근에 고른 곳이 앞. 세계는 기록하지 않고, 중복은 합치며, 최대 3개 */
export function pushRecentRegion(recents: readonly ListRegionKey[], key: ListRegionKey): ListRegionKey[] {
  if (key === WORLD_REGION) return recents.slice(0, MAX_RECENT_REGIONS);
  return [key, ...recents.filter((k) => k !== key)].slice(0, MAX_RECENT_REGIONS);
}

type RegionMenuItem = {
  key: ListRegionKey;
  label: string;
  /** 「내 국가」 */
  tag?: string;
  group: "base" | "recent" | "continent" | "country";
};

/**
 * 메뉴 항목 — 세계 / 내 국가(있을 때만) / 목록에 있는 대륙 / 최근 고른 곳 / 목록에 있는 국가.
 * 내 국가는 목록에 없어도 항상 보인다(고르면 「없어요」 안내로 이어질 수 있다).
 */
export function buildRegionMenu(
  geos: readonly RegionGeo[],
  homeCountry: string | null,
  recents: readonly ListRegionKey[],
): RegionMenuItem[] {
  const items: RegionMenuItem[] = [{ key: WORLD_REGION, label: "세계", group: "base" }];
  if (homeCountry) {
    items.push({ key: `country:${homeCountry}`, label: regionLabel(`country:${homeCountry}`), tag: "내 국가", group: "base" });
  }
  const continents = new Set(geos.map((g) => g.geoContinent).filter((c): c is string => !!c && c in CONTINENT_LABELS));
  for (const code of Object.keys(CONTINENT_LABELS)) {
    if (continents.has(code)) items.push({ key: `continent:${code}`, label: CONTINENT_LABELS[code]!, group: "continent" });
  }
  for (const k of recents) items.push({ key: k, label: regionLabel(k), group: "recent" });
  const countries = [...new Set(geos.map((g) => g.geoCountry).filter((c): c is string => !!c && /^[A-Z]{2}$/.test(c)))]
    .filter((c) => c !== homeCountry)
    .map((c) => ({ key: `country:${c}` as ListRegionKey, label: regionLabel(`country:${c}`), group: "country" as const }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  return [...items, ...countries];
}

export function loadListRegion(id: ListRegionListId): ListRegionKey {
  try {
    return parseRegionKey(localStorage.getItem(LAST_REGION_STORAGE_KEY(id)));
  } catch {
    return WORLD_REGION;
  }
}

export function saveListRegion(id: ListRegionListId, key: ListRegionKey): void {
  try {
    localStorage.setItem(LAST_REGION_STORAGE_KEY(id), key);
  } catch {
    // 저장 못 해도 이번 창에서는 그대로 쓴다
  }
}

export function loadRecentRegions(): ListRegionKey[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_REGIONS_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    const out: ListRegionKey[] = [];
    for (const v of raw) {
      const k = parseRegionKey(v);
      if (k !== WORLD_REGION && !out.includes(k)) out.push(k);
    }
    return out.slice(0, MAX_RECENT_REGIONS);
  } catch {
    return [];
  }
}

export function saveRecentRegions(recents: readonly ListRegionKey[]): void {
  try {
    localStorage.setItem(RECENT_REGIONS_STORAGE_KEY, JSON.stringify(recents));
  } catch {
    // 저장 못 해도 이번 창에서는 그대로 쓴다
  }
}
