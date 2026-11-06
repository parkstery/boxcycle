/**
 * 행정구역(ISO 3166-2) 이름 표 로더 — `/geo-names/v1/{CC}.json` (생성기: functions/scripts/geo-region/build-geo-names.mjs).
 *
 * 국가별 파일을 한 번만 받아 모듈에 캐시하고, 진행 중 요청은 공유한다.
 * 실패(네트워크·404·Hosting SPA 재작성이 돌려주는 index.html·깨진 JSON·국가코드 오류)는 예외 없이 빈 객체이며
 * 캐시하지 않는다. 다만 같은 국가의 실패는 60초간 다시 요청하지 않아 폭주를 막는다.
 */
export type Admin1Names = Record<string, { ko?: string; en?: string }>;
export type Admin1Lang = "ko" | "en";

export const ADMIN1_NAMES_RETRY_MS = 60_000;

type LoadOpts = { fetchImpl?: typeof fetch; now?: () => number };

const loaded = new Map<string, Admin1Names>();
const inflight = new Map<string, Promise<Admin1Names>>();
const failedAt = new Map<string, number>();

/** 시험용 — 모듈 캐시 비우기 */
export function resetAdmin1NamesCache(): void {
  loaded.clear();
  inflight.clear();
  failedAt.clear();
}

export function loadAdmin1Names(countryCode: string, opts: LoadOpts = {}): Promise<Admin1Names> {
  if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode)) return Promise.resolve({});
  const hit = loaded.get(countryCode);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(countryCode);
  if (pending) return pending;
  const now = (opts.now ?? Date.now)();
  const failed = failedAt.get(countryCode);
  if (failed !== undefined && now - failed < ADMIN1_NAMES_RETRY_MS) return Promise.resolve({});

  const fetchImpl = opts.fetchImpl ?? fetch;
  const p = (async (): Promise<Admin1Names> => {
    try {
      const res = await fetchImpl(`/geo-names/v1/${countryCode}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
      loaded.set(countryCode, data as Admin1Names);
      failedAt.delete(countryCode);
      return data as Admin1Names;
    } catch {
      failedAt.set(countryCode, now);
      return {};
    } finally {
      inflight.delete(countryCode);
    }
  })();
  inflight.set(countryCode, p);
  return p;
}

/** 표시 이름. 요청 언어 → 영어 → 한국어 → 코드 그대로. */
export function admin1Label(code: string, names: Admin1Names, lang: Admin1Lang = "ko"): string {
  const n = names[code];
  return n?.[lang] || n?.en || n?.ko || code;
}
