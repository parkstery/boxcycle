import { inflateSync } from "node:zlib";

export type RgbaImage = { width: number; height: number; data: Uint8Array };

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePngRgba(buf: Buffer): RgbaImage {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error("PNG signature 아님");
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("ascii");
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`지원하지 않는 PNG (bit=${bitDepth} color=${colorType})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const recon = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src]!;
    src += 1;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const dst = y * stride;
    const prev = y === 0 ? null : recon.subarray(dst - stride, dst);
    for (let i = 0; i < stride; i += 1) {
      const x = row[i]!;
      const a = i >= bpp ? recon[dst + i - bpp]! : 0;
      const b = prev ? prev[i]! : 0;
      const c = prev && i >= bpp ? prev[i - bpp]! : 0;
      let val;
      if (filter === 0) val = x;
      else if (filter === 1) val = (x + a) & 255;
      else if (filter === 2) val = (x + b) & 255;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 255;
      else if (filter === 4) val = (x + paeth(a, b, c)) & 255;
      else throw new Error(`PNG filter ${filter}`);
      recon[dst + i] = val;
    }
  }
  const data = new Uint8Array(width * height * 4);
  if (colorType === 6) {
    data.set(recon);
  } else {
    for (let p = 0, q = 0; p < recon.length; p += 3, q += 4) {
      data[q] = recon[p]!;
      data[q + 1] = recon[p + 1]!;
      data[q + 2] = recon[p + 2]!;
      data[q + 3] = 255;
    }
  }
  return { width, height, data };
}
