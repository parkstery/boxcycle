export type OvertakeSourceEvidence = { fresh: boolean; sourceDistanceM: number; sourceCapturedAtMs: number; sourceReceivedAtMs: number; sourceSpeedMps: number };
export type OvertakePeer = { id: string; label: string; distanceM: number; speedMps: number; headingDeg: number; fresh: boolean; source?: OvertakeSourceEvidence };
export type OvertakeFrame = { nowMs: number; selfDistanceM: number; selfSpeedMps: number; selfHeadingDeg: number; peers: readonly OvertakePeer[] };
export type ThumbGesture = { id: string; side: "left" | "right"; kind?: "thumb" | "hi"; startedAtMs: number };
const listeners = new Set<(frame: OvertakeFrame) => void>();
const gestures = new Map<string, ThumbGesture>();
let lastFrameMs = 0;
function publishOvertakeFrame(frame: OvertakeFrame): void {
  if (frame.nowMs - lastFrameMs < 100) return;
  lastFrameMs = frame.nowMs;
  for (const listener of listeners) listener(frame);
}
export function publishOvertakeDisplayFrame(
  selfDistanceM: number | null, self: { speedMps?: number; bearingDeg: number } | undefined,
  peers: readonly { properties: { id: string; label: string; displayDistM: number; speedMps: number; hdg: number } }[],
  fresh: (uid: string) => boolean | OvertakeSourceEvidence | null,
): void {
  const nowMs = Date.now();
  if (selfDistanceM == null || !self || nowMs - lastFrameMs < 100) return;
  publishOvertakeFrame({ nowMs, selfDistanceM, selfSpeedMps: self.speedMps ?? 0, selfHeadingDeg: self.bearingDeg,
    peers: peers.map(({ properties: peer }) => {
      const evidence = fresh(peer.id);
      return { id: peer.id, label: peer.label, distanceM: peer.displayDistM,
        speedMps: peer.speedMps, headingDeg: peer.hdg,
        fresh: typeof evidence === "boolean" ? evidence : evidence?.fresh ?? false,
        ...(evidence && typeof evidence === "object" ? { source: evidence } : {}) };
    }),
  });
}
export function subscribeOvertakeFrames(listener: (frame: OvertakeFrame) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function playThumbGesture(riderId: string, gesture: ThumbGesture): void { gestures.set(riderId, gesture); }
export function clearThumbGestures(): void { gestures.clear(); }
export function cancelThumbGesture(riderId: string): void { gestures.delete(riderId); }
export function currentThumbGesture(riderId: string, nowMs: number): ThumbGesture | null {
  const value = gestures.get(riderId);
  if (!value) return null;
  if (nowMs - value.startedAtMs > 3000) { gestures.delete(riderId); return null; }
  return value;
}

/**
 * 11-28 Chief: 엄지척·응답은 실제로 지나간 쪽을 향한다. 옆이격(RiderPassingMotion)이 매 프레임
 * 표시 중인 좌우 위치(m, 왼쪽 음수)를 내보내고, 버튼을 누르는 순간 상대가 내 왼쪽/오른쪽인지 읽는다.
 * 두 화면의 옆이격은 UID 기준으로 같은 배치를 만든다(rider-passing-motion 시험).
 */
const lateral = { self: null as number | null, peers: new Map<string, number>(), atMs: 0 };
export function publishRiderLateralOffsets(selfOffsetM: number | null, peers: ReadonlyMap<string, number>, nowMs = Date.now()): void {
  lateral.self = selfOffsetM; lateral.peers = new Map(peers); lateral.atMs = nowMs;
}
/** 상대가 내 어느 쪽에 보이는가. 정보가 1초 넘게 낡았거나 옆 간격이 0.3m 미만이면 null(호출부 기본값). */
export function lateralSideOfPeer(uid: string, nowMs = Date.now()): "left" | "right" | null {
  const peer = lateral.peers.get(uid);
  if (lateral.self == null || peer == null || nowMs - lateral.atMs > 1000) return null;
  const delta = peer - lateral.self;
  return Math.abs(delta) < 0.3 ? null : delta < 0 ? "left" : "right";
}
