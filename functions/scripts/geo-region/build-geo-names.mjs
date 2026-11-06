/**
 * 행정구역(ISO 3166-2) 이름 표 생성기.
 *
 * 사용법(폴더: functions):
 *   node scripts/geo-region/build-geo-names.mjs <Natural Earth GeoJSON 폴더> [--fetch-wikidata]
 *
 * 이름 출처(코드 하나당 언어별로 위에서 아래 순서):
 *   1. Wikidata(CC0) — ISO 3166-2 코드(P300)의 ko·en 라벨. geo-data/names-src/wikidata-admin1-names.json 에 저장된 것을 쓴다.
 *      --fetch-wikidata 를 줄 때만 SPARQL 로 다시 받아 그 파일을 갱신한다(평소 실행은 네트워크 없음·결정적).
 *   2. Natural Earth(공개 도메인) — 그 코드의 조각이 하나뿐일 때만 name_ko / name_en(없으면 name).
 *      합쳐진 코드(프랑스 레지옹·영국 4개국·이탈리아 주 등)는 조각 이름이 대표 이름이 아니라서 쓰지 않는다.
 *   3. MANUAL_NAMES — 위 둘 다 못 채운 곳의 손 보정.
 * 출력: apps/web/public/geo-names/v1/{CC}.json, meta.json (정렬 고정·날짜 없음).
 * 코드 집합은 build-geo-data.mjs 와 같은 규칙(admin1CodeOf + 국가 경계에 있는 나라)이라 geo-data/v1 과 일치한다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { admin1CodeOf } from "./build-geo-data.mjs";

const SOURCE_A0 = "ne_10m_admin_0_countries_kor.geojson";
const SOURCE_A1 = "ne_10m_admin_1_states_provinces.geojson";
const NAMES_VERSION = 1;
const ISO_2_RE = /^[A-Z]{2}$/;

const here = path.dirname(fileURLToPath(import.meta.url));
const WD_FILE = path.resolve(here, "../../geo-data/names-src/wikidata-admin1-names.json");
const OUT_DIR = path.resolve(here, "../../../apps/web/public/geo-names/v1");

/** 위 1·2 로 못 채운 언어만 채운다. 근거는 Natural Earth 속성과 ISO 3166-2 목록. */
const MANUAL_NAMES = {
  // 알마티 시(ISO 3166-2:KZ 의 KZ-ALA). NE 조각: Almaty City / Almaty 두 개라 단일 조각 규칙에 안 걸린다.
  "KZ-ALA": { ko: "알마티", en: "Almaty" },
  // 팔라완 외 5곳 = 미마로파 지방(Region IV-B). Wikidata 는 ko 만 있다.
  "PH-41": { en: "MIMAROPA" },
  // 카비테·라구나·바탕가스·리살·케손 = 칼라바르손 지방(Region IV-A). Wikidata 는 ko 만 있다.
  "PH-40": { en: "CALABARZON" },
  // 조각 두 개: Nationalparken(북동 그린란드 국립공원) + Pituffik. 국립공원이 이 코드의 본체. (확신 낮음)
  "GL-UO": { ko: "북동 그린란드 국립공원", en: "Northeast Greenland National Park" },
  // 앵귈라는 하위 구역이 없고 NE 속성에 이름이 비어 있다. 나라 이름으로 대체. (확신 낮음)
  "AI-X00": { ko: "앵귈라", en: "Anguilla" },
};

function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}

const srcDir = process.argv[2];
const fetchWd = process.argv.includes("--fetch-wikidata");
if (!srcDir) {
  console.error("사용법: node scripts/geo-region/build-geo-names.mjs <Natural Earth GeoJSON 폴더> [--fetch-wikidata]");
  process.exit(2);
}

const a0 = JSON.parse(fs.readFileSync(path.join(srcDir, SOURCE_A0), "utf8"));
const a1 = JSON.parse(fs.readFileSync(path.join(srcDir, SOURCE_A1), "utf8"));

const countrySet = new Set();
for (const f of a0.features) {
  const p = f.properties;
  const iso = ISO_2_RE.test(clean(p.ISO_A2_EH)) ? clean(p.ISO_A2_EH) : ISO_2_RE.test(clean(p.ISO_A2)) ? clean(p.ISO_A2) : "";
  if (iso) countrySet.add(iso);
}

/** @type {Map<string, object[]>} 코드 → Natural Earth 속성 목록 */
const pieces = new Map();
for (const f of a1.features) {
  const code = admin1CodeOf(f.properties);
  if (!code || !countrySet.has(code.slice(0, 2))) continue;
  const list = pieces.get(code) ?? [];
  list.push(f.properties);
  pieces.set(code, list);
}
const codes = [...pieces.keys()].sort();

async function fetchWikidata() {
  const out = {};
  for (let i = 0; i < codes.length; i += 300) {
    const chunk = codes.slice(i, i + 300);
    const q = `SELECT ?code ?ko ?en WHERE { VALUES ?code {${chunk.map((c) => `"${c}"`).join(" ")}} ?i wdt:P300 ?code . OPTIONAL{?i rdfs:label ?ko FILTER(LANG(?ko)="ko")} OPTIONAL{?i rdfs:label ?en FILTER(LANG(?en)="en")} }`;
    const r = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": "boxcycle-geo-names/1.0 (https://github.com/boxcycle; admin1 name table build)",
      },
      body: `query=${encodeURIComponent(q)}`,
    });
    if (!r.ok) throw new Error(`Wikidata HTTP ${r.status} (chunk ${i})`);
    const j = await r.json();
    // 같은 코드가 여러 항목에 걸리면 라벨 사전순으로 고정해 실행마다 같게 한다.
    for (const b of [...j.results.bindings].sort((x, y) => (x.code.value + (x.ko?.value ?? "") + (x.en?.value ?? "")).localeCompare(y.code.value + (y.ko?.value ?? "") + (y.en?.value ?? "")))) {
      const o = (out[b.code.value] ??= {});
      if (b.ko && !o.ko) o.ko = b.ko.value;
      if (b.en && !o.en) o.en = b.en.value;
    }
  }
  const keys = Object.keys(out).sort();
  fs.mkdirSync(path.dirname(WD_FILE), { recursive: true });
  fs.writeFileSync(WD_FILE, `{\n${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(out[k])}`).join(",\n")}\n}\n`);
  console.log(`Wikidata ${keys.length}개 코드 저장: ${WD_FILE}`);
}

async function main() {
  if (fetchWd) await fetchWikidata();
  const wd = JSON.parse(fs.readFileSync(WD_FILE, "utf8"));

  const byCountry = new Map();
  const noEn = [];
  const manualUsed = [];
  let ko = 0;
  let en = 0;
  for (const code of codes) {
    const w = wd[code] ?? {};
    const ps = pieces.get(code);
    let k = clean(w.ko);
    let e = clean(w.en);
    if (ps.length === 1) {
      k ||= clean(ps[0].name_ko);
      e ||= clean(ps[0].name_en) || clean(ps[0].name);
    }
    const m = MANUAL_NAMES[code];
    if (m) {
      if (!k && m.ko) {
        k = m.ko;
        manualUsed.push(`${code}:ko`);
      }
      if (!e && m.en) {
        e = m.en;
        manualUsed.push(`${code}:en`);
      }
    }
    if (!e) noEn.push(code);
    const entry = {};
    if (k) {
      entry.ko = k;
      ko += 1;
    }
    if (e) {
      entry.en = e;
      en += 1;
    }
    const cc = code.slice(0, 2);
    const obj = byCountry.get(cc) ?? {};
    obj[code] = entry;
    byCountry.set(cc, obj);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [cc, obj] of [...byCountry.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    fs.writeFileSync(path.join(OUT_DIR, `${cc}.json`), JSON.stringify(obj));
  }
  const meta = {
    v: NAMES_VERSION,
    source: "Wikidata (CC0) ISO 3166-2 labels + Natural Earth 1:10m (public domain) name_ko/name_en + manual",
    languages: ["ko", "en"],
    countries: byCountry.size,
    codes: codes.length,
    ko,
    en,
    manual: Object.keys(MANUAL_NAMES).sort(),
  };
  fs.writeFileSync(path.join(OUT_DIR, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(JSON.stringify(meta));
  console.log("manual used:", manualUsed.join(", ") || "-");
  console.log("en 없음:", noEn.length ? noEn.join(", ") : "없음");
  if (noEn.length) process.exitCode = 1;
}

main();
