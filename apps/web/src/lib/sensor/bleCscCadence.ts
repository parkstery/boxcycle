/**
 * BLE CSC(Cycling Speed and Cadence) 크랭크 케이던스 — 순수 로직.
 *
 * Web Bluetooth·GATT·React 를 전혀 모른다. 훅(`useBleCrankRpm`)은 이 모듈에
 * 패킷과 시각(ms)만 넘기고, 여기서 나온 rpm 을 그대로 상태로 쓴다.
 * 덕분에 센서 없이도 파서·rollover·정지 판정을 Node 시험으로 고정할 수 있다.
 */

export const CSC_SERVICE_UUID = "00001816-0000-1000-8000-00805f9b34fb";
export const CSC_MEASUREMENT_UUID = "00002a5b-0000-1000-8000-00805f9b34fb";

/** CSC Measurement flags bit0 — Wheel Revolution Data Present(6바이트) */
export const FLAG_WHEEL_REV = 1;
/** CSC Measurement flags bit1 — Crank Revolution Data Present(4바이트) */
export const FLAG_CRANK_REV = 2;

/** EMA 평활 계수 — 클수록 즉응, 작을수록 안정 */
export const RPM_EMA_ALPHA = 0.35;
/** 물리적으로 불가능한 케이던스는 파싱 오류로 보고 버린다 */
export const CRANK_RPM_MAX = 220;
/** 이보다 짧은 이벤트 간격은 분해능 부족 — 계산에 쓰지 않는다 */
export const MIN_EVENT_DT_SEC = 0.08;
/**
 * 이보다 긴 간격은 「정지 후 재개」로 본다. 크랭크 이벤트 시간이 1/1024초 uint16
 * (약 64초 wrap)이므로 긴 공백의 delta 는 신뢰할 수 없다 — 재기준점만 잡는다.
 */
export const MAX_EVENT_DT_SEC = 4;
/** 마지막 크랭크 회전 후 이 시간이 지나면 「페달 정지(0rpm)」로 확정한다 */
export const CRANK_STALL_MS = 2500;

export type CscCrankSample = {
  /** 누적 크랭크 회전수(uint16, wrap) */
  revs: number;
  /** 마지막 크랭크 이벤트 시각(1/1024초 단위, uint16, wrap) */
  time1024: number;
};

/**
 * CSC Measurement 패킷에서 크랭크 필드를 뽑는다.
 * 크랭크 플래그가 없거나(휠 전용 센서) 길이가 모자라면 `null`.
 */
export function parseCscCrankSample(view: DataView): CscCrankSample | null {
  if (view.byteLength < 1) return null;
  const flags = view.getUint8(0);
  let o = 1;
  if (flags & FLAG_WHEEL_REV) {
    if (view.byteLength < o + 6) return null;
    o += 6;
  }
  if ((flags & FLAG_CRANK_REV) === 0) return null;
  if (view.byteLength < o + 4) return null;
  return {
    revs: view.getUint16(o, true),
    time1024: view.getUint16(o + 2, true),
  };
}

/** uint16 wrap 을 고려한 증가분 */
export function u16Delta(cur: number, prev: number): number {
  let d = cur - prev;
  if (d < 0) d += 65536;
  return d;
}

export type CscCadenceTracker = {
  /**
   * 현재 케이던스.
   * - `null`: 아직 유효한 크랭크 샘플을 계산하지 못함
   * - `0`: 연결은 살아 있으나 페달링 정지
   * - `> 0`: 유효 케이던스
   */
  readonly rpm: number | null;
  /** 연결 직후·재연결 시 호출 */
  reset(nowMs: number): void;
  /** 알림 패킷 1건 반영 후 현재 rpm 을 돌려준다 */
  ingest(view: DataView, nowMs: number): number | null;
  /** 주기 폴링 — 정지 판정(0rpm)만 담당 */
  pollStall(nowMs: number): number | null;
};

/**
 * 패킷 스트림 → rpm. 「한 번도 못 봤음(null)」과 「연결됐지만 멈춤(0)」을 구분한다.
 * 이 구분이 있어야 정지 상태를 슬라이더 fallback 으로 오인하지 않는다.
 */
export function createCscCadenceTracker(): CscCadenceTracker {
  let rpm: number | null = null;
  let ema: number | null = null;
  let prev: CscCrankSample | null = null;
  let lastRevChangeMs = 0;

  return {
    get rpm() {
      return rpm;
    },
    reset(nowMs: number) {
      rpm = null;
      ema = null;
      prev = null;
      lastRevChangeMs = nowMs;
    },
    ingest(view: DataView, nowMs: number) {
      const sample = parseCscCrankSample(view);
      if (!sample) return rpm;

      const before = prev;
      prev = sample;
      if (!before) return rpm;

      const dRev = u16Delta(sample.revs, before.revs);
      // 페달 정지 중에도 센서는 같은 값을 계속 보낸다 — 정지 확정은 pollStall 이 한다.
      if (dRev < 1) return rpm;

      const dtSec = u16Delta(sample.time1024, before.time1024) / 1024;
      if (dtSec < MIN_EVENT_DT_SEC || dtSec > MAX_EVENT_DT_SEC) return rpm;

      const instant = (dRev / dtSec) * 60;
      if (!Number.isFinite(instant) || instant <= 0 || instant > CRANK_RPM_MAX) return rpm;

      ema = ema == null ? instant : ema * (1 - RPM_EMA_ALPHA) + instant * RPM_EMA_ALPHA;
      rpm = ema;
      lastRevChangeMs = nowMs;
      return rpm;
    },
    pollStall(nowMs: number) {
      // 유효 샘플을 한 번도 못 봤으면 계속 null — 「연결됨 · 페달을 돌려 확인하세요」.
      if (rpm == null || rpm === 0) return rpm;
      if (nowMs - lastRevChangeMs <= CRANK_STALL_MS) return rpm;
      rpm = 0;
      ema = null;
      // 정지 구간의 이벤트 시간 delta 는 wrap 위험이 있다 — 재개 시 재기준점부터.
      prev = null;
      return rpm;
    },
  };
}
