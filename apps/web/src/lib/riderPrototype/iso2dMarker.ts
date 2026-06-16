import type { LngLat } from "../geo";
import type { RiderGlbPedalPose } from "../riderGlbPedalPose";

export type RiderVisualKind = "self" | "peer";

function prototypeBaseUrl(): string {
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  return baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
}

/** 4방향(동·남) + 좌우 반전으로 8방향 근사 */
export function resolveIso2dSprite(kind: RiderVisualKind, bearingDeg: number): {
  url: string;
  flipX: boolean;
} {
  const b = ((bearingDeg % 360) + 360) % 360;
  const useSouth = b >= 45 && b < 225;
  const flipX = b >= 135 && b < 315;
  const variant = kind === "self" ? "self" : "peer";
  const dir = useSouth ? "s" : "e";
  return {
    url: `${prototypeBaseUrl()}rider/prototype/iso-${variant}-${dir}.svg`,
    flipX,
  };
}

export function createIso2dRiderMarkerRoot(
  kind: RiderVisualKind,
  label: string,
  hostClass: string,
): {
  root: HTMLDivElement;
  nametag: HTMLDivElement;
  flip: HTMLDivElement;
  img: HTMLImageElement;
} {
  const root = document.createElement("div");
  root.className = `cycling-sim-marker-host map-view__proto-iso-host ${hostClass}`;

  const nametag = document.createElement("div");
  nametag.className =
    kind === "self"
      ? "map-view__rider-nametag map-view__rider-nametag--live"
      : "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = label;
  if (!label.trim()) nametag.style.display = "none";

  const flip = document.createElement("div");
  flip.className = "map-view__proto-iso-flip";

  const img = document.createElement("img");
  img.className = "map-view__proto-iso-sprite";
  img.alt = "";
  img.draggable = false;
  const { url, flipX } = resolveIso2dSprite(kind, 90);
  img.src = url;
  flip.style.transform = flipX ? "scaleX(-1)" : "scaleX(1)";

  flip.appendChild(img);
  root.appendChild(nametag);
  root.appendChild(flip);
  return { root, nametag, flip, img };
}

export function applyIso2dRiderBearing(
  flip: HTMLDivElement,
  img: HTMLImageElement,
  kind: RiderVisualKind,
  bearingDeg: number,
): void {
  const { url, flipX } = resolveIso2dSprite(kind, bearingDeg);
  if (img.src !== url) img.src = url;
  flip.style.transform = flipX ? "scaleX(-1)" : "scaleX(1)";
}

export type RiderGlbModelSpec = {
  id: string;
  lngLat: LngLat;
  bearingDeg: number;
  /** 크랭크·다리 nodeOverride 회전 */
  pedalPose?: RiderGlbPedalPose;
};
