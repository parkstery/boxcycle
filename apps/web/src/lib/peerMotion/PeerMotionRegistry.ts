import type { LineStringGeometry, LngLat } from "../geo";
import {
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
} from "../geo";
import {
  PEER_DRIVE_SIM_GRACE_MS,
  PEER_INTERP_DELAY_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
} from "../rideSyncPolicy";
import { estimateCrankRpmFromSpeedKmh } from "../riderPedalMotion";
import { PEER_RIDER_PEDAL_FRAME_COUNT } from "../registerPeerRiderPedalSprites";
import {
  applyPeerMotionIngest,
  clampRouteDist,
  createPeerMotionEntity,
  stepPeerMotionEntity,
} from "./integrator";
import type { PeerMotionEntity, PeerMotionPacket } from "./types";
import { getPeerSyncSelfDistM } from "./peerSyncDebug";
import { peerSyncChainLog, peerSyncChainShouldEmit } from "./peerSyncChainLog";

const PEER_MAX = 30;

export type PeerMotionRenderFeature = {
  id: string;
  label: string;
  lngLat: LngLat;
  hdg: number;
  pframe: number;
};

/** DEV — 라벨에서 뺀 ▸d·n·s·gap·b·a */
export type PeerStepDiag = {
  uid: string;
  d: number;
  n: number;
  s: number;
  gap: number;
  b: number;
  a: number;
};

function publishPeerStepDiag(rows: PeerStepDiag[]): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as Window & { __RTW_PEER_STEP_DIAG__?: PeerStepDiag[] };
  w.__RTW_PEER_STEP_DIAG__ = rows;
}

let singleton: PeerMotionRegistry | null = null;

export class PeerMotionRegistry {
  private readonly entities = new Map<string, PeerMotionEntity>();
  private activeUids = new Set<string>();

  ingest(packet: PeerMotionPacket, label: string): void {
    if (!packet.uid || !packet.publicationId.trim()) return;
    if (packet.distM < 0 || !Number.isFinite(packet.distM)) return;

    // 보간 모델 — 정렬·dedup·단조 처리는 applyPeerMotionIngest 가 버퍼에 담당.
    const cur = this.entities.get(packet.uid);
    let result: "accepted" | "dup-same-dist" | "discard-forward" | "discard-retrograde" =
      "accepted";
    let newestDist = packet.distM;
    if (cur) {
      const newest = cur.buffer[cur.buffer.length - 1];
      newestDist = newest?.distM ?? packet.distM;
      result = applyPeerMotionIngest(cur, packet, label);
    } else {
      this.entities.set(packet.uid, createPeerMotionEntity(packet, label));
    }
    if (import.meta.env.DEV) {
      peerSyncChainLog(5, packet.seq, {
        result,
        newest: newestDist,
        d: packet.distM,
        uid: packet.uid.slice(0, 6),
      });
    }
    this.activeUids.add(packet.uid);
  }

  /** ingest 배치 후 호출 — 목록에 없는 uid 는 grace 후 제거 */
  markActiveUids(uids: Iterable<string>): void {
    this.activeUids = new Set(uids);
  }

  remove(uid: string): void {
    this.entities.delete(uid);
    this.activeUids.delete(uid);
  }

  clear(): void {
    this.entities.clear();
    this.activeUids.clear();
  }

  pruneInactive(nowMs = Date.now()): void {
    for (const uid of [...this.entities.keys()]) {
      if (this.activeUids.has(uid)) continue;
      const e = this.entities.get(uid)!;
      if (nowMs - e.lastIngestLocalMs > PEER_DRIVE_SIM_GRACE_MS) {
        this.entities.delete(uid);
      }
    }
  }

  step(dtSec: number, routeGeometry: LineStringGeometry | null, nowMs: number = Date.now()): void {
    const routeLenM = routeGeometry ? lineStringLengthMeters(routeGeometry) : 0;
    const clampedDt = Math.min(0.12, Math.max(0, dtSec));
    for (const entity of this.entities.values()) {
      stepPeerMotionEntity(entity, clampedDt, routeLenM, nowMs);
    }
  }

  buildRenderFeatures(routeGeometry: LineStringGeometry | null): PeerMotionRenderFeature[] {
    if (!routeGeometry) {
      publishPeerStepDiag([]);
      return [];
    }
    const routeLenM = lineStringLengthMeters(routeGeometry);
    const out: PeerMotionRenderFeature[] = [];
    const peerStepDiagOut: PeerStepDiag[] = [];
    let n = 0;
    const nowMs = Date.now();
    const emitChain = peerSyncChainShouldEmit(nowMs);
    for (const entity of this.entities.values()) {
      if (n >= PEER_MAX) break;
      const beforeClamp = entity.displayDistM;
      const distM = clampRouteDist(entity.displayDistM, routeLenM);
      const clamped = distM !== beforeClamp && routeLenM > 0;
      const lngLat = getPointOnRouteByDistance(routeGeometry, distM);
      if (!lngLat) continue;
      const h = headingAtRouteDistanceMeters(routeGeometry, distM) ?? 0;
      const moving = entity.phase === "live" && entity.speedMps > 0.02;
      if (h !== 0 || moving) entity.hdg = h;

      const spd =
        entity.phase === "paused" || entity.phase === "completed"
          ? 0
          : entity.speedMps > 0.02
            ? entity.speedMps * 3.6
            : entity.pedalSpeedKmh;
      if (spd > 0.38) {
        const rpm = estimateCrankRpmFromSpeedKmh(spd);
        entity.phaseRev += (rpm / 60) * 0.016;
      }
      const pframeRaw =
        spd > 0.38
          ? ((Math.floor((entity.phaseRev % 1) * PEER_RIDER_PEDAL_FRAME_COUNT) %
              PEER_RIDER_PEDAL_FRAME_COUNT) +
              PEER_RIDER_PEDAL_FRAME_COUNT) %
            PEER_RIDER_PEDAL_FRAME_COUNT
          : 0;

      const mapLabel = entity.label;
      if (import.meta.env.DEV) {
        const newest = entity.buffer[entity.buffer.length - 1];
        const ageMs = newest ? nowMs - newest.recvAtMs : -1;
        const self = getPeerSyncSelfDistM();
        const d = Math.round(entity.displayDistM);
        const newestDist = newest ? Math.round(newest.distM) : 0;
        const s = Math.round(self);
        const gap = Math.round((newest ? newest.distM : 0) - self);
        const b = entity.buffer.length;
        const a = Math.round(ageMs / 100) / 10;
        peerStepDiagOut.push({
          uid: entity.uid.slice(0, 6),
          d,
          n: newestDist,
          s,
          gap,
          b,
          a,
        });
        if (emitChain) {
          logStepModeDiag(entity, nowMs, routeLenM);
          peerSyncChainLog(7, newest?.seq, {
            lng: lngLat[0],
            lat: lngLat[1],
            routeLen: routeLenM,
            clamped: clamped ? 1 : 0,
            displayDistM: distM,
            uid: entity.uid.slice(0, 6),
          });
        }
      }

      out.push({
        id: entity.uid,
        label: mapLabel,
        lngLat,
        hdg: Number.isFinite(entity.hdg) ? entity.hdg : 0,
        pframe: Number.isFinite(pframeRaw) ? pframeRaw : 0,
      });
      n += 1;
    }
    publishPeerStepDiag(peerStepDiagOut);
    return out;
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  /** DEV 진단 — 보간 상태(버퍼·렌더 지연·newest 거리) */
  debugSnapshot(nowMs = Date.now()): Array<{
    uid: string;
    phase: PeerMotionEntity["phase"];
    buf: number;
    displayDistM: number;
    newestDistM: number;
    speedMps: number;
    newestAgeMs: number;
    d: number;
    n: number;
    s: number;
    gap: number;
    b: number;
    a: number;
  }> {
    const out = [];
    const self = getPeerSyncSelfDistM();
    for (const e of this.entities.values()) {
      const newest = e.buffer[e.buffer.length - 1];
      const newestDistM = newest ? newest.distM : 0;
      const newestAgeMs = newest ? nowMs - newest.recvAtMs : -1;
      out.push({
        uid: e.uid.slice(0, 6),
        phase: e.phase,
        buf: e.buffer.length,
        displayDistM: Math.round(e.displayDistM * 10) / 10,
        newestDistM: newest ? Math.round(newest.distM * 10) / 10 : 0,
        speedMps: Math.round(e.speedMps * 100) / 100,
        newestAgeMs,
        d: Math.round(e.displayDistM),
        n: Math.round(newestDistM),
        s: Math.round(self),
        gap: Math.round(newestDistM - self),
        b: e.buffer.length,
        a: Math.round(newestAgeMs / 100) / 10,
      });
    }
    return out;
  }
}

/** DEV — step 분기 관찰만. integrator 공식은 건드리지 않는다. */
function logStepModeDiag(entity: PeerMotionEntity, nowMs: number, routeLenM: number): void {
  const buf = entity.buffer;
  if (buf.length === 0) return;
  const newest = buf[buf.length - 1]!;
  const oldest = buf[0]!;
  const renderTime = nowMs - PEER_INTERP_DELAY_MS;
  const newestAgeMs = nowMs - newest.recvAtMs;
  let mode: "paused" | "oldest" | "interpolate" | "extrapolate";
  const extra: Record<string, string | number | boolean | null> = {};

  if (entity.phase === "paused" || entity.phase === "completed") {
    mode = "paused";
    extra.newestSeq = newest.seq ?? null;
    extra.newestDist = newest.distM;
  } else if (renderTime <= oldest.recvAtMs) {
    mode = "oldest";
    extra.oldestSeq = oldest.seq ?? null;
    extra.oldestRecv = oldest.recvAtMs;
    extra.oldestDist = oldest.distM;
  } else if (renderTime >= newest.recvAtMs) {
    mode = "extrapolate";
    const aheadRaw = renderTime - newest.recvAtMs;
    const aheadCap = Math.min(aheadRaw, PEER_INTERP_MAX_EXTRAP_MS);
    extra.newestSeq = newest.seq ?? null;
    extra.newestRecv = newest.recvAtMs;
    extra.newestDist = newest.distM;
    extra.aheadMsRaw = aheadRaw;
    extra.aheadMs = aheadCap;
    extra.capHit = aheadRaw > PEER_INTERP_MAX_EXTRAP_MS ? 1 : 0;
  } else {
    mode = "interpolate";
    let s0 = oldest;
    let s1 = newest;
    for (let i = 1; i < buf.length; i += 1) {
      if (buf[i]!.recvAtMs >= renderTime) {
        s1 = buf[i]!;
        s0 = buf[i - 1]!;
        break;
      }
    }
    const span = s1.recvAtMs - s0.recvAtMs;
    const t = span > 0 ? (renderTime - s0.recvAtMs) / span : 0;
    extra.s0Seq = s0.seq ?? null;
    extra.s1Seq = s1.seq ?? null;
    extra.s0Recv = s0.recvAtMs;
    extra.s1Recv = s1.recvAtMs;
    extra.s0Dist = s0.distM;
    extra.s1Dist = s1.distM;
    extra.t = t;
  }

  peerSyncChainLog(6, null, {
    mode,
    renderTime,
    newestAgeMs,
    buf: buf.length,
    displayDistM: entity.displayDistM,
    entitySpeedMps: entity.speedMps,
    routeLen: routeLenM,
    uid: entity.uid.slice(0, 6),
    ...extra,
  });
}

export function getPeerMotionRegistry(): PeerMotionRegistry {
  if (!singleton) singleton = new PeerMotionRegistry();
  return singleton;
}

/** 테스트 / trail 전환 시 */
export function resetPeerMotionRegistry(): void {
  singleton?.clear();
  singleton = null;
}
