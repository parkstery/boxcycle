import type { PresenceMemberType } from "../identity/authDisplay";
import type { TrailLivePublicationRideRow } from "../trail/trailTypes";
import type { RtdbTrailMotionRow } from "./repo/rtdbTrailMotion";
import { mapNametagForMember } from "../identity/guestNametag";
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
import { trailLiveRowToPeerMotionPacket } from "./rowToPacket";
import { notePeerSeqSeen, peerSyncChainLog } from "./peerSyncChainLog";

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
};

/** Firestore 1Hz + RTDB 5Hz → PeerMotionRegistry (소스별 최신 패킷 병합) */
export function syncPeerMotionFromPresence(input: SyncPeerMotionFromPresenceInput): void {
  const pid = input.publicationId.trim();
  if (!pid) return;

  const routeLenM = input.routeLenM ?? 0;
  const registry = getPeerMotionRegistry();
  const sessionByUid = new Map(input.sessionMembers.map((r) => [r.uid, r]));

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
  const recvAt = Date.now();

  for (const uid of allUids) {
    const rtdbRow = motionByUid.get(uid);
    const rtdbPacket = rtdbRow != null ? rtdbMotionRowToPeerMotionPacket(rtdbRow, pid) : null;
    const liveRow = liveByUid.get(uid);
    const fsPacket = liveRow ? trailLiveRowToPeerMotionPacket(liveRow, pid, routeLenM) : null;
    if (!rtdbPacket && !fsPacket) continue;

    if (import.meta.env.DEV && rtdbRow) {
      const seen = notePeerSeqSeen(rtdbRow.uid, rtdbRow.seq, recvAt);
      peerSyncChainLog(4, rtdbRow.seq, {
        d: rtdbRow.distM,
        t: rtdbRow.serverAtMs,
        recvAt,
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

    // RTDB(10Hz·raw distM·speed)가 있으면 그것만 ingest. 두 소스를 같은 사이클에 모두
    // 넣으면 거의 같은 recvAtMs 에 distM 이 미세하게 다른 스냅샷 2개가 생겨 보간 jitter.
    // RTDB 없을 때만 Firestore 폴백.
    if (rtdbPacket) registry.ingest(rtdbPacket, label);
    else if (fsPacket) registry.ingest(fsPacket, label);
    activeUids.push(uid);
  }

  registry.markActiveUids(activeUids);
}
