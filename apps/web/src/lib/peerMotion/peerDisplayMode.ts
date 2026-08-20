/**
 * S4-13 — Chief 시승용 peer 표시 모드. DEV 전용. 프로덕션은 항상 off.
 * 기본값 off = 현재 보간 + PEER_INTERP_DELAY_MS(160). 발행 로직은 읽지 않는다.
 *
 * 전환 (재빌드·재시작 없이, 매 rAF 에 읽음):
 *   URL    ?peerDisp=off|a|b
 *   콘솔   window.__RTW_PEER_DISP__ = "a"
 * 콘솔 값이 URL 보다 우선한다.
 */
export type PeerDispMode = "off" | "a" | "b";

export type PeerDispSpec = {
  mode: Exclude<PeerDispMode, "off">;
  eM: number;
  tauAbs: number;
  tauLeadSec: number;
};

declare global {
  interface Window {
    __RTW_PEER_DISP__?: string;
  }
}

export const PEER_DISP_A: PeerDispSpec = { mode: "a", eM: 0.3, tauAbs: 0.25, tauLeadSec: 0 };
export const PEER_DISP_B: PeerDispSpec = { mode: "b", eM: 0.3, tauAbs: 0.3, tauLeadSec: 0 };

function parseMode(raw: string | null | undefined): PeerDispMode | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "off" || v === "a" || v === "b") return v;
  return null;
}

export function readPeerDispMode(envDev: boolean = import.meta.env.DEV): PeerDispMode {
  if (!envDev) return "off";
  if (typeof window !== "undefined") {
    const fromWin = parseMode(window.__RTW_PEER_DISP__);
    if (fromWin) return fromWin;
    try {
      const fromUrl = parseMode(new URLSearchParams(window.location.search).get("peerDisp"));
      if (fromUrl) return fromUrl;
    } catch {
      /* node 시험 */
    }
  }
  return "off";
}

export function peerDispSpec(mode: PeerDispMode = readPeerDispMode()): PeerDispSpec | null {
  if (mode === "a") return PEER_DISP_A;
  if (mode === "b") return PEER_DISP_B;
  return null;
}
