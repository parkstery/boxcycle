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
 * HUD 「다른 라이더 없음」 근거.
 * 구독 중인 live ride 행에서 나를 제외한 행이 하나라도 있으면 true.
 * coursePeerHud(가시성 필터)나 Trail 접속자(안 달릴 수 있음)를 쓰지 않는다.
 */
export function hasOtherLiveRidePeer(
  rows: readonly { uid: string }[],
  selfUid: string,
): boolean {
  const me = selfUid.trim();
  if (!me) return false;
  return rows.some((r) => r.uid.trim() !== me);
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
