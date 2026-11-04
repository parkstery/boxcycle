/**
 * 위치 판정 경계 데이터 적재 — `functions/geo-data/v1/` (생성기: scripts/geo-region/build-geo-data.mjs).
 *
 * - 국가 경계(약 1.5MB 압축)는 첫 판정 때 한 번 읽는다.
 * - 행정구역은 **그 나라가 처음 나올 때만** 읽는다(한국 13KB, 러시아가 가장 크다).
 * 함수 인스턴스 안에서 캐시하므로 같은 인스턴스의 다음 호출은 파일을 다시 읽지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { LngLat } from "../geoTiles.js";
import {
  resolveGeoRegionWith,
  type ContinentCode,
  type GeoArea,
  type GeoCountry,
  type GeoPolygon,
  type GeoRegion,
  type GeoRegionDataset,
} from "./geoRegionCore.js";

/** 컴파일 위치 lib/geoRegion/ 기준. 배포에도 functions/geo-data 가 함께 올라간다(firebase.json ignore 밖). */
export const GEO_DATA_DIR = path.resolve(__dirname, "../../geo-data/v1");

type RawPolygon = { b: [number, number, number, number]; r: number[][] };
type RawCountries = { v: number; scale: number; countries: { c: string; ct: string | null; p: RawPolygon[] }[] };
type RawAdmin1 = { v: number; scale: number; country: string; admin1: { a: string; p: RawPolygon[] }[] };

function readGzJson<T>(file: string): T {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")) as T;
}

/** [x0, y0, dx1, dy1, ...] 정수 → 절대 경위도 */
function decodeRing(flat: number[], scale: number): Float64Array {
  const out = new Float64Array(flat.length);
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    out[i] = x / scale;
    out[i + 1] = y / scale;
  }
  return out;
}

function decodePolygons(raw: RawPolygon[], scale: number): GeoPolygon[] {
  return raw.map((p) => ({ bbox: p.b, rings: p.r.map((ring) => decodeRing(ring, scale)) }));
}

const CONTINENTS: ReadonlySet<string> = new Set(["AS", "EU", "AF", "NA", "SA", "OC", "AN"]);

export function loadGeoRegionDataset(dir = GEO_DATA_DIR): GeoRegionDataset {
  const raw = readGzJson<RawCountries>(path.join(dir, "countries.json.gz"));
  const countries: GeoCountry[] = raw.countries.map((c) => ({
    code: c.c,
    continent: c.ct && CONTINENTS.has(c.ct) ? (c.ct as ContinentCode) : null,
    polygons: decodePolygons(c.p, raw.scale),
  }));
  const admin1Cache = new Map<string, readonly GeoArea[]>();
  return {
    version: raw.v,
    countries,
    admin1Of(country: string): readonly GeoArea[] {
      const hit = admin1Cache.get(country);
      if (hit) return hit;
      const file = path.join(dir, "admin1", `${country}.json.gz`);
      let areas: GeoArea[] = [];
      if (/^[A-Z]{2}$/.test(country) && fs.existsSync(file)) {
        const a1 = readGzJson<RawAdmin1>(file);
        areas = a1.admin1.map((a) => ({ code: a.a, polygons: decodePolygons(a.p, a1.scale) }));
      }
      admin1Cache.set(country, areas);
      return areas;
    },
  };
}

let shared: GeoRegionDataset | null = null;

/** 트리거·CLI 가 쓰는 진입점. 판정 불가(좌표 이상)면 null. */
export function resolveGeoRegion(lngLat: LngLat): GeoRegion | null {
  shared ??= loadGeoRegionDataset();
  return resolveGeoRegionWith(shared, lngLat);
}

let continentByCountry: Map<string, ContinentCode | null> | null = null;

/** 국가 코드 → 대륙(UN M49, 경계 데이터와 같은 표). 데이터에 없는 나라·지역은 null. 순위 대륙 범위(G3-2)가 쓴다. */
export function continentOfCountry(code: string): ContinentCode | null {
  if (!continentByCountry) {
    shared ??= loadGeoRegionDataset();
    continentByCountry = new Map(shared.countries.map((c) => [c.code, c.continent]));
  }
  return continentByCountry.get(code) ?? null;
}
