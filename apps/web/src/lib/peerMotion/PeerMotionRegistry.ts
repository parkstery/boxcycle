import type { LineStringGeometry, LngLat } from "../geo";
import {
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
} from "../geo";
import { PEER_DRIVE_SIM_GRACE_MS } from "../rideSyncPolicy";
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
    if (!routeGeometry) return [];
    const routeLenM = lineStringLengthMeters(routeGeometry);
    const out: PeerMotionRenderFeature[] = [];
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

      const speedKmhLive =
        entity.phase === "live" && entity.speedMps > 0.02
          ? Math.round(entity.speedMps * 3.6)
          : null;
      let mapLabel =
        speedKmhLive != null && speedKmhLive > 0
          ? `${entity.label} · ${speedKmhLive} km/h`.slice(0, 56)
          : entity.label;

      if (import.meta.env.DEV) {
        const newest = entity.buffer[entity.buffer.length - 1];
        const ageMs = newest ? nowMs - newest.recvAtMs : -1;
        const self = getPeerSyncSelfDistM();
        mapLabel =
          `${entity.label} ▸d${Math.round(entity.displayDistM)} n${newest ? Math.round(newest.distM) : 0}` +
          ` s${Math.round(self)} gap${Math.round((newest ? newest.distM : 0) - self)}` +
          ` b${entity.buffer.length} a${Math.round(ageMs / 100) / 10}s`;
        if (emitChain) {
          const seq = newest?.seq;
          peerSyncChainLog(6, seq, {
            displayDistM: entity.displayDistM,
            buf: entity.buffer.length,
            age: ageMs,
          });
          peerSyncChainLog(7, seq, {
            lng: lngLat[0],
            lat: lngLat[1],
            routeLen: routeLenM,
            clamped: clamped ? 1 : 0,
            displayDistM: distM,
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
  }> {
    const out = [];
    for (const e of this.entities.values()) {
      const newest = e.buffer[e.buffer.length - 1];
      out.push({
        uid: e.uid.slice(0, 6),
        phase: e.phase,
        buf: e.buffer.length,
        displayDistM: Math.round(e.displayDistM * 10) / 10,
        newestDistM: newest ? Math.round(newest.distM * 10) / 10 : 0,
        speedMps: Math.round(e.speedMps * 100) / 100,
        newestAgeMs: newest ? nowMs - newest.recvAtMs : -1,
      });
    }
    return out;
  }
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
