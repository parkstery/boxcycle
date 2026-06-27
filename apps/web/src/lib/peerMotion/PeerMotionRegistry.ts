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
    if (cur) {
      applyPeerMotionIngest(cur, packet, label);
    } else {
      this.entities.set(packet.uid, createPeerMotionEntity(packet, label));
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
    for (const entity of this.entities.values()) {
      if (n >= PEER_MAX) break;
      const distM = clampRouteDist(entity.displayDistM, routeLenM);
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
      const mapLabel =
        speedKmhLive != null && speedKmhLive > 0
          ? `${entity.label} · ${speedKmhLive} km/h`.slice(0, 56)
          : entity.label;

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
