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
