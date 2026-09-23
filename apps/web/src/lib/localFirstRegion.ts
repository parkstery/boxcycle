import type { LngLat } from "./geo";

/** localStorage 키 — 지시02 Ready Ride 출발점 입력. 변경 시 감리 승인 필요. */
export const LOCAL_FIRST_REGION_STORAGE_KEY = "rtw.localFirst.region";

/**
 * Recognition 줌 — 폰 가로(740×300)에서 동·구·시 라벨이 읽히는 값.
 * 후보 12/13/14 비교 캡처 후 13 채택(구·동 라벨이 뜨고 시가지가 한 화면에 잡힘).
 */
export const LOCAL_FIRST_CAMERA_ZOOM = 13;

export type LocalFirstRegionSource = "search" | "geolocation";

export type LocalFirstRegion = {
  name: string;
  lngLat: LngLat;
  zoom: number;
  source: LocalFirstRegionSource;
  at: string;
};

function isLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

export function readLocalFirstRegion(): LocalFirstRegion | null {
  try {
    const raw = localStorage.getItem(LOCAL_FIRST_REGION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalFirstRegion>;
    if (
      typeof parsed.name !== "string" ||
      !parsed.name.trim() ||
      !isLngLat(parsed.lngLat) ||
      (parsed.source !== "search" && parsed.source !== "geolocation")
    ) {
      return null;
    }
    const zoom =
      typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom)
        ? parsed.zoom
        : LOCAL_FIRST_CAMERA_ZOOM;
    return {
      name: parsed.name.trim(),
      lngLat: [parsed.lngLat[0], parsed.lngLat[1]],
      zoom,
      source: parsed.source,
      at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeLocalFirstRegion(region: LocalFirstRegion): void {
  try {
    localStorage.setItem(LOCAL_FIRST_REGION_STORAGE_KEY, JSON.stringify(region));
  } catch {
    /* 사생활 보호 모드 등 — 무시하고 메모리 상태만 유지 */
  }
}

export function clearLocalFirstRegion(): void {
  try {
    localStorage.removeItem(LOCAL_FIRST_REGION_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function makeLocalFirstRegion(input: {
  name: string;
  lngLat: LngLat;
  source: LocalFirstRegionSource;
  zoom?: number;
}): LocalFirstRegion {
  return {
    name: input.name.trim(),
    lngLat: [input.lngLat[0], input.lngLat[1]],
    zoom: input.zoom ?? LOCAL_FIRST_CAMERA_ZOOM,
    source: input.source,
    at: new Date().toISOString(),
  };
}

/**
 * Recognition 표시용 지명 — 도시/행정구역 단위.
 * Mapbox ko 는 콤마("망원동, 마포구, …") 또는 공백("대한민국 서울특별시 마포구")을 쓴다.
 */
export function localFirstRegionLabel(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(t)) return null;

  const byComma = t.split(",")[0]?.trim();
  if (byComma && byComma !== t) return byComma;

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return t;

  const admin = [...parts]
    .reverse()
    .find((p) => /(특별시|광역시|특별자치시|특별자치도|시|군|구|읍|면|동|리)$/.test(p));
  if (admin) return admin;

  if (parts[0] === "대한민국" || parts[0] === "한국") {
    return parts[parts.length - 1] ?? t;
  }
  return parts[parts.length - 1] ?? t;
}
