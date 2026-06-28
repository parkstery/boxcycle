import type { PublicationSessionMemberRow } from "../firestorePublicationSessionPresence";
import type { TrailLivePublicationRideRow } from "../firestoreTrailLivePublicationRides";
import type { RtdbTrailMotionRow } from "../rtdbTrailMotion";
import { mapNametagForMember } from "../guestNametag";
import { getPeerMotionRegistry } from "./PeerMotionRegistry";
import { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
import { trailLiveRowToPeerMotionPacket } from "./rowToPacket";

export type SyncPeerMotionFromPresenceInput = {
  publicationId: string;
  myUid: string;
  motionRows: readonly RtdbTrailMotionRow[];
  liveRideRows: readonly TrailLivePublicationRideRow[];
  sessionMembers: readonly PublicationSessionMemberRow[];
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

  for (const uid of allUids) {
    const rtdbRow = motionByUid.get(uid);
    const rtdbPacket = rtdbRow != null ? rtdbMotionRowToPeerMotionPacket(rtdbRow, pid) : null;
    const liveRow = liveByUid.get(uid);
    const fsPacket = liveRow ? trailLiveRowToPeerMotionPacket(liveRow, pid, routeLenM) : null;
    if (!rtdbPacket && !fsPacket) continue;

    const member = sessionByUid.get(uid);
    const label = member
      ? mapNametagForMember(uid, member.memberType, member.displayName, [...input.guestUidsSorted])
      : liveRow?.displayName?.trim() ||
        motionByUid.get(uid)?.uid.slice(0, 6) ||
        uid.slice(0, 6);

    // 병합하지 않고 각 소스를 그대로 ingest — 버퍼의 distM-전진 dedup 이 더 앞선 소스를
    // 자동 채택한다(clock 비교 없음). FS 먼저·RTDB 나중 → RTDB(5Hz·raw distM·speed)가
    // 최신값을 결정하고, RTDB stall 시 Firestore 가 distM 전진으로 자연 fallback.
    if (fsPacket) registry.ingest(fsPacket, label);
    if (rtdbPacket) registry.ingest(rtdbPacket, label);
    activeUids.push(uid);
  }

  registry.markActiveUids(activeUids);
}
