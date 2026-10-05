export type {
  PeerMotionEntity,
  PeerMotionPacket,
  PeerMotionPhase,
  PeerMotionTimeQuality,
} from "./types";
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
  bridgeFsPacketToServerTimeline,
  isRtdbMotionRowPeerVisibleByReceiverObs,
  peekServerCaptureAnchorForTests,
  peekDisplayTimelineTipForTests,
  PEER_MOTION_RTDB_SOURCE_STALE_MS,
  ESTIMATED_TSRV_MAX_ADVANCE_MS,
  type SyncPeerMotionFromPresenceInput,
  type ServerCaptureAnchor,
} from "./syncFromPresence";
export { trailLiveRowToPeerMotionPacket } from "./rowToPacket";
export { rtdbMotionRowToPeerMotionPacket } from "./rtdbToPacket";
export { cleanupPeerMotionPublish, isMotionTransportConfigured } from "./repo/rtdbTrailMotion";
export {
  COMMON_COMPANION_DISPLAY_DELAY_MS,
  advanceSelfDisplayRenderTimeMs,
  ensureFrameDisplayRenderTimeMs,
  setCompanionDisplayActive,
  resetCommonDisplayClock,
  sharedDisplayCommonNowMs,
  companionDisplayDelayMs,
  captureEstimatedServerNowMs,
  peekSelfDisplayRenderTimeMs,
  peekFrameDisplayRenderTimeMs,
  isDisplayRenderCatchingUp,
  isCompanionDisplayActive,
  notifyCommonDisplayAxisReset,
  subscribeCommonDisplayAxisReset,
} from "./commonDisplayClock";
export {
  pushSelfDisplaySample,
  resetSelfDisplayBuffer,
  sampleSelfDisplayDistM,
} from "./selfDisplayBuffer";
export {
  acquireServerClockOffset,
  peekServerTimeOffsetMs,
  estimateServerNowMs,
  isServerClockReady,
  isServerClockUncertain,
  subscribeServerClockDiscontinuity,
} from "./repo/serverClockOffset";
