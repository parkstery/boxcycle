import type { Map as MapboxMap } from "mapbox-gl";

export const PEER_RIDER_PEDAL_ICON_IDS = [
  "boxcycle-peer-pedal-0",
  "boxcycle-peer-pedal-1",
  "boxcycle-peer-pedal-2",
  "boxcycle-peer-pedal-3",
  "boxcycle-peer-pedal-4",
  "boxcycle-peer-pedal-5",
] as const;

export const PEER_RIDER_PEDAL_FRAME_COUNT = PEER_RIDER_PEDAL_ICON_IDS.length;

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    /** 동일 출처 스프라이트는 CORS 생략이 더 안전(캔버스 오염·일부 환경 loadImage 실패 방지) */
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`peer sprite load failed: ${url}`));
    img.src = url;
  });
}

/** 동행용: 알파가 있는 픽셀에 청록 틴트(본인 실루엣과 구분) */
function tintPeerRiderPixels(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    if (a < 6) continue;
    rgba[i] = Math.min(255, Math.floor(rgba[i]! * 0.72));
    rgba[i + 1] = Math.min(255, Math.floor(rgba[i + 1]! * 1.05));
    rgba[i + 2] = Math.min(255, Math.floor(rgba[i + 2]! * 1.14));
  }
}

export function peerPedalSpritesReadyOnMap(map: MapboxMap): boolean {
  return PEER_RIDER_PEDAL_ICON_IDS.every((id) => map.hasImage(id));
}

/**
 * 메인 라이더와 동일 `pedal-sprite.png` 스트립에서 6프레임을 잘라 Mapbox `addImage` 로 등록한다.
 * `map.loadImage(data:)` 는 환경별로 불안정해 `createImageBitmap` + `addImage` 경로를 사용한다.
 */
export async function registerPeerRiderPedalSprites(
  map: MapboxMap,
  opts: {
    spriteUrl: string;
    cellPx: number;
    sourceFrameIndices: readonly number[];
    outSizePx: number;
  },
): Promise<boolean> {
  if (opts.sourceFrameIndices.length !== PEER_RIDER_PEDAL_FRAME_COUNT) {
    console.warn("[registerPeerRiderPedalSprites] sourceFrameIndices length must match icon count");
    return false;
  }

  try {
    const sheet = await loadHtmlImage(opts.spriteUrl);
    for (let i = 0; i < opts.sourceFrameIndices.length; i++) {
      const id = PEER_RIDER_PEDAL_ICON_IDS[i]!;
      const fi = opts.sourceFrameIndices[i]!;
      const sx = fi * opts.cellPx;
      const c = document.createElement("canvas");
      c.width = opts.outSizePx;
      c.height = opts.outSizePx;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.clearRect(0, 0, opts.outSizePx, opts.outSizePx);
      ctx.drawImage(
        sheet,
        sx,
        0,
        opts.cellPx,
        opts.cellPx,
        0,
        0,
        opts.outSizePx,
        opts.outSizePx,
      );
      const pix = ctx.getImageData(0, 0, opts.outSizePx, opts.outSizePx);
      tintPeerRiderPixels(pix.data);
      ctx.putImageData(pix, 0, 0);

      const bitmap = await createImageBitmap(c);
      try {
        if (map.hasImage(id)) {
          map.removeImage(id);
        }
        map.addImage(id, bitmap, { pixelRatio: 1 });
      } catch (e) {
        console.warn("[registerPeerRiderPedalSprites] addImage", id, e);
        return false;
      }
    }
    return peerPedalSpritesReadyOnMap(map);
  } catch (e) {
    console.warn("[registerPeerRiderPedalSprites]", e);
    return false;
  }
}
