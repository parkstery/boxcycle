#!/usr/bin/env node
/**
 * offscreen-raster — 브라우저·Blender 없이 GLB 포즈를 **정사영 z-buffer 로 래스터**한다 (F35).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 「보이는가」를 광선 탈출(escape ray)·안팎 판정(parity)·표면 거리 같은 **대리 지표**로
 * 재다가 그림과 세 번 어긋났다(F35 §1). 대리 지표는 «어느 방향에서든 보이면 노출»이라
 * 게임에 없는 시선까지 세거나, 반대로 테두리 여유(inset) 때문에 눈에 띄는 초승달을
 * 0 으로 보고했다.
 *
 * **결국 눈이 보는 것은 픽셀이다.** 그래서 실제 게임 카메라 배율·고도각으로 렌더해
 * **문제 삼각형이 화면에 몇 픽셀 차지하는지** 직접 센다. 대리 지표가 아니라 그림이다.
 *
 * 배율은 `MM_PER_PX` — 라이더 전고 약 430px 실측에서 온 **3.9mm/px**(F34).
 * 고도각은 `mapGlobeView.RIDE_CAMERA_PITCH_CLOSE = 80`(수직 기준) → **시선 고도각 10°**.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   import { renderOrtho, cameraBasis, writePNG } from "./offscreen-raster.mjs";
 */
import fs from "node:fs";
import zlib from "node:zlib";

/** 게임 카메라 1픽셀의 실제 크기(mm) — 라이더 전고 약 430px 실측(F34) */
export const MM_PER_PX = 3.9;

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (buf) => { let c = -1; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
/** RGB 버퍼를 PNG 로 저장 */
export function writePNG(file, W, H, rgb) {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]));
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** 방위 az·고도 el(도)에서 대상을 바라보는 카메라 기저 */
export function cameraBasis(azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const fwd = [-Math.cos(el) * Math.cos(az), -Math.sin(el), -Math.cos(el) * Math.sin(az)];
  let right = cross3(fwd, [0, 1, 0]);
  const L = Math.hypot(...right) || 1;
  right = right.map((v) => v / L);
  const up = cross3(right, fwd);
  return { right, up, fwd };
}

/**
 * 정사영 z-buffer 래스터. `tris = [{v:[p0,p1,p2](mm), tag:number}]`.
 * @returns {{tagBuf:Int32Array, rgb:Buffer, W:number, H:number}} 픽셀마다 «보이는 삼각형의 tag»
 */
export function renderOrtho({ W, H, tris, basis, centerMm, mmPerPx = MM_PER_PX, palette = null }) {
  const tagBuf = new Int32Array(W * H).fill(-1);
  const zb = new Float64Array(W * H).fill(Infinity);
  const s = 1 / mmPerPx;
  const px = (p) => [
    W / 2 + (dot3(p, basis.right) - centerMm[0]) * s,
    H / 2 - (dot3(p, basis.up) - centerMm[1]) * s,
    dot3(p, basis.fwd),
  ];
  for (const { v, tag } of tris) {
    const a = px(v[0]), b = px(v[1]), c = px(v[2]);
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((b[0] - a[0]) * (y + 0.5 - a[1]) - (x + 0.5 - a[0]) * (b[1] - a[1])) / area;
        const w1 = ((x + 0.5 - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y + 0.5 - a[1])) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w2 * a[2] + w1 * b[2] + w0 * c[2];
        const o = y * W + x;
        if (z >= zb[o]) continue;
        zb[o] = z;
        tagBuf[o] = tag;
      }
    }
  }
  let rgb = null;
  if (palette) {
    rgb = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const c = tagBuf[i] >= 0 ? palette[tagBuf[i]] ?? [200, 200, 200] : [24, 26, 30];
      rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
    }
  }
  return { tagBuf, rgb, W, H };
}
