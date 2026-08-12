/**
 * S3-DIAG — DEV 전용 패킷 체인 로그 (①~⑦).
 * 게이트는 `[peerSync]` 와 동일: `?peerSyncLogMs=` (기본 1000).
 */

/** 페이지 로드마다 다른 대역 — 2-browser 에서 seq 숫자 충돌 방지 */
let chainSeq = Math.floor(Math.random() * 800_000_000) + 100_000;
let lastEmitAt = 0;

export function nextPeerSyncChainSeq(): number {
  chainSeq += 1;
  return chainSeq;
}

export function peerSyncChainLogMs(): number {
  if (typeof location === "undefined") return 1_000;
  const raw = Number(new URLSearchParams(location.search).get("peerSyncLogMs"));
  return Number.isFinite(raw) && raw > 0 ? raw : 1_000;
}

/** 스로틀 — ①~③ 발행 경로는 seq 마다 남기고, ⑥⑦ 은 peerSyncLogMs 간격 */
export function peerSyncChainShouldEmit(nowMs = Date.now(), force = false): boolean {
  if (!import.meta.env.DEV) return false;
  if (force) return true;
  if (nowMs - lastEmitAt < peerSyncChainLogMs()) return false;
  lastEmitAt = nowMs;
  return true;
}

export type PeerSyncChainPoint = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9;

/** DEV — 동시 motion write in-flight (§2-3). 감소는 호출측 finally. */
let motionInFlight = 0;
let motionInFlightMax = 0;

export function beginMotionInFlight(): number {
  motionInFlight += 1;
  if (motionInFlight > motionInFlightMax) motionInFlightMax = motionInFlight;
  return motionInFlight;
}

export function endMotionInFlight(): number {
  motionInFlight = Math.max(0, motionInFlight - 1);
  return motionInFlight;
}

export function peekMotionInFlight(): number {
  return motionInFlight;
}

export function peekMotionInFlightMax(): number {
  return motionInFlightMax;
}

const firstSeen = new Map<string, { at: number; repeats: number }>();

export function notePeerSeqSeen(
  uid: string,
  seq: number | undefined,
  nowMs: number,
): { first: boolean; firstSeenAt: number; repeatSeenCount: number } {
  const key = `${uid}:${seq ?? "none"}`;
  const prev = firstSeen.get(key);
  if (!prev) {
    firstSeen.set(key, { at: nowMs, repeats: 0 });
    return { first: true, firstSeenAt: nowMs, repeatSeenCount: 0 };
  }
  prev.repeats += 1;
  return { first: false, firstSeenAt: prev.at, repeatSeenCount: prev.repeats };
}

/** 파싱 친화 한 줄: `[peerSyncChain] pt=N seq=… k=v …` */
export function peerSyncChainLog(
  pt: PeerSyncChainPoint,
  seq: number | null | undefined,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!import.meta.env.DEV) return;
  const parts: string[] = [`pt=${pt}`];
  if (seq != null && Number.isFinite(seq)) parts.push(`seq=${seq}`);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (v === null) {
      parts.push(`${k}=null`);
      continue;
    }
    if (typeof v === "number") {
      parts.push(`${k}=${Number.isFinite(v) ? (Math.round(v * 1000) / 1000) : "NaN"}`);
      continue;
    }
    if (typeof v === "boolean") {
      parts.push(`${k}=${v ? 1 : 0}`);
      continue;
    }
    parts.push(`${k}=${String(v)}`);
  }
  console.debug(`[peerSyncChain] ${parts.join(" ")}`);
}
