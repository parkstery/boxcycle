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
import { getFirebaseApp, getFirebaseDatabase, isFirebaseDatabaseConfigured } from "./firebase";
import { sanitizeTrailId } from "./firestoreTrail";
import type { TrailLiveRidePhase } from "./firestoreTrailLivePublicationRides";

/** RTDB `/trails/{trailId}/motion/{uid}` */
export const RTDB_TRAIL_MOTION_SEGMENT = "motion";

export type RtdbTrailMotionSnapshot = {
  publicationId: string;
  distM: number;
  speedMps: number;
  ridePhase: TrailLiveRidePhase;
};

export type RtdbTrailMotionRow = {
  uid: string;
  publicationId: string;
  distM: number;
  speedMps: number;
  ridePhase: TrailLiveRidePhase;
  serverAtMs: number;
};

type RtdbMotionPayload = {
  p: string;
  d: number;
  v: number;
  ph: TrailLiveRidePhase;
  t: number;
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

function encodePayload(input: RtdbTrailMotionSnapshot): RtdbMotionPayload {
  return {
    p: input.publicationId.trim(),
    d: Math.round(Math.max(0, input.distM) * 10) / 10,
    v: Math.round(Math.max(0, input.speedMps) * 100) / 100,
    ph: input.ridePhase,
    t: Date.now(),
  };
}

function decodeRow(uid: string, val: unknown): RtdbTrailMotionRow | null {
  if (!val || typeof val !== "object") return null;
  const o = val as Record<string, unknown>;
  const publicationId = typeof o.p === "string" ? o.p.trim() : "";
  const distM = typeof o.d === "number" ? o.d : Number.NaN;
  const speedMps = typeof o.v === "number" ? o.v : 0;
  const ridePhase = o.ph;
  const serverAtMs = typeof o.t === "number" ? o.t : 0;
  if (!publicationId || !Number.isFinite(distM)) return null;
  if (ridePhase !== "live" && ridePhase !== "paused" && ridePhase !== "completed") return null;
  return {
    uid,
    publicationId,
    distM: Math.max(0, distM),
    speedMps: Math.max(0, speedMps),
    ridePhase,
    serverAtMs,
  };
}

async function ensureMotionOnDisconnect(trailId: string, uid: string): Promise<void> {
  const key = disconnectKey(trailId, uid);
  if (onDisconnectArmed.has(key)) return;
  const db = getFirebaseDatabase();
  const r = motionRef(db, trailId, uid);
  await onDisconnect(r).remove();
  onDisconnectArmed.add(key);
}

/** 5Hz — ephemeral peer motion (Firestore 1Hz 는 presence/heat) */
export async function mergeTrailMotionSnapshot(
  user: User,
  trailId: string,
  input: RtdbTrailMotionSnapshot,
): Promise<void> {
  if (!isFirebaseDatabaseConfigured()) return;
  if (!input.publicationId.trim()) return;
  getFirebaseApp();
  await ensureMotionOnDisconnect(trailId, user.uid);
  const db = getFirebaseDatabase();
  await set(motionRef(db, trailId, user.uid), encodePayload(input));
}

export async function deleteTrailMotion(uid: string, trailId: string): Promise<void> {
  if (!isFirebaseDatabaseConfigured()) return;
  onDisconnectArmed.delete(disconnectKey(trailId, uid));
  const db = getFirebaseDatabase();
  await remove(motionRef(db, trailId, uid)).catch(() => {});
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
  return onValue(
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
  );
}

export function snapshotToRtdbTrailMotionSnapshot(snapshot: {
  publicationId: string;
  distMetersAlongRoute: number;
  speedMps: number;
  routeRidePhase: "live" | "paused";
}): RtdbTrailMotionSnapshot {
  return {
    publicationId: snapshot.publicationId,
    distM: snapshot.distMetersAlongRoute,
    speedMps: snapshot.speedMps,
    ridePhase: snapshot.routeRidePhase,
  };
}
