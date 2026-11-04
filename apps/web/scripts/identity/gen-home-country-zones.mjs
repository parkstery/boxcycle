#!/usr/bin/env node
/**
 * 기기 시간대 → 국가 표 생성기(국가 입력 미리 채우기, 계획 00-plan §4.2).
 * 입력: IANA tzdata 의 zone.tab(시간대 1개 = 국가 1개)과 tzdata.zi 의 링크(L 줄 — 옛 이름 Asia/Calcutta 등).
 * 브라우저가 옛 이름을 돌려주는 경우가 있어 링크도 넣는다. 같은 입력이면 같은 파일이 나온다.
 *
 *   node scripts/identity/gen-home-country-zones.mjs [/usr/share/zoneinfo]
 * 출력: src/lib/identity/homeCountryZones.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2] ?? "/usr/share/zoneinfo";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/lib/identity/homeCountryZones.ts");

const zoneToCc = new Map();
for (const line of fs.readFileSync(path.join(dir, "zone.tab"), "utf8").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [cc, , tz] = line.split("\t");
  if (/^[A-Z]{2}$/.test(cc) && tz) zoneToCc.set(tz, cc);
}
const version = (fs.readFileSync(path.join(dir, "tzdata.zi"), "utf8").match(/^# version (\S+)/m) ?? [])[1] ?? "unknown";
for (const line of fs.readFileSync(path.join(dir, "tzdata.zi"), "utf8").split("\n")) {
  const m = line.match(/^L (\S+) (\S+)$/);
  if (!m) continue;
  const [, target, link] = m;
  const cc = zoneToCc.get(target);
  if (cc && !zoneToCc.has(link)) zoneToCc.set(link, cc);
}
const entries = [...zoneToCc.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const countries = [...new Set(entries.map(([, cc]) => cc))].sort();
const body = `// 생성 파일 — 손으로 고치지 말 것. 생성기: scripts/identity/gen-home-country-zones.mjs (tzdata ${version})
// 시간대 ${entries.length}개 → 국가 ${countries.length}개.

/** IANA 시간대 → ISO 3166-1 alpha-2 */
export const HOME_COUNTRY_BY_TIME_ZONE: Readonly<Record<string, string>> = {
${entries.map(([tz, cc]) => `  ${JSON.stringify(tz)}: ${JSON.stringify(cc)},`).join("\n")}
};

/** 고를 수 있는 국가 코드(시간대가 있는 나라·지역 전부) */
export const HOME_COUNTRY_CODES: readonly string[] = ${JSON.stringify(countries)};
`;
fs.writeFileSync(out, body);
console.log(`wrote ${path.relative(process.cwd(), out)} — zones ${entries.length}, countries ${countries.length}, tzdata ${version}`);
