import type { PresenceMemberType } from "../identity/authDisplay";
import type { TrailLivePublicationRideRow } from "../trail/trailTypes";
import { PEER_LIVE_RIDE_STALE_MS } from "../trail/trailLivePolicy";
import type { RtdbTrailMotionRow } from "./repo/rtdbTrailMotion";
import { mapNametagForMember } from "../identity/guestNametag";
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
import { trailLiveRowToPeerMotionPacket } from "./rowToPacket";
import { notePeerSeqSeen, peerSyncChainLog } from "./peerSyncChainLog";
import type { PeerMotionPacket } from "./types";

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
  guestUidsSorted: readonly string[];
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
  normalizedServerAtMs: number;
};

/** uid → 마지막으로 내용이 바뀐 수신 측 시각 */
const rtdbContentObsByUid = new Map<string, RtdbContentObs>();

/**
 * 이중 소스 ingest 시각 정규화 상태.
 * 내용이 같으면 같은 normalizedServerAtMs 를 유지해 Registry liveness 가 만료될 수 있게 한다(TASK-30C).
 */
const dualIngestStampByUid = new Map<string, DualIngestStampObs>();

export function resetPeerMotionRtdbContentObservations(): void {
  rtdbContentObsByUid.clear();
  dualIngestStampByUid.clear();
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
 * 이중 소스 선택 결과의 네이티브 송신/FS 시각을 수신 now 로 옮긴다.
 * **소스 내용(핑거프린트)이 바뀔 때만** normalizedServerAtMs 를 갱신한다.
 * 매 sync 마다 nowMs 로 덮으면 frozen 재배달이 영원히 신선해진다(TASK-30C).
 * 같은 자세에서 RTDB↔FS 전환만 일어나면 stamp 를 유지해 15s liveness 가 늘어나지 않게 한다.
 */
export function stampDualSourceIngestPacket(
  uid: string,
  selected: PeerMotionPacket,
  source: "rtdb" | "fs",
  nowMs: number,
): PeerMotionPacket {
  const motionFp = `${selected.distM}|${selected.speedMps}|${selected.phase}`;
  const fingerprint = `${source}|${selected.serverAtMs}|${selected.seq ?? ""}|${motionFp}`;
  const prev = dualIngestStampByUid.get(uid);
  if (!prev || prev.fingerprint !== fingerprint) {
    if (prev && prev.motionFp === motionFp && prev.source !== source) {
      dualIngestStampByUid.set(uid, {
        fingerprint,
        source,
        motionFp,
        normalizedServerAtMs: prev.normalizedServerAtMs,
      });
      return { ...selected, serverAtMs: prev.normalizedServerAtMs };
    }
    dualIngestStampByUid.set(uid, {
      fingerprint,
      source,
      motionFp,
      normalizedServerAtMs: nowMs,
    });
    return { ...selected, serverAtMs: nowMs };
  }
  return { ...selected, serverAtMs: prev.normalizedServerAtMs };
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
    if (rtdbPacket == null || fsPacket == null) {
      dualIngestStampByUid.delete(uid);
    }

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
      ? mapNametagForMember(uid, member.memberType, member.displayName, [...input.guestUidsSorted])
      : liveRow?.displayName?.trim() ||
        motionByUid.get(uid)?.uid.slice(0, 6) ||
        uid.slice(0, 6);

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
    // 이중 소스일 때 송신 t / FS serverTimestamp 를 그대로 넣으면 소스 전환 시
    // integrator clockOffset 이 ±수십 초 점프해 display 가 뒤로 간다(TASK-30B).
    // 내용이 바뀔 때만 수신 now 로 정규화하고, frozen 재배달은 안정 stamp 유지(TASK-30C).
    const pickSource: "rtdb" | "fs" = selected === rtdbPacket ? "rtdb" : "fs";
    const packet =
      rtdbPacket != null && fsPacket != null
        ? stampDualSourceIngestPacket(uid, selected, pickSource, nowMs)
        : selected;
    registry.ingest(packet, label, nowMs);
    activeUids.push(uid);
  }

  registry.markActiveUids(activeUids);
}
