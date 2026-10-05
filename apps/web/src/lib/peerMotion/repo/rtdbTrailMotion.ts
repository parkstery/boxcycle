import {
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { User } from "firebase/auth";
import { getFirebaseApp, getFirebaseDatabase, isFirebaseDatabaseConfigured } from "../../firebase/app";
import { sanitizeTrailId } from "../../trail/trailId";
import type { TrailLiveRidePhase } from "../../trail/trailTypes";
import {
  beginMotionInFlight,
  endMotionInFlight,
  peerSyncChainLog,
  peekMotionInFlightMax,
} from "../peerSyncChainLog";
import { trackUnderlyingReadSubscription } from "../../debug/readSubscriptionMeters";
import {
  noteRtdbMotionWriteAttempt,
  noteRtdbMotionWriteError,
  noteRtdbMotionWriteOk,
} from "../../debug/trafficPublishMeters";
import {
  quantizeMotionWireDistM,
  quantizeMotionWireSpeedMps,
} from "../motionWireQuantize";

/** RTDB `/trails/{trailId}/motion/{uid}` */
export const RTDB_TRAIL_MOTION_SEGMENT = "motion";

/**
 * 동행 motion 전송이 가능한 환경인가.
 *
 * 2026-09-26 (Phase 6-③B): 주행 쪽 두 모듈이 `isFirebaseDatabaseConfigured()` 를 직접
 * 물어보고 있었다. **어느 인프라를 쓰는지는 전송의 사정**이고, 주행이 알아야 할 것은
 * 「지금 motion 을 보낼 수 있나」뿐이다. RTDB 를 다른 것으로 바꿔도 묻는 쪽은 그대로다.
 */
export function isMotionTransportConfigured(): boolean {
  return isFirebaseDatabaseConfigured();
}

/**
 * 이 사용자의 동행 전송 흔적을 치운다.
 *
 * 2026-09-26 (Phase 6-③): 주행 쪽 정리 코드가 `deleteTrailMotion` 을 직접 불렀다.
 * **어디에 무엇이 남는지는 전송의 사정**이고, 주행이 시키는 것은 「내 것 치워라」뿐이다.
 * 지금은 RTDB 노드 하나지만, 늘어나도 부르는 쪽은 바뀌지 않는다.
 */
export async function cleanupPeerMotionPublish(uid: string, trailId: string): Promise<void> {
  await deleteTrailMotion(uid, trailId);
}

export type RtdbTrailMotionSnapshot = {
  publicationId: string;
  distM: number;
  speedMps: number;
  ridePhase: TrailLiveRidePhase;
  /** 캡처 순간 추정 서버시각 — encode 재샘플 금지 */
  tSrv?: number;
};

export type RtdbTrailMotionRow = {
  uid: string;
  publicationId: string;
  distM: number;
  speedMps: number;
  ridePhase: TrailLiveRidePhase;
  serverAtMs: number;
  /** wire optional — 캡처 순간 추정 서버시각 */
  tSrv?: number;
  /** DEV S3-DIAG — encodePayload `s` (없을 수 있음) */
  seq?: number;
};

type RtdbMotionPayload = {
  p: string;
  d: number;
  v: number;
  ph: TrailLiveRidePhase;
  t: number;
  /** optional — capture-time estimated server ms */
  tSrv?: number;
  /** DEV S3-DIAG 상관 ID — 없어도 decode 됨 */
  s?: number;
};

const onDisconnectArmed = new Set<string>();

function motionRef(db: Database, trailId: string, uid: string) {
  const tid = sanitizeTrailId(trailId);
  return ref(db, `trails/${tid}/${RTDB_TRAIL_MOTION_SEGMENT}/${uid}`);
}

function trailMotionCollectionRef(db: Database, trailId: string) {
  const tid = sanitizeTrailId(trailId);
  return ref(db, `trails/${tid}/${RTDB_TRAIL_MOTION_SEGMENT}`);
}

function disconnectKey(trailId: string, uid: string): string {
  return `${sanitizeTrailId(trailId)}:${uid}`;
}

/** 시험 대상 — RTDB 규칙(.validate)과의 계약을 `scripts/peer-sync/rtdb-rules-contract.test.ts` 가 대조한다. */
export function encodePayload(input: RtdbTrailMotionSnapshot, seq?: number): RtdbMotionPayload {
  const payload: RtdbMotionPayload = {
    p: input.publicationId.trim(),
    d: quantizeMotionWireDistM(input.distM),
    v: quantizeMotionWireSpeedMps(input.speedMps),
    ph: input.ridePhase,
    t: Date.now(),
  };
  if (typeof input.tSrv === "number" && Number.isFinite(input.tSrv) && input.tSrv > 0) {
    // 캡처 스냅샷 시각 유지 — encode 직전 재샘플 금지.
    payload.tSrv = Math.floor(input.tSrv);
  }
  if (import.meta.env.DEV && typeof seq === "number" && Number.isFinite(seq)) {
    payload.s = Math.floor(seq);
  }
  return payload;
}

function decodeRow(uid: string, val: unknown): RtdbTrailMotionRow | null {
  if (!val || typeof val !== "object") return null;
  const o = val as Record<string, unknown>;
  const publicationId = typeof o.p === "string" ? o.p.trim() : "";
  const distM = typeof o.d === "number" ? o.d : Number.NaN;
  const speedMps = typeof o.v === "number" ? o.v : 0;
  const ridePhase = o.ph;
  const serverAtMs = typeof o.t === "number" ? o.t : 0;
  const tSrvRaw = o.tSrv;
  const tSrv =
    typeof tSrvRaw === "number" && Number.isFinite(tSrvRaw) && tSrvRaw > 0
      ? tSrvRaw
      : undefined;
  const seqRaw = o.s;
  const seq =
    typeof seqRaw === "number" && Number.isFinite(seqRaw) ? Math.floor(seqRaw) : undefined;
  if (!publicationId || !Number.isFinite(distM)) return null;
  if (ridePhase !== "live" && ridePhase !== "paused" && ridePhase !== "completed") return null;
  return {
    uid,
    publicationId,
    distM: Math.max(0, distM),
    speedMps: Math.max(0, speedMps),
    ridePhase,
    serverAtMs,
    ...(tSrv != null ? { tSrv } : {}),
    ...(seq != null ? { seq } : {}),
  };
}

/** 시험·하네스 — wire payload → row (구버전 tSrv 생략 포함) */
export function decodeTrailMotionPayload(
  uid: string,
  val: unknown,
): RtdbTrailMotionRow | null {
  return decodeRow(uid, val);
}

async function ensureMotionOnDisconnect(trailId: string, uid: string): Promise<void> {
  const key = disconnectKey(trailId, uid);
  if (onDisconnectArmed.has(key)) return;
  const db = getFirebaseDatabase();
  const r = motionRef(db, trailId, uid);
  await onDisconnect(r).remove();
  onDisconnectArmed.add(key);
}

/** 5Hz — ephemeral peer motion (Firestore livePublicationRides 는 presence/heat fallback) */
export async function mergeTrailMotionSnapshot(
  user: User,
  trailId: string,
  input: RtdbTrailMotionSnapshot,
  opts?: { seq?: number; snapshotCapturedAt?: number; epoch?: number },
): Promise<{ ok: boolean; rttMs: number; d: number; v: number; seq?: number }> {
  const seq = opts?.seq;
  const payload = encodePayload(input, seq);
  if (!isFirebaseDatabaseConfigured()) {
    return { ok: false, rttMs: 0, d: payload.d, v: payload.v, seq };
  }
  if (!input.publicationId.trim()) {
    return { ok: false, rttMs: 0, d: payload.d, v: payload.v, seq };
  }
  beginMotionInFlight();
  try {
    getFirebaseApp();
    await ensureMotionOnDisconnect(trailId, user.uid);
    const db = getFirebaseDatabase();
    const motionWriteStartAt = Date.now();
    // DEV fault injection stays before meters — synthetic throw must not count as a set attempt/error.
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const n = Number(window.__rtwMotionWriteFaultOnce);
      if (Number.isFinite(n) && n > 0) {
        window.__rtwMotionWriteFaultOnce = n - 1;
        throw new Error("rtw-motion-write-fault-once");
      }
    }
    const writeTicket = noteRtdbMotionWriteAttempt();
    try {
      await set(motionRef(db, trailId, user.uid), payload);
      noteRtdbMotionWriteOk(writeTicket, payload);
    } catch (writeErr) {
      noteRtdbMotionWriteError(writeTicket);
      throw writeErr;
    }
    const motionWriteDoneAt = Date.now();
    const writeRttMs = motionWriteDoneAt - motionWriteStartAt;
    const capturedAt = opts?.snapshotCapturedAt;
    const publishQueueMs =
      typeof capturedAt === "number" ? motionWriteStartAt - capturedAt : undefined;
    if (import.meta.env.DEV && seq != null) {
      peerSyncChainLog(3, seq, {
        d: payload.d,
        v: payload.v,
        ok: 1,
        capturedAt: capturedAt ?? null,
        writeStart: motionWriteStartAt,
        writeDone: motionWriteDoneAt,
        publishQueueMs: publishQueueMs ?? null,
        writeRttMs,
        inFlightMax: peekMotionInFlightMax(),
        fsAhead: 0,
        uid: user.uid.slice(0, 6),
        ...(typeof opts?.epoch === "number" ? { epoch: opts.epoch } : {}),
      });
    }
    return { ok: true, rttMs: writeRttMs, d: payload.d, v: payload.v, seq };
  } catch (e) {
    if (import.meta.env.DEV && seq != null) {
      peerSyncChainLog(3, seq, {
        d: payload.d,
        v: payload.v,
        ok: 0,
        uid: user.uid.slice(0, 6),
        ...(typeof opts?.epoch === "number" ? { epoch: opts.epoch } : {}),
      });
    }
    throw e;
  } finally {
    endMotionInFlight();
  }
}

export async function deleteTrailMotion(uid: string, trailId: string): Promise<void> {
  if (!isFirebaseDatabaseConfigured()) return;
  onDisconnectArmed.delete(disconnectKey(trailId, uid));
  const db = getFirebaseDatabase();
  await remove(motionRef(db, trailId, uid)).catch((e) => {
    if (import.meta.env.DEV) {
      const message = e instanceof Error ? e.message : String(e);
      console.debug("[deleteTrailMotion] failed", message);
    }
  });
}

export function subscribeTrailMotion(
  trailId: string,
  onChange: (rows: RtdbTrailMotionRow[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  if (!isFirebaseDatabaseConfigured()) {
    onChange([]);
    return () => {};
  }
  getFirebaseApp();
  const db = getFirebaseDatabase();
  return trackUnderlyingReadSubscription(
    "rtdbOnValue",
    onValue(
      trailMotionCollectionRef(db, trailId),
      (snap) => {
        const rows: RtdbTrailMotionRow[] = [];
        const val = snap.val();
        if (val && typeof val === "object") {
          for (const [uid, node] of Object.entries(val as Record<string, unknown>)) {
            const row = decodeRow(uid, node);
            if (row) rows.push(row);
          }
        }
        onChange(rows);
      },
      (err) => onError?.(new Error(String(err))),
    ),
  );
}

export function snapshotToRtdbTrailMotionSnapshot(snapshot: {
  publicationId: string;
  distMetersAlongRoute: number;
  speedMps: number;
  routeRidePhase: "live" | "paused";
  tSrv?: number;
}): RtdbTrailMotionSnapshot {
  return {
    publicationId: snapshot.publicationId,
    distM: snapshot.distMetersAlongRoute,
    speedMps: snapshot.speedMps,
    ridePhase: snapshot.routeRidePhase,
    ...(typeof snapshot.tSrv === "number" && Number.isFinite(snapshot.tSrv) && snapshot.tSrv > 0
      ? { tSrv: snapshot.tSrv }
      : {}),
  };
}
