export type { PeerMotionEntity, PeerMotionPacket, PeerMotionPhase } from "./types";
export {
  PeerMotionRegistry,
  getPeerMotionRegistry,
  resetPeerMotionRegistry,
  type PeerMotionRenderFeature,
} from "./PeerMotionRegistry";
export { mergePeerMotionPackets, pickFresherPeerMotionPacket } from "./mergePackets";
export {
  syncPeerMotionFromPresence,
  selectPeerMotionPacketForIngest,
  noteRtdbContentObservation,
  resetPeerMotionRtdbContentObservations,
  stampDualSourceIngestPacket,
  isRtdbMotionRowPeerVisibleByReceiverObs,
  PEER_MOTION_RTDB_SOURCE_STALE_MS,
  type SyncPeerMotionFromPresenceInput,
} from "./syncFromPresence";
export { trailLiveRowToPeerMotionPacket } from "./rowToPacket";
export { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
export { cleanupPeerMotionPublish, isMotionTransportConfigured } from "./repo/rtdbTrailMotion";
