import type { LineStringGeometry, LngLat } from "../geo/geo";
import {
  getPointOnRouteByDistance,
  headingAtRouteDistanceMeters,
  lineStringLengthMeters,
} from "../geo/geo";
import {
  PEER_DRIVE_SIM_GRACE_MS,
  PEER_INTERP_MAX_EXTRAP_MS,
} from "./peerSyncPolicy";
import { estimateCrankRpmFromSpeedKmh } from "../rider/riderPedalMotion";
import {
  applyPeerMotionIngest,
  clampRouteDist,
  createPeerMotionEntity,
  stepPeerMotionEntity,
  peerRenderTimeMs,
  snapshotTimelineMs,
} from "./integrator";
import type { PeerMotionEntity, PeerMotionPacket } from "./types";
import { PEER_LIVE_RIDE_STALE_MS } from "../trail/trailLivePolicy";
import { notePeerSmoothness } from "../debug/peerSmoothnessProbe";
import { getPeerSyncSelfDistM } from "./peerSyncDebug";
import { peerSyncChainLog, peerSyncChainShouldEmit } from "./peerSyncChainLog";

const PEER_MAX = 30;

export type PeerMotionRenderFeature = {
  id: string;
  label: string;
  lngLat: LngLat;
  hdg: number;
  /**
   * 크랭크 위상 0~1(연속). 페달을 밟지 않으면 0.
   *
   * 종전에는 `pframe`(0~5 정수)을 실었다 — 스프라이트가 6장이라서 생긴 제약인데,
   * GLB 라이더가 그것을 다시 6으로 나눠 쓰는 바람에 **동행의 페달만 6단계로 계단화**됐다
   * (본인 라이더는 연속값을 쓴다). 전송은 연속값을 싣고, **6장으로 자르는 일은
   * 스프라이트를 그리는 쪽**(iso2d DOM 경로)이 한다.
   */
  phaseRev: number;
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

/**
 * 「이 동행이 아직 **보내고 있는가**」의 판정 근거.
 *
 * 왜 거리가 아니라 송신 시각인가 — 신호 대기로 **멈춘 사람**도 좌표는 계속 보낸다.
 * 거리로 판정하면 멈춘 사람을 「나갔다」고 지워 버린다. 보내기를 멈춘 것만이 나간 것이다.
 *
 * 왜 시계를 비교하지 않는가 — 송신 시각은 **남의 시계**다. 대신 「그 값이 **바뀌는 것을**
 * 마지막으로 본 내 시각」을 적는다. 순수 상대 비교라 시계 차이와 무관하다.
 */
type PeerLivenessMark = {
  /** 송신 시각. 읽을 수 없으면 null — 그때는 `fingerprint` 로 판정한다. */
  srcAtMs: number | null;
  /** 송신 시각을 못 읽을 때의 대용 — 내용이 바뀌었는지만 본다. */
  fingerprint: string;
  seenLocalMs: number;
};

/**
 * 송신 시각을 **읽을 수 없을 때**의 침묵 기준(ms).
 *
 * 왜 더 긴가 — 이때는 「보내고 있는가」를 알 수 없어 **내용이 바뀌는가**로 대신 판정한다.
 * 신호 대기로 멈춘 사람은 내용도 안 바뀌므로, 짧게 잡으면 멀쩡한 동행을 쫓아낸다.
 * 그래도 **영영 안 지우는 것보다는 낫다** — 종전에는 판정 자체를 못 해 유령이 남았다.
 */
const NO_SRC_SILENT_MS = 45_000;

/** 「왜 아직 살아 있나」를 말하는 주기(DEV). */
const ALIVE_REPORT_INTERVAL_MS = 5_000;

/** 이 동행을 얼마나 조용히 둘 것인가 — 송신 시각을 읽을 수 있으면 짧게, 아니면 길게. */
function silentLimitMs(mark: PeerLivenessMark): number {
  return mark.srcAtMs != null ? PEER_LIVE_RIDE_STALE_MS : NO_SRC_SILENT_MS;
}

export class PeerMotionRegistry {
  private readonly entities = new Map<string, PeerMotionEntity>();
  private activeUids = new Set<string>();
  private readonly liveness = new Map<string, PeerLivenessMark>();
  private lastAliveReportMs = 0;

  ingest(packet: PeerMotionPacket, label: string, nowMs: number = Date.now()): void {
    if (!packet.uid || !packet.publicationId.trim()) return;
    if (packet.distM < 0 || !Number.isFinite(packet.distM)) return;

    /*
     * 탭을 그냥 닫으면 아무도 정리해 주지 않는다 — Firestore 에는 「연결이 끊기면 지워라」가
     * 없고, RTDB onDisconnect 도 서버가 끊김을 알아챌 때까지 시간이 걸린다. 그동안 같은 행이
     * 계속 배달되고, 여기서 그것을 받아 주면 **라이더가 영영 화면에 남는다**(2026-09-28 chief 보고:
     * 「Stop 은 15초 안에 사라지는데 탭을 닫으면 유지된다」).
     *
     * 낡은 행을 **되살리지 않는 것**이 핵심이다. 지우기만 하면 다음 배달에 다시 태어난다.
     */
    const src = Number.isFinite(packet.serverAtMs) && packet.serverAtMs > 0 ? packet.serverAtMs : null;
    const fingerprint = `${packet.distM}|${packet.phase}`;
    const prev = this.liveness.get(packet.uid);
    const changed =
      prev == null ||
      (src != null ? prev.srcAtMs !== src : prev.fingerprint !== fingerprint);

    if (changed) {
      this.liveness.set(packet.uid, { srcAtMs: src, fingerprint, seenLocalMs: nowMs });
    } else if (nowMs - prev.seenLocalMs > silentLimitMs(prev)) {
      this.entities.delete(packet.uid);
      this.activeUids.delete(packet.uid);
      return;
    }

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

  /**
   * 살아 있는 동행이 **왜** 살아 있는지 5초마다 한 줄씩 말한다(DEV).
   *
   * 왜 (2026-09-28) — chief 보고: 브라우저를 **강제 종료**하면 유령이 남는데, 참여자는
   * 대개 15초 안에 사라지고 **개설자는 1분 넘게 버틴다.** Stop 은 양쪽 다 멀쩡하다.
   * 즉 「명시적으로 끊지 못한 경우」에만 생기고, 역할에 따라 다르다.
   *
   * 지울지 말지는 **세 가지**로 갈린다 — 그 셋을 그대로 보여 준다. 어느 것이 막고 있는지
   * 추측하지 않고 화면에서 읽는다.
   *
   *   silent : 송신 시각이 **바뀌는 것을** 마지막으로 본 뒤 흐른 시간. 15초 넘으면 지운다
   *   mark   : 송신 시각을 읽을 수 있었나. `no` 면 **판정 자체를 못 해서** 영영 남는다
   *   active : 행이 아직 배달되는 목록에 있나
   */
  private reportAliveReasons(nowMs: number): void {
    if (!import.meta.env.DEV) return;
    if (nowMs - this.lastAliveReportMs < ALIVE_REPORT_INTERVAL_MS) return;
    this.lastAliveReportMs = nowMs;
    for (const uid of this.entities.keys()) {
      const mark = this.liveness.get(uid);
      const e = this.entities.get(uid)!;
      const silentMs = mark ? nowMs - mark.seenLocalMs : -1;
      console.info(
        `[peerAlive] ${uid.slice(0, 6)}  silent=${mark ? Math.round(silentMs / 100) / 10 + "s" : "?"}` +
          `  mark=${mark ? (mark.srcAtMs != null ? "yes" : "내용만") : "NO"}` +
          `  active=${this.activeUids.has(uid) ? "yes" : "no"}` +
          `  기준=${mark ? silentLimitMs(mark) / 1000 : "?"}s` +
          `  마지막ingest=${Math.round((nowMs - e.lastIngestLocalMs) / 100) / 10}s 전`,
      );
    }
  }

  /** ingest 배치 후 호출 — 목록에 없는 uid 는 grace 후 제거 */
  markActiveUids(uids: Iterable<string>): void {
    this.activeUids = new Set(uids);
  }

  remove(uid: string): void {
    this.entities.delete(uid);
    this.activeUids.delete(uid);
    this.liveness.delete(uid);
  }

  clear(): void {
    this.entities.clear();
    this.activeUids.clear();
    this.liveness.clear();
  }

  pruneInactive(nowMs = Date.now()): void {
    this.reportAliveReasons(nowMs);
    for (const uid of [...this.entities.keys()]) {
      /*
       * 조용해진 동행은 **activeUids 에 있어도** 지운다.
       * 그 목록은 「행이 아직 배달되는가」일 뿐 「사람이 아직 있는가」가 아니다 —
       * 탭을 닫으면 행은 남고 사람은 없다.
       */
      const mark = this.liveness.get(uid);
      if (mark && nowMs - mark.seenLocalMs > silentLimitMs(mark)) {
        this.entities.delete(uid);
        this.activeUids.delete(uid);
        continue;
      }
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
    // 화면 위 속도를 잰다(DEV 전용). 여기가 **적분이 끝난 직후**라 화면과 같은 값이다.
    notePeerSmoothness(this.entities.values(), nowMs);
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
      // 0~1 로 정규화한 연속 위상. 밟지 않으면 0(종전 `pframe = 0` 과 같은 의미).
      const phaseRevRaw = spd > 0.38 ? ((entity.phaseRev % 1) + 1) % 1 : 0;

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
        phaseRev: Number.isFinite(phaseRevRaw) ? phaseRevRaw : 0,
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
  // 제품과 **같은 함수**를 본다. 베껴 두면 제품을 고칠 때 로그만 옛 규칙으로 남는다.
  const renderTime = peerRenderTimeMs(entity, nowMs);
  const newestT = snapshotTimelineMs(entity, newest);
  const oldestT = snapshotTimelineMs(entity, oldest);
  const newestAgeMs = nowMs - newest.recvAtMs;
  let mode: "paused" | "oldest" | "interpolate" | "extrapolate";
  const extra: Record<string, string | number | boolean | null> = {};

  if (entity.phase === "paused" || entity.phase === "completed") {
    mode = "paused";
    extra.newestSeq = newest.seq ?? null;
    extra.newestDist = newest.distM;
  } else if (renderTime <= oldestT) {
    mode = "oldest";
    extra.oldestSeq = oldest.seq ?? null;
    extra.oldestRecv = oldest.recvAtMs;
    extra.oldestDist = oldest.distM;
  } else if (renderTime >= newestT) {
    mode = "extrapolate";
    const aheadRaw = renderTime - newestT;
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
      if (snapshotTimelineMs(entity, buf[i]!) >= renderTime) {
        s1 = buf[i]!;
        s0 = buf[i - 1]!;
        break;
      }
    }
    const s0T = snapshotTimelineMs(entity, s0);
    const span = snapshotTimelineMs(entity, s1) - s0T;
    const t = span > 0 ? (renderTime - s0T) / span : 0;
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
