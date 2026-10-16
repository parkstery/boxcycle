#!/usr/bin/env node
/**
 * G1 헤드리스 — GPU 화면 = CPU 화면 + perflab 경향.
 *
 * dev 5070 + 브라우저 1개(단일 페이지 순차 이동). 끝나면 브라우저를 닫는다.
 * dev 서버 수명은 호출자(PowerShell 일괄 명령)가 가진다.
 *
 * (A) `rider-perf-bench.html?animate=0&riders=1&zoom=22&phase=<0|90|180|270>`
 *     를 `skin=cpu|gpu` 로 캡처(DPR 2, 라이더 크롭) — 최대·평균 채널 차,
 *     차이 픽셀(>8) 비율, ×8 차이 이미지. 기준: 평균 ≤ 1, 비율 ≤ 0.5 %.
 * (B) `?animate=1&riders=3&zoom=22` 에서 cpu/gpu 의 `msPerRider`·`posePct`
 *     (헤드리스 SwiftShader — 경향만).
 *
 * 사용: node scripts/rider-preserve/capture-gpu-skin-compare.mjs [--port 5070]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = fileURLToPath(new URL(".", import.meta.url));
const OUT = join(here, ".out", "gpu-skin");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const PORT = Number(argValue("--port", "5070"));

const PHASES = [0, 90, 180, 270];
const SKINS = ["cpu", "gpu"];
const CLIP = { x: 340, y: 110, width: 600, height: 560 };

// ---- 최소 PNG 코덱 (스크린샷 비교용, 의존성 없음) ----

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** 8비트 non-interlaced RGB/RGBA/그레이 → RGBA. */
function decodePng(png) {
  const buf = Buffer.from(png);
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error("not a PNG");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG ${bitDepth}/${interlace}`);
      if (![0, 2, 6].includes(colorType)) throw new Error(`unsupported color type ${colorType}`);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let at = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    const row = raw.subarray(at, at + stride);
    at += stride;
    const out = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = row[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) {
        throw new Error(`unknown filter ${filter}`);
      }
      out[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4;
      if (channels === 4) {
        rgba[d] = out[x * 4];
        rgba[d + 1] = out[x * 4 + 1];
        rgba[d + 2] = out[x * 4 + 2];
        rgba[d + 3] = out[x * 4 + 3];
      } else if (channels === 3) {
        rgba[d] = out[x * 3];
        rgba[d + 1] = out[x * 3 + 1];
        rgba[d + 2] = out[x * 3 + 2];
        rgba[d + 3] = 255;
      } else {
        rgba[d] = rgba[d + 1] = rgba[d + 2] = out[x];
        rgba[d + 3] = 255;
      }
    }
    prev = out;
  }
  return { width, height, rgba };
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

function diffStats(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("size mismatch");
  const n = a.width * a.height;
  const amp = Buffer.alloc(n * 4);
  let max = 0;
  let sum = 0;
  let diffPixels = 0;
  for (let p = 0; p < n; p++) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.rgba[p * 4 + c] - b.rgba[p * 4 + c]);
      if (d > m) m = d;
    }
    if (m > max) max = m;
    sum += (Math.abs(a.rgba[p * 4] - b.rgba[p * 4])
      + Math.abs(a.rgba[p * 4 + 1] - b.rgba[p * 4 + 1])
      + Math.abs(a.rgba[p * 4 + 2] - b.rgba[p * 4 + 2])) / 3;
    if (m > 8) diffPixels++;
    const g = Math.min(255, m * 8);
    amp[p * 4] = g;
    amp[p * 4 + 1] = g;
    amp[p * 4 + 2] = g;
    amp[p * 4 + 3] = 255;
  }
  return { max, mean: sum / n, diffRatio: diffPixels / n, diffPixels, pixels: n, amp };
}

// ---- 캡처 ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gotoBench(page, query) {
  await page.goto(`http://127.0.0.1:${PORT}/scripts/rider-preserve/rider-perf-bench.html${query}`, {
    waitUntil: "domcontentloaded",
    // 콜드 vite(의존성 최적화·400+ 모듈 변환)는 첫 적재가 오래 걸린다.
    timeout: 180_000,
  });
  await page.waitForFunction(() => window.__rtwBench?.state()?.loadState === "ready", null, {
    timeout: 240_000,
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const summary = { at: new Date().toISOString(), port: PORT, phases: [], perf: [] };
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    // (A) 화면 동등성
    for (const phase of PHASES) {
      const shots = {};
      for (const skin of SKINS) {
        await gotoBench(page, `?animate=0&riders=1&zoom=22&phase=${phase}&skin=${skin}`);
        const skinEff = await page.evaluate(() => window.__rtwBench?.skin?.() ?? "unknown");
        await sleep(2500);
        const path = join(OUT, `phase${phase}-${skin}.png`);
        await page.screenshot({ path, clip: CLIP });
        shots[skin] = { path, skinEff };
      }
      const a = decodePng(readFileSync(shots.cpu.path));
      const b = decodePng(readFileSync(shots.gpu.path));
      const stats = diffStats(a, b);
      const diffPath = join(OUT, `phase${phase}-diff-x8.png`);
      writeFileSync(diffPath, encodePng(a.width, a.height, stats.amp));
      const row = {
        phase,
        cpuSkin: shots.cpu.skinEff,
        gpuSkin: shots.gpu.skinEff,
        size: `${a.width}x${a.height}`,
        maxChannelDiff: stats.max,
        meanChannelDiff: Math.round(stats.mean * 1000) / 1000,
        diffPixelRatio: Math.round(stats.diffRatio * 100000) / 100000,
        diffPixels: stats.diffPixels,
        pixels: stats.pixels,
        pass: stats.mean <= 1 && stats.diffRatio <= 0.005,
      };
      summary.phases.push(row);
      console.log(
        `phase ${phase}: cpu=${row.cpuSkin} gpu=${row.gpuSkin} max=${row.maxChannelDiff} mean=${row.meanChannelDiff} ratio=${(row.diffPixelRatio * 100).toFixed(3)}% ${row.pass ? "PASS" : "FAIL"}`,
      );
    }
    // (B) perflab 경향
    for (const skin of SKINS) {
      await gotoBench(page, `?animate=1&riders=3&zoom=22&skin=${skin}`);
      const skinEff = await page.evaluate(() => window.__rtwBench?.skin?.() ?? "unknown");
      await page.evaluate(() => window.__rtwRiderCost?.reset());
      await sleep(10_000);
      const cost = await page.evaluate(() => window.__rtwRiderCost?.read() ?? null);
      const row = { skin: skinEff, cost };
      summary.perf.push(row);
      console.log(
        `perf ${skin}(${skinEff}): frames=${cost?.frames} msPerFrame=${cost?.msPerFrame} msPerRider=${cost?.msPerRider} posePct=${cost?.posePct}`,
      );
    }
    await context.close();
  } finally {
    await browser.close();
  }
  const outPath = join(OUT, "gpu-skin-compare.json");
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[gpu-skin] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
