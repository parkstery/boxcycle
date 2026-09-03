/** HUD 전용 — motion 은 PeerMotionRegistry, React 는 id·label 만 */
export type PeerHudEntry = {
  id: string;
  label: string;
};

export function peerHudStableKey(peers: PeerHudEntry[] | undefined): string {
  if (!peers?.length) return "";
  return peers
    .map((p) => `${p.id}:${p.label}`)
    .sort()
    .join("|");
}

export function peerHudLabels(peers: PeerHudEntry[]): string[] {
  return peers.map((p) => p.label.trim()).filter((n) => n.length > 0);
}

/**
 * 구독 중인 live ride 행에서 나를 제외한 고유 uid 수.
 * coursePeerHud(가시성 필터)나 Trail 접속자를 쓰지 않는다.
 */
export function countOtherLiveRidePeers(
  rows: readonly { uid: string }[],
  selfUid: string,
): number {
  const me = selfUid.trim();
  if (!me) return 0;
  const uids = new Set<string>();
  for (const r of rows) {
    const u = r.uid.trim();
    if (u && u !== me) uids.add(u);
  }
  return uids.size;
}

/**
 * HUD 「다른 라이더 없음」 근거 — 4B. count > 0 파생.
 */
export function hasOtherLiveRidePeer(
  rows: readonly { uid: string }[],
  selfUid: string,
): boolean {
  return countOtherLiveRidePeers(rows, selfUid) > 0;
}

/**
 * HUD 「다른 라이더 없음」 노출.
 * 이름 목록이 비어도 live ride 에 상대가 있으면 빈 문장을 쓰지 않는다
 * (접속 블록 dedup 으로 이름이 가려진 경우).
 * `7cbc007` 의 `hasOtherLiveRiders ? null : 빈문장` 과 같다.
 */
export function shouldShowCompanionEmptyCopy(
  coursePeerNamesLength: number,
  hasOtherLiveRiders: boolean,
): boolean {
  return coursePeerNamesLength === 0 && !hasOtherLiveRiders;
}

export function peerHudIdsKey(ids: readonly string[]): string {
  if (!ids.length) return "";
  return [...ids].sort().join("|");
}

export const EMPTY_PEER_HUD_IDS: readonly string[] = [];
