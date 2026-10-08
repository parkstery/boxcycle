import type { PresenceMemberType } from "../identity/authDisplay";
import type { TrailLivePublicationRideRow } from "../trail/trailTypes";
import { PEER_LIVE_RIDE_STALE_MS } from "../trail/trailLivePolicy";
import type { RtdbTrailMotionRow } from "./repo/rtdbTrailMotion";
import { mapNametagForMember } from "../identity/guestNametag";
import { presenceRiderDisplayName } from "../identity/riderName";
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
import { trailLiveRowToPeerMotionPacket } from "./rowToPacket";
import { notePeerSeqSeen, peerSyncChainLog } from "./peerSyncChainLog";
import type { PeerMotionPacket, PeerMotionTimeQuality } from "./types";
import { setCompanionDisplayActive } from "./commonDisplayClock";
import { notePeerIngestDiag } from "../debug/peerIngestDiag";

/**
 * 이름표를 붙이는 데 **필요한 것만** 적는다.
 *
 * 2026-09-26 (Phase 6-③C): 종전에는 `ride/repo` 의 `PublicationSessionMemberRow` 를
 * 통째로 가져왔다. 그 행은 다섯 필드인데 여기서 읽는 것은 셋뿐이고, 그 한 줄 때문에
 * 전송 계층이 주행 **저장소**를 올려다봤다(D6). 필요한 모양만 적으면 호출자는
 * 종전 그대로 행을 넘길 수 있다 — 더 넓은 객체는 구조적으로 이 모양을 만족한다.
 */
export type PeerNametagMember = {
  uid: string;
  displayName: string | null;
  memberType: PresenceMemberType | null;
};

export type SyncPeerMotionFromPresenceInput = {
  publicationId: string;
  myUid: string;
  motionRows: readonly RtdbTrailMotionRow[];
  liveRideRows: readonly TrailLivePublicationRideRow[];
  sessionMembers: readonly PeerNametagMember[];
  routeLenM?: number;
  /** 시험·재생용. 기본 Date.now() */
  nowMs?: number;
};

/**
 * 수신 측에서 관측한 RTDB 행 **내용 변화** 연령 상한.
 * 넘으면 5Hz 소스로 보지 않고 FS 로 폴백한다.
 * mergePackets 의 RTDB_SPEED_STALE_MS(2.5s) 와 같은 스케일(~12 missed 200ms ticks).
 *
 * TASK-30B: 송신 `t` / FS serverTimestamp / 수신 Date.now 교차 비교를 쓰지 않는다.
 * ±30s 송신 시계 오차에서도 로컬 관측 변화 시각만으로 판정한다.
 */
export const PEER_MOTION_RTDB_SOURCE_STALE_MS = 2_500;

type RtdbContentObs = {
  fingerprint: string;
  changedAtLocalMs: number;
};

type DualIngestStampObs = {
  fingerprint: string;
  source: "rtdb" | "fs";
  motionFp: string;
  /** 마지막 원본(송신 t / FS lastSeenAt) 시각 */
  nativeServerAtMs: number;
  /**
   * 수신 축 매핑: normalized = native + offsetMs.
   * 동일 source 동안 고정 — 송신 시간 증가량을 보간에 보존한다.
   */
  offsetMs: number;
  normalizedServerAtMs: number;
};

/** uid → 마지막으로 내용이 바뀐 수신 측 시각 */
const rtdbContentObsByUid = new Map<string, RtdbContentObs>();

/**
 * 이중 소스 ingest 시각 정규화 상태.
 * 내용이 같으면 같은 normalizedServerAtMs 를 유지해 Registry liveness 가 만료될 수 있게 한다(TASK-30C).
 * 동일 source 동안은 native Δt 를 보존하고, source 전환 시에만 offset 을 재정렬한다.
 */
const dualIngestStampByUid = new Map<string, DualIngestStampObs>();

/**
 * 표시축 tip — capture(권위) 또는 estimated(FS 연속).
 * publication|uid 키로 이전 Trail 앵커 유입을 막는다.
 */
export type ServerCaptureAnchor = {
  publicationId: string;
  tSrv: number;
  distM: number;
  speedMps: number;
  quality: PeerMotionTimeQuality;
};

/** 거리/속도로 복원하는 추정 전진 상한(ms). FS 4s 성김 연속용 — 정확한 캡처 복원 아님. */
export const ESTIMATED_TSRV_MAX_ADVANCE_MS = 8_000;

const lastCaptureByKey = new Map<string, ServerCaptureAnchor>();
const lastDisplayTipByKey = new Map<string, ServerCaptureAnchor>();

function timelineKey(publicationId: string, uid: string): string {
  return `${publicationId}|${uid}`;
}

function packetHasFiniteTsrv(packet: PeerMotionPacket): boolean {
  return typeof packet.tSrv === "number" && Number.isFinite(packet.tSrv) && packet.tSrv > 0;
}

function resolvePacketTimeQuality(
  packet: PeerMotionPacket,
  pickSource: "rtdb" | "fs",
): PeerMotionTimeQuality | "none" {
  if (!packetHasFiniteTsrv(packet)) return "none";
  if (packet.tSrvQuality === "estimated") return "estimated";
  if (packet.tSrvQuality === "capture") return "capture";
  // 구경로: tSrv 만 있고 quality 없음 → RTDB 캡처로 간주
  return pickSource === "rtdb" ? "capture" : "estimated";
}

export function resetPeerMotionRtdbContentObservations(): void {
  rtdbContentObsByUid.clear();
  dualIngestStampByUid.clear();
  lastCaptureByKey.clear();
  lastDisplayTipByKey.clear();
}

/** 시험용 — 권위 capture anchor (estimated tip 아님) */
export function peekServerCaptureAnchorForTests(
  publicationId: string,
  uid: string,
): ServerCaptureAnchor | null {
  return lastCaptureByKey.get(timelineKey(publicationId, uid)) ?? null;
}

/** 시험용 — FS 연속용 표시 tip (capture 또는 estimated) */
export function peekDisplayTimelineTipForTests(
  publicationId: string,
  uid: string,
): ServerCaptureAnchor | null {
  return lastDisplayTipByKey.get(timelineKey(publicationId, uid)) ?? null;
}

/**
 * FS 폴백 패킷에 **표시축** tip 을 거리 연속으로 이어 붙인다.
 *
 * 결과는 항상 `tSrvQuality: "estimated"` — 권위 capture 와 구별한다.
 * 거리/속도로는 캡처 시각을 정확히 복원할 수 없으므로 연속 fallback 전용이며,
 * NaN/무한/과도 전진을 clamp 한다. 정지·역행은 tip 을 뒤로 밀지 않는다.
 */
export function bridgeFsPacketToServerTimeline(
  packet: PeerMotionPacket,
  last: Pick<ServerCaptureAnchor, "tSrv" | "distM" | "speedMps">,
): PeerMotionPacket {
  // 이미 권위 capture tSrv 가 있으면 추정으로 덮지 않는다.
  if (packetHasFiniteTsrv(packet) && packet.tSrvQuality !== "estimated") {
    return packet.tSrvQuality === "capture"
      ? packet
      : { ...packet, tSrvQuality: "capture" };
  }
  const dDist = packet.distM - last.distM;
  const packetSpeed = packet.speedMps > 0.02 ? packet.speedMps : 0;
  const lastSpeed = last.speedMps > 0.02 ? last.speedMps : 0;
  // 역행·frozen·정지: tip 유지. 정지 이탈=현재속도, 순항/가감속=평균(가속 tip 지연 완화).
  let advanceMs = 0;
  if (dDist > 0.05 && packetSpeed > 0.02) {
    const speed = lastSpeed <= 0.02 ? packetSpeed : (packetSpeed + lastSpeed) / 2;
    advanceMs = (dDist / speed) * 1000;
  }
  if (!Number.isFinite(advanceMs) || advanceMs < 0) advanceMs = 0;
  if (advanceMs > ESTIMATED_TSRV_MAX_ADVANCE_MS) {
    advanceMs = ESTIMATED_TSRV_MAX_ADVANCE_MS;
  }
  const tSrv = last.tSrv + advanceMs;
  if (!Number.isFinite(tSrv) || tSrv <= 0) {
    return { ...packet, tSrv: last.tSrv, tSrvQuality: "estimated" };
  }
  return { ...packet, tSrv, tSrvQuality: "estimated" };
}

/**
 * 권위 capture 와 표시 tip 을 분리 갱신한다.
 * estimated 는 capture 를 덮지 않고, 늦은/역행 capture 는 anchor 를 되돌리지 않는다.
 */
function rememberServerCapture(
  uid: string,
  packet: PeerMotionPacket,
  pickSource: "rtdb" | "fs",
): void {
  if (!packetHasFiniteTsrv(packet)) return;
  const quality = resolvePacketTimeQuality(packet, pickSource);
  if (quality === "none") return;

  const key = timelineKey(packet.publicationId, uid);
  const next: ServerCaptureAnchor = {
    publicationId: packet.publicationId,
    tSrv: packet.tSrv!,
    distM: packet.distM,
    speedMps: packet.speedMps,
    quality,
  };

  if (quality === "capture") {
    const prevCap = lastCaptureByKey.get(key);
    // 늦은 RTDB — 권위 capture 를 과거로 되돌리지 않음
    if (prevCap && next.tSrv + 0.5 < prevCap.tSrv) {
      return;
    }
    lastCaptureByKey.set(key, next);
    const prevTip = lastDisplayTipByKey.get(key);
    // 복구 snap 방지: estimated tip 보다 과거 capture 로 표시 tip 을 되감지 않음.
    // 권위 시각은 lastCapture 에만 두고, tip/ingest 축은 단조 유지.
    if (
      prevTip &&
      prevTip.publicationId === next.publicationId &&
      next.tSrv + 0.5 < prevTip.tSrv
    ) {
      lastDisplayTipByKey.set(key, { ...next, tSrv: prevTip.tSrv });
    } else {
      lastDisplayTipByKey.set(key, next);
    }
    return;
  }

  // estimated — 표시 tip 만. capture 오염 금지.
  const prevTip = lastDisplayTipByKey.get(key);
  if (prevTip && prevTip.publicationId === next.publicationId && next.tSrv + 0.5 < prevTip.tSrv) {
    return;
  }
  lastDisplayTipByKey.set(key, next);
}

function rtdbContentFingerprint(row: RtdbTrailMotionRow): string {
  return `${row.seq ?? ""}|${row.serverAtMs}|${row.distM}|${row.speedMps}|${row.ridePhase}`;
}

/**
 * RTDB 행 내용이 바뀌면 수신 측 nowMs 로 갱신. 동일 스냅샷 재전달이면 이전 시각 유지.
 * @returns contentChangedAtLocalMs
 */
export function noteRtdbContentObservation(
  uid: string,
  row: RtdbTrailMotionRow,
  nowMs: number,
): number {
  const fingerprint = rtdbContentFingerprint(row);
  const prev = rtdbContentObsByUid.get(uid);
  if (!prev || prev.fingerprint !== fingerprint) {
    rtdbContentObsByUid.set(uid, { fingerprint, changedAtLocalMs: nowMs });
    return nowMs;
  }
  return prev.changedAtLocalMs;
}

/**
 * 한 사이클에 **하나의** 패킷만 고른다(이중 ingest jitter 방지).
 *
 * 시계 교차 비교 없이, 수신 측에서 관측한 RTDB 내용 변화 시각만으로:
 * - 관측 연령 ≤ STALE → RTDB-first (정상 5Hz)
 * - 관측 연령 > STALE → FS (freeze / silent stall)
 * - RTDB 없음 → FS; FS 없음 → RTDB
 */
export function selectPeerMotionPacketForIngest(
  rtdb: PeerMotionPacket | null,
  fs: PeerMotionPacket | null,
  nowMs: number,
  rtdbContentChangedAtLocalMs?: number | null,
): PeerMotionPacket | null {
  if (!rtdb) return fs;
  if (!fs) return rtdb;

  if (
    rtdbContentChangedAtLocalMs == null ||
    !Number.isFinite(rtdbContentChangedAtLocalMs)
  ) {
    return rtdb;
  }

  if (nowMs - rtdbContentChangedAtLocalMs > PEER_MOTION_RTDB_SOURCE_STALE_MS) {
    return fs;
  }

  return rtdb;
}

/**
 * 선택 패킷(RTDB-only / dual / FS-only)의 네이티브 송신·FS 시각을 수신 축으로 옮긴다.
 * 함수명은 historical dual naming을 유지한다 — 적용 범위는 all-source.
 *
 * - 동일 source: `normalized = native + offset`(offset 고정) → 송신 Δt 보존.
 * - source 전환(내용 변경): 이 패킷만 `nowMs` 에 맞춰 offset 재정렬.
 * - frozen 재배달: stamp 유지(TASK-30C — 매 sync nowMs 덮어쓰기 금지).
 * - 같은 자세에서 RTDB↔FS 전환만: stamp 유지해 15s liveness 가 늘어나지 않게 한다.
 *
 * 과거 결함: 내용 변화마다 `serverAtMs := nowMs` 로 찍어 도착 지터가 속도 지터가 됐다.
 */
export function stampDualSourceIngestPacket(
  uid: string,
  selected: PeerMotionPacket,
  source: "rtdb" | "fs",
  nowMs: number,
): PeerMotionPacket {
  // 공통 서버축(tSrv) — 수신 시각으로 재정규화하면 창마다 축이 갈라진다.
  if (typeof selected.tSrv === "number" && Number.isFinite(selected.tSrv) && selected.tSrv > 0) {
    return selected;
  }

  const native = selected.serverAtMs;
  const nativeOk = Number.isFinite(native) && native > 0;
  const motionFp = `${selected.distM}|${selected.speedMps}|${selected.phase}`;
  const fingerprint = `${source}|${native}|${selected.seq ?? ""}|${motionFp}`;
  const prev = dualIngestStampByUid.get(uid);

  if (prev && prev.fingerprint === fingerprint) {
    return { ...selected, serverAtMs: prev.normalizedServerAtMs };
  }

  // 같은 자세 · 소스만 전환 — liveness stamp 유지, 새 source 의 offset 은 그 축에 맞춤.
  if (prev && prev.motionFp === motionFp && prev.source !== source) {
    const offsetMs = nativeOk
      ? prev.normalizedServerAtMs - native
      : prev.offsetMs;
    dualIngestStampByUid.set(uid, {
      fingerprint,
      source,
      motionFp,
      nativeServerAtMs: nativeOk ? native : prev.nativeServerAtMs,
      offsetMs,
      normalizedServerAtMs: prev.normalizedServerAtMs,
    });
    return { ...selected, serverAtMs: prev.normalizedServerAtMs };
  }

  let offsetMs: number;
  let normalizedServerAtMs: number;
  if (!nativeOk) {
    offsetMs = 0;
    normalizedServerAtMs = nowMs;
  } else if (!prev || prev.source !== source) {
    // 최초 또는 source 전환(내용 변경): 수신 now 에 정렬.
    offsetMs = nowMs - native;
    normalizedServerAtMs = nowMs;
  } else {
    // 동일 source: 원본 시각 증가량 보존 (도착 nowMs 재지정 금지).
    offsetMs = prev.offsetMs;
    normalizedServerAtMs = native + offsetMs;
    /*
     * 인과 클램프 — 수신 축 stamp 는 now 보다 미래일 수 없다.
     * 낡은 FS 스냅샷으로 source 진입해 offset 이 커진 뒤, 다음 FS 가 native 를
     * 한꺼번에 따라잡으면 stamp 가 미래로 나가 clockOffset 이 음수로 붕괴한다
     * (TASK-30 8s silent-freeze 회귀). 늦은 패킷(stamp < now)은 그대로 두어 Δt 를 지킨다.
     */
    if (normalizedServerAtMs > nowMs) {
      normalizedServerAtMs = nowMs;
      offsetMs = nowMs - native;
    }
  }

  dualIngestStampByUid.set(uid, {
    fingerprint,
    source,
    motionFp,
    nativeServerAtMs: nativeOk ? native : 0,
    offsetMs,
    normalizedServerAtMs,
  });
  return { ...selected, serverAtMs: normalizedServerAtMs };
}

/**
 * RTDB-only peer UI 가시성 — 송신 t vs 수신 now 교차 비교 금지.
 * 수신 측에서 관측한 내용 변화 연령으로 15s 정책을 적용한다(TASK-30C).
 */
export function isRtdbMotionRowPeerVisibleByReceiverObs(
  uid: string,
  row: RtdbTrailMotionRow,
  nowMs: number,
  staleMs: number = PEER_LIVE_RIDE_STALE_MS,
): boolean {
  if (!(nowMs > 0)) return true;
  const changedAt = noteRtdbContentObservation(uid, row, nowMs);
  return nowMs - changedAt <= staleMs;
}

/** Firestore livePublicationRides + RTDB 5Hz → PeerMotionRegistry (소스별 최신 패킷 병합) */
export function syncPeerMotionFromPresence(input: SyncPeerMotionFromPresenceInput): void {
  const pid = input.publicationId.trim();
  if (!pid) return;

  const routeLenM = input.routeLenM ?? 0;
  const registry = getPeerMotionRegistry();
  const sessionByUid = new Map(input.sessionMembers.map((r) => [r.uid, r]));
  const nowMs = input.nowMs ?? Date.now();

  const liveByUid = new Map<string, TrailLivePublicationRideRow>();
  for (const row of input.liveRideRows) {
    if (row.uid === input.myUid) continue;
    if (row.publicationId.trim() !== pid) continue;
    liveByUid.set(row.uid, row);
  }

  const motionByUid = new Map<string, RtdbTrailMotionRow>();
  for (const row of input.motionRows) {
    if (row.uid === input.myUid) continue;
    if (row.publicationId.trim() !== pid) continue;
    motionByUid.set(row.uid, row);
  }

  const activeUids: string[] = [];
  const allUids = new Set<string>([...liveByUid.keys(), ...motionByUid.keys()]);

  for (const uid of allUids) {
    const rtdbRow = motionByUid.get(uid);
    const rtdbPacket = rtdbRow != null ? rtdbMotionRowToPeerMotionPacket(rtdbRow, pid) : null;
    const liveRow = liveByUid.get(uid);
    const fsPacket = liveRow ? trailLiveRowToPeerMotionPacket(liveRow, pid, routeLenM) : null;
    if (!rtdbPacket && !fsPacket) continue;

    if (rtdbRow == null) {
      rtdbContentObsByUid.delete(uid);
    }
    // 단일 소스여도 stamp 상태를 지우지 않는다.
    // RTDB-only(raw 송신축) → dual 진입 때 stamp 맵이 비어 있으면 첫 FS/정규화 stamp 가
    // 수신 now 로만 앵커되어 ±30s 송신시계에서 clockOffset 이 붕괴한다(TASK-03 A2).

    if (import.meta.env.DEV && rtdbRow) {
      const seen = notePeerSeqSeen(rtdbRow.uid, rtdbRow.seq, nowMs);
      peerSyncChainLog(4, rtdbRow.seq, {
        d: rtdbRow.distM,
        t: rtdbRow.serverAtMs,
        recvAt: nowMs,
        first: seen.first ? 1 : 0,
        firstSeenAt: seen.firstSeenAt,
        repeatSeenCount: seen.repeatSeenCount,
        uid: rtdbRow.uid.slice(0, 6),
      });
    }

    const member = sessionByUid.get(uid);
    const label = member
      ? mapNametagForMember(uid, member.memberType, member.displayName)
      : presenceRiderDisplayName(uid, null, liveRow?.displayName);

    const changedAt =
      rtdbRow != null ? noteRtdbContentObservation(uid, rtdbRow, nowMs) : null;
    // 한 소스만 ingest — 로컬 관측 신선도. 둘 다 넣으면 같은 사이클에 jitter.
    const selected = selectPeerMotionPacketForIngest(
      rtdbPacket,
      fsPacket,
      nowMs,
      changedAt,
    );
    if (!selected) continue;
    // 송신 t / FS lastSeenAt 을 그대로 넣으면 소스 전환·단일→이중 진입 시
    // integrator clockOffset 이 ±수십 초 점프해 display 가 뒤로 간다(TASK-30B/TASK-03).
    // 단일 소스에서도 stamp 로 수신축을 유지해 RTDB-only↔dual↔FS-only 전환을 안정화한다.
    // 동일 source 는 native Δt 보존, source 전환·최초만 now 정렬(TASK-02).
    // frozen 재배달은 안정 stamp 유지(TASK-30C).
    const pickSource: "rtdb" | "fs" = selected === rtdbPacket ? "rtdb" : "fs";
    let packet = stampDualSourceIngestPacket(uid, selected, pickSource, nowMs);
    // RTDB wire tSrv → 권위 capture 표시(내부 quality; wire 필드 추가 없음).
    if (
      pickSource === "rtdb" &&
      packetHasFiniteTsrv(packet) &&
      packet.tSrvQuality !== "estimated"
    ) {
      packet = { ...packet, tSrvQuality: "capture" };
    }
    // FS wire 는 tSrv 없음 → 직전 표시 tip(보통 마지막 capture)으로 estimated 연속.
    // estimated 는 capture anchor 를 덮지 않는다.
    if (
      pickSource === "fs" &&
      !(packetHasFiniteTsrv(packet) && packet.tSrvQuality === "capture")
    ) {
      const tip = lastDisplayTipByKey.get(timelineKey(packet.publicationId, uid));
      if (tip && tip.publicationId === packet.publicationId) {
        packet = bridgeFsPacketToServerTimeline(packet, tip);
      }
    }
    rememberServerCapture(uid, packet, pickSource);
    // ingest 축 단조: tip 이 capture 진실보다 앞서 있으면 tip 시각으로 맞춤(복구 snap 방지).
    if (pickSource === "rtdb" && packetHasFiniteTsrv(packet)) {
      const tip = lastDisplayTipByKey.get(timelineKey(packet.publicationId, uid));
      if (tip && packet.tSrv! + 0.5 < tip.tSrv) {
        packet = { ...packet, tSrv: tip.tSrv, tSrvQuality: "capture" };
      }
    }
    if (import.meta.env.DEV) {
      notePeerIngestDiag({
        atMs: nowMs,
        uid,
        publicationId: packet.publicationId,
        source: pickSource,
        tSrvQuality: resolvePacketTimeQuality(packet, pickSource),
        tSrv: packetHasFiniteTsrv(packet) ? packet.tSrv! : null,
        distM: packet.distM,
        speedMps: packet.speedMps,
        serverTimeline: packetHasFiniteTsrv(packet),
      });
    }
    registry.ingest(packet, label, nowMs);
    activeUids.push(uid);
  }

  registry.markActiveUids(activeUids);
  setCompanionDisplayActive(activeUids.length > 0);
}
