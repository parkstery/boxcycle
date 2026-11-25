/**
 * 시험용 FPS 패널(`?fps=1`)의 계산부. 지도가 실제로 그린 프레임 시각만 받는다.
 */
export const FPS_WINDOW_MS = 10_000;
const CURRENT_WINDOW_MS = 2_000;
/** 합격 기준 — 최저 1초 24FPS 이상 그리고 p95 41.7ms 이하(2026-11 3D 시험 기준). */
const PASS_MIN_FPS = 24;
const PASS_P95_MS = 41.7;
const STORAGE_KEY = "rtw.fpsPanel";

export type FpsReading = {
  /** 최근 2초. 최근 1초에 그린 프레임이 없으면 null(지도 정지). */
  current: number | null;
  avg: number | null;
  minSecond: number | null;
  p95Ms: number | null;
  /** 10초가 차기 전에는 판정하지 않는다. */
  pass: boolean | null;
  coveredMs: number;
};

export class FpsMeter {
  private times: number[] = [];

  note(now: number): void {
    this.times.push(now);
    const cut = now - FPS_WINDOW_MS;
    if (this.times[0] < cut - 2_000) this.times = this.times.filter((t) => t >= cut);
  }

  reset(): void {
    this.times = [];
  }

  read(now: number): FpsReading {
    const times = this.times.filter((t) => t > now - FPS_WINDOW_MS && t <= now);
    const first = times[0];
    const last = times[times.length - 1];
    if (times.length < 2 || last < now - 1_000) {
      return { current: null, avg: null, minSecond: null, p95Ms: null, pass: null, coveredMs: 0 };
    }
    const recent = times.filter((t) => t > now - CURRENT_WINDOW_MS);
    const current = recent.length > 1 ? ((recent.length - 1) * 1000) / (recent[recent.length - 1] - recent[0]) : null;
    const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
    const p95Ms = gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))];
    const coveredMs = now - first;
    const seconds = Math.floor(coveredMs / 1000);
    let minSecond: number | null = null;
    for (let i = 0; i < seconds; i++) {
      const count = times.filter((t) => t > now - (i + 1) * 1000 && t <= now - i * 1000).length;
      minSecond = minSecond == null ? count : Math.min(minSecond, count);
    }
    const full = coveredMs >= FPS_WINDOW_MS - 250;
    return {
      current,
      avg: ((times.length - 1) * 1000) / (last - first),
      minSecond,
      p95Ms,
      pass: full && minSecond != null ? minSecond >= PASS_MIN_FPS && p95Ms <= PASS_P95_MS : null,
      coveredMs,
    };
  }
}

/** `?fps=1` 로 켜면 이 브라우저에 기억되고 `?fps=0` 으로 끈다. */
export function resolveFpsPanelEnabled(search: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): boolean {
  const raw = new URLSearchParams(search).get("fps");
  try {
    if (raw === "1") storage?.setItem(STORAGE_KEY, "1");
    if (raw === "0") storage?.removeItem(STORAGE_KEY);
    if (raw === "1" || raw === "0") return raw === "1";
    return storage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return raw === "1";
  }
}

let enabledCache: boolean | undefined;
export function isFpsPanelEnabled(): boolean {
  if (enabledCache !== undefined) return enabledCache;
  if (typeof window === "undefined") return false;
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    /* 저장소가 막힌 환경 — 주소 스위치만 쓴다 */
  }
  enabledCache = resolveFpsPanelEnabled(window.location.search, storage);
  return enabledCache;
}
