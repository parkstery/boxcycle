#!/usr/bin/env node
/**
 * 위치 판정용 경계 데이터 생성기 — Natural Earth 원본 → `functions/geo-data/v1/`.
 *
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §3.3
 *
 * 입력(리포에 넣지 않는다, 54MB): Natural Earth 1:10m GeoJSON 두 개
 *   - ne_10m_admin_0_countries_kor.geojson   (국가, **한국 관점 판** — 독도=KR, Chief D10)
 *   - ne_10m_admin_1_states_provinces.geojson (1단계 행정구역)
 *   받는 곳: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (public domain)
 *
 * 출력(리포에 넣는다):
 *   geo-data/v1/meta.json             버전·원본·단순화 허용오차·집계
 *   geo-data/v1/countries.json.gz     국가 경계 (모든 판정이 먼저 읽는다)
 *   geo-data/v1/admin1/{CC}.json.gz   국가별 행정구역 경계 (그 나라가 처음 나올 때만 읽는다)
 *
 * 고리 부호화: 좌표 × 10^COORD_DECIMALS 정수, 첫 점은 절댓값·이후는 앞 점과의 차이
 *   [x0, y0, dx1, dy1, ...]. 해독은 functions/src/geoRegion/geoRegionData.ts 가 맡는다.
 *
 * 실행 (C:\20.HDev\boxcycle\functions):
 *   node scripts/geo-region/build-geo-data.mjs <원본 폴더>
 *
 * 같은 입력이면 같은 출력이 나와야 한다(날짜·난수를 넣지 않는다). 버전을 올릴 때는
 * RESOLVER_VERSION 과 출력 폴더를 함께 바꾸고, 저장된 geoResolverVersion 으로 다시 채울 대상을 고른다.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const RESOLVER_VERSION = 1;
/** 단순화 허용오차(도). 0.002° ≈ 위도 37°에서 남북 220m·동서 180m. */
const SIMPLIFY_DEG = 0.002;
/** 좌표 반올림 자릿수 — 1e-4° ≈ 11m. 파일 크기 절반이 여기서 줄어든다. */
const COORD_DECIMALS = 4;

const SOURCE_A0 = "ne_10m_admin_0_countries_kor.geojson";
const SOURCE_A1 = "ne_10m_admin_1_states_provinces.geojson";

/** Natural Earth CONTINENT → 저장 코드. */
const CONTINENT_CODE = {
  Asia: "AS",
  Europe: "EU",
  Africa: "AF",
  "North America": "NA",
  "South America": "SA",
  Oceania: "OC",
  Antarctica: "AN",
};
/** CONTINENT 가 「Seven seas (open ocean)」 인 영토의 대륙 — ADM0_A3 기준 수동 지정. */
const SEVEN_SEAS_CONTINENT = {
  ATF: "AF", // 프랑스령 남방 영토
  SYC: "AF", // 세이셸
  HMD: "OC", // 허드 맥도널드 제도(호주령)
  SHN: "AF", // 세인트헬레나
  MUS: "AF", // 모리셔스
  IOT: "AS", // 영국령 인도양 지역
  MDV: "AS", // 몰디브
  SGS: "SA", // 사우스조지아
  CLP: "NA", // 클리퍼턴섬
};

/**
 * Natural Earth 행정구역이 ISO 3166-2 **첫 단계보다 잘게** 나뉜 나라의 묶음 규칙.
 * 나머지 나라는 `iso_3166_2` 를 그대로 쓴다.
 */
const ES_REGION_TO_ISO = {
  AN: "ES-AN", AR: "ES-AR", AS: "ES-AS", CN: "ES-CN", CB: "ES-CB", CL: "ES-CL",
  CM: "ES-CM", CT: "ES-CT", EX: "ES-EX", GA: "ES-GA", PM: "ES-IB", LO: "ES-RI",
  MD: "ES-MD", MU: "ES-MC", NA: "ES-NC", PV: "ES-PV", VC: "ES-VC",
};
const GB_UNIT_TO_ISO = {
  England: "GB-ENG",
  Scotland: "GB-SCT",
  Wales: "GB-WLS",
  "Northern Ireland": "GB-NIR",
};
/**
 * 원본 코드 오류 정정 — `iso_3166_2|name` → 올바른 ISO 3166-2. 찾을 때마다 여기에 더하고
 * RESOLVER_VERSION 을 올린다(이미 저장된 값은 geoResolverVersion 으로 골라 다시 채운다).
 */
const ADMIN1_CODE_FIXES = {
  // Natural Earth 5.x: 모스크바 시·주 코드가 서로 바뀌어 있다(ISO: 시=RU-MOW, 주=RU-MOS).
  "RU-MOS|Moskva": "RU-MOW",
  "RU-MOW|Moskovskaya": "RU-MOS",
};
const ISO_2_RE = /^[A-Z]{2}$/;
const ISO_3166_2_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;

function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** @returns {string|null} 이 행정구역 조각이 속할 ISO 3166-2 코드 */
export function admin1CodeOf(p) {
  const country = clean(p.iso_a2);
  const rawIso = clean(p.iso_3166_2);
  const iso = ADMIN1_CODE_FIXES[`${rawIso}|${clean(p.name)}`] ?? rawIso;
  const regionCod = clean(p.region_cod);
  let code = iso;
  if (country === "GB") code = GB_UNIT_TO_ISO[clean(p.geonunit)] ?? "";
  else if (country === "FR") {
    // 본토는 도(département) → 레지옹. 해외 도는 그 자체가 레지옹급이라 iso 그대로.
    if (/^FR-[A-Z]{3}$/.test(regionCod) && clean(p.type_en) !== "Overseas department") {
      code = regionCod === "FR-COR" ? "FR-20R" : regionCod;
    }
  } else if (country === "IT" || country === "PH") {
    if (ISO_3166_2_RE.test(regionCod)) code = regionCod;
  } else if (country === "ES") {
    const m = /^ES\.([A-Z]{2})$/.exec(regionCod);
    // 세우타·멜리야(ES.CE 로 묶여 있음)는 각자 iso 를 쓴다.
    if (m && m[1] !== "CE") code = ES_REGION_TO_ISO[m[1]] ?? "";
  }
  if (!ISO_3166_2_RE.test(code)) return null;
  // 나라는 코드 앞 두 글자로 정한다(아래 main). iso_a2 와 다를 수 있다 — 예: 크림 UA-43 은
  // adm0 이 RUS 로 적혀 있지만 국가 경계(한국 관점 판)는 UA 다. 코드를 따라야 둘이 맞는다.
  return code;
}

const SCALE = 10 ** COORD_DECIMALS;
function toInt(n) {
  return Math.round(n * SCALE);
}

/** Douglas–Peucker. 고리(첫점=끝점)를 받아 고리로 돌려준다. */
function simplifyRing(ring, tol) {
  if (ring.length <= 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = ring[i];
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  // 너무 줄어 면적이 없어지면(작은 섬) 원본을 쓴다 — 독도처럼 작은 섬이 사라지면 안 된다.
  return out.length >= 4 ? out : ring;
}

/** GeoJSON 다각형 → { b: bbox, r: [평평한 고리...] } (첫 고리 = 바깥, 나머지 = 구멍) */
function packPolygon(rings) {
  const packed = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    const s = simplifyRing(ring, SIMPLIFY_DEG);
    const flat = [];
    let prevX = NaN;
    let prevY = NaN;
    for (const [x0, y0] of s) {
      const x = toInt(x0);
      const y = toInt(y0);
      if (x === prevX && y === prevY) continue;
      if (flat.length === 0) flat.push(x, y);
      else flat.push(x - prevX, y - prevY);
      prevX = x;
      prevY = y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (flat.length >= 6) packed.push(flat);
  }
  if (!packed.length) return null;
  return { b: [minX / SCALE, minY / SCALE, maxX / SCALE, maxY / SCALE], r: packed };
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function main() {
  const srcDir = process.argv[2];
  if (!srcDir) {
    console.error("사용법: node scripts/geo-region/build-geo-data.mjs <Natural Earth GeoJSON 폴더>");
    process.exit(2);
  }
  const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../geo-data/v1");
  const a0 = JSON.parse(fs.readFileSync(path.join(srcDir, SOURCE_A0), "utf8"));
  const a1 = JSON.parse(fs.readFileSync(path.join(srcDir, SOURCE_A1), "utf8"));

  /** @type {Map<string, {c:string, ct:string|null, p:object[]}>} */
  const countries = new Map();
  const skippedA0 = [];
  for (const f of a0.features) {
    const p = f.properties;
    const iso = ISO_2_RE.test(clean(p.ISO_A2_EH)) ? clean(p.ISO_A2_EH) : ISO_2_RE.test(clean(p.ISO_A2)) ? clean(p.ISO_A2) : "";
    if (!iso) {
      skippedA0.push(clean(p.ADM0_A3));
      continue;
    }
    const ct = CONTINENT_CODE[clean(p.CONTINENT)] ?? SEVEN_SEAS_CONTINENT[clean(p.ADM0_A3)] ?? null;
    const entry = countries.get(iso) ?? { c: iso, ct, p: [] };
    for (const rings of polygonsOf(f.geometry)) {
      const poly = packPolygon(rings);
      if (poly) entry.p.push(poly);
    }
    countries.set(iso, entry);
  }

  /** @type {Map<string, Map<string, object[]>>} 국가 → 행정구역 코드 → 다각형 */
  const admin1 = new Map();
  let droppedA1 = 0;
  for (const f of a1.features) {
    const p = f.properties;
    const code = admin1CodeOf(p);
    const country = code ? code.slice(0, 2) : "";
    if (!code || !countries.has(country)) {
      droppedA1 += 1;
      continue;
    }
    const byCode = admin1.get(country) ?? new Map();
    const list = byCode.get(code) ?? [];
    for (const rings of polygonsOf(f.geometry)) {
      const poly = packPolygon(rings);
      if (poly) list.push(poly);
    }
    byCode.set(code, list);
    admin1.set(country, byCode);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "admin1"), { recursive: true });
  const countryList = [...countries.values()].sort((x, y) => x.c.localeCompare(y.c));
  const writeGz = (file, obj) => fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(obj), { level: 9, mtime: 0 }));
  writeGz(path.join(outDir, "countries.json.gz"), { v: RESOLVER_VERSION, scale: SCALE, countries: countryList });
  let admin1Count = 0;
  for (const [country, byCode] of [...admin1.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const list = [...byCode.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([a, polys]) => ({ a, p: polys }));
    admin1Count += list.length;
    writeGz(path.join(outDir, "admin1", `${country}.json.gz`), { v: RESOLVER_VERSION, scale: SCALE, country, admin1: list });
  }
  const meta = {
    v: RESOLVER_VERSION,
    source: "Natural Earth 1:10m (public domain)",
    files: [SOURCE_A0, SOURCE_A1],
    pointOfView: "KOR",
    simplifyDeg: SIMPLIFY_DEG,
    coordDecimals: COORD_DECIMALS,
    countries: countryList.length,
    countriesWithAdmin1: admin1.size,
    admin1: admin1Count,
    skippedCountries: skippedA0.sort(),
    droppedAdmin1Features: droppedA1,
  };
  fs.writeFileSync(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(JSON.stringify(meta));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
