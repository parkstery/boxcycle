// 실제 표고(Mapbox terrain-rgb z11)에서 방향별 산 능선의 올려본 각을 구한다. 시안용.
import fs from 'node:fs';
import zlib from 'node:zlib';
const token = fs.readFileSync('C:/20.HDev/boxcycle/apps/web/.env', 'utf8').match(/VITE_MAPBOX_ACCESS_TOKEN=(.*)/)[1].trim().replace(/['"]/g, '');
const Z = 11, R = 6371000;

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 3;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : 3;
      if (d[8] !== 8 || d[12] !== 0 || (d[9] !== 2 && d[9] !== 6)) throw new Error('png ' + d[8] + ' ' + d[9] + ' ' + d[12]);
    }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, o = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= ch ? o[y * stride + x - ch] : 0, b = y ? o[(y - 1) * stride + x] : 0, c = x >= ch && y ? o[(y - 1) * stride + x - ch] : 0;
      let pr = 0;
      if (f === 1) pr = a;
      else if (f === 2) pr = b;
      else if (f === 3) pr = (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      o[y * stride + x] = (v + pr) & 255;
    }
  }
  return { w, h, ch, o };
}

export async function ridgeProfile([lng, lat], steps = 720, bands = [[1200, 4000], [4000, 9000], [9000, 25000]]) {
  const n = 2 ** Z;
  const X = (lo) => (lo + 180) / 360 * n, Y = (la) => (1 - Math.asinh(Math.tan(la * Math.PI / 180)) / Math.PI) / 2 * n;
  const cache = new Map();
  const tile = (x, y) => {
    const k = x + '/' + y;
    if (!cache.has(k)) cache.set(k, fetch(`https://api.mapbox.com/v4/mapbox.terrain-rgb/${Z}/${x}/${y}.pngraw?access_token=${token}`, { headers: { Referer: 'http://localhost:5000/' } })
      .then(async (r) => (r.ok ? decodePng(Buffer.from(await r.arrayBuffer())) : null)));
    return cache.get(k);
  };
  const elev = async (lo, la) => {
    const fx = X(lo), fy = Y(la), t = await tile(Math.floor(fx), Math.floor(fy));
    if (!t) return 0;
    const i = (Math.min(t.h - 1, Math.floor((fy % 1) * t.h)) * t.w + Math.min(t.w - 1, Math.floor((fx % 1) * t.w))) * t.ch;
    return -10000 + (t.o[i] * 65536 + t.o[i + 1] * 256 + t.o[i + 2]) * 0.1;
  };
  const h0 = await elev(lng, lat) + 2;
  const out = [];
  for (const [d0, d1] of bands) {
    const deg = [];
    for (let s = 0; s < steps; s++) {
      const b = s / steps * 2 * Math.PI;
      let best = 0;
      for (let d = d0; d <= d1; d *= 1.02) {
        const la = lat + d * Math.cos(b) / R * 180 / Math.PI, lo = lng + d * Math.sin(b) / (R * Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
        best = Math.max(best, (await elev(lo, la) - h0 - d * d / (2 * R * 1.16)) / d);
      }
      deg.push(+(Math.atan(best) * 180 / Math.PI).toFixed(2));
    }
    out.push({ d0, d1, deg });
  }
  console.log('LOOK ridge tiles', cache.size, 'ground', Math.round(h0));
  return out;
}
