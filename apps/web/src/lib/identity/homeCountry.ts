/**
 * 대표 국가(`users/{uid}.homeCountry`) — 거리 순위를 국가로 묶는 기준(계획 00-plan §4.2, D2·D13·D15).
 *
 * - 저장은 ISO 3166-1 alpha-2 두 글자. 이름은 화면 언어로 그때그때 바꿔 보여 준다(저장하지 않음).
 * - 미리 채우기는 기기 시간대 → 국가 표. 언어 설정(en-US 를 쓰는 한국 사용자)보다 정확하다. GPS·IP 는 쓰지 않는다.
 * - 바꾸기는 30일에 한 번(작은 나라로 옮겨 1위를 차지하는 조작 방지). 서버 Rules 가 같은 기준으로 막는다.
 * - 게스트는 묻지 않는다.
 */
import { HOME_COUNTRY_BY_TIME_ZONE, HOME_COUNTRY_CODES } from "./homeCountryZones";

export const HOME_COUNTRY_CHANGE_COOLDOWN_DAYS = 30;
const DAY_MS = 86_400_000;
const CODE_SET = new Set(HOME_COUNTRY_CODES);

export function isValidHomeCountry(code: unknown): code is string {
  return typeof code === "string" && CODE_SET.has(code);
}

/** 기기 시간대로 고른 국가. 모르는 시간대(UTC 등)면 null — 사용자가 직접 고른다. */
export function guessHomeCountryFromTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  const cc = HOME_COUNTRY_BY_TIME_ZONE[timeZone];
  return cc && CODE_SET.has(cc) ? cc : null;
}

export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function guessHomeCountryFromDevice(): string | null {
  return guessHomeCountryFromTimeZone(deviceTimeZone());
}

/** 국가 코드 → 화면 언어 이름(대한민국). 모르면 코드 그대로 */
export function homeCountryLabel(code: string, locale = "ko"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export type HomeCountryOption = { code: string; label: string };

/** 선택 상자 목록 — 화면 언어 이름순. 이름을 모르는 코드는 코드 그대로. */
export function listHomeCountryOptions(locale = "ko"): HomeCountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  const rows = HOME_COUNTRY_CODES.map((code) => ({ code, label: names?.of(code) ?? code }));
  return rows.sort((a, b) => a.label.localeCompare(b.label, locale));
}

/** 마지막 변경 뒤 30일 안이면 풀리는 시각(ms), 아니면 null. 처음 정하는 것은 막지 않는다. */
export function homeCountryChangeBlockedUntilMs(lastChangedAtMs: number | null, nowMs: number): number | null {
  if (lastChangedAtMs == null) return null;
  const until = lastChangedAtMs + HOME_COUNTRY_CHANGE_COOLDOWN_DAYS * DAY_MS;
  return nowMs > until ? null : until;
}
