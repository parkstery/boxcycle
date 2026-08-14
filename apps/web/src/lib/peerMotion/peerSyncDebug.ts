/**
 * DEV 진단 — 본인(self) distM 을 한 곳에 보관해서 peer distM 과 같은 줄에서 비교.
 * "데이터(받은 distM)가 틀렸나 / 렌더(보간)가 틀렸나" 를 한 번에 가른다.
 */
let selfDistM = 0;

export function setPeerSyncSelfDistM(d: number): void {
  if (Number.isFinite(d)) selfDistM = d;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as Window & { __RTW_PEER_SYNC_SELF_DIST_M?: number }).__RTW_PEER_SYNC_SELF_DIST_M =
      selfDistM;
  }
}

export function getPeerSyncSelfDistM(): number {
  return selfDistM;
}
