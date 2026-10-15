#!/usr/bin/env node
/** P0 rider14 교체 전 기준선 측정 — rider-perf-bench.html 을 순차 실행한다. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
// RTW_BENCH_OUT: 출력 폴더 이름. 비어 있으면 p0 (기존과 같은 경로).
const outDir = path.join(here, ".out", "rider14", process.env.RTW_BENCH_OUT || "p0");
// 127.0.0.1:5040 v4는 타 프로세스가 점유해 빈 응답을 돌려준다(vite는 ::1로 닿는다).
// 지시 URL(127.0.0.1)을 먼저 시도하고, 실패하면 같은 서버의 localhost 로 내려간다.
const BASES = process.env.RTW_BENCH_BASE
  ? [process.env.RTW_BENCH_BASE]
  : ["http://127.0.0.1:5040", "http://localhost:5040"];
let BASE = BASES[0];
for (const candidate of BASES) {
  try {
    const res = await fetch(`${candidate}/scripts/rider-preserve/rider-perf-bench.html?zoom=22`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      BASE = candidate;
      break;
    }
  } catch {
    /* 다음 후보로 */
  }
}
console.log(`base=${BASE}`);
console.log(
  `out=${path.basename(outDir)} model=${process.env.RTW_BENCH_MODEL || ""} extra=${process.env.RTW_BENCH_EXTRA || ""}`,
);
// 줌 단위 분할 실행용: RTW_BENCH_ZOOMS="22,19" / RTW_BENCH_SKIP_READY=1
// (메모리 부족 등으로 중단될 때 남은 줌만 이어서 돌린다. 기본값은 전체·전체.)
const ZOOMS = (process.env.RTW_BENCH_ZOOMS ?? "22,19,17,15")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
const SKIP_READY = process.env.RTW_BENCH_SKIP_READY === "1";
const FRAMES = 120;
const COST_FRAMES = 240;

function benchUrl(zoom, riders, animate) {
  const model = process.env.RTW_BENCH_MODEL;
  const extra = process.env.RTW_BENCH_EXTRA || "";
  return (
    `${BASE}/scripts/rider-preserve/rider-perf-bench.html` +
    `?zoom=${zoom}&pitch=67&bearing=-32&riders=${riders}&animate=${animate}` +
    (model ? `&riderModel=${model}` : "") +
    extra
  );
}

async function waitBenchReady(page, timeoutMs = 120000) {
  await page.waitForFunction(() => Boolean(window.__rtwBench), null, { timeout: timeoutMs });
  await page.waitForFunction(() => window.__rtwBench.state().loadState === "ready", null, {
    timeout: timeoutMs,
  });
}

async function measure(page, frames) {
  return page.evaluate((f) => window.__rtwBench.measure(f), frames);
}

async function setRiders(page, n) {
  await page.evaluate((v) => window.__rtwBench.setRiders(v), n);
  await page.waitForTimeout(800);
}

async function readCost(page, frames) {
  await page.evaluate((v) => window.__rtwBench.setRiders(v), 3);
  return page.evaluate((f) => {
    window.__rtwRiderCost.reset();
    return new Promise((resolve) => {
      let n = 0;
      const step = () => {
        n += 1;
        if (n >= f) resolve(window.__rtwRiderCost.read());
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, frames);
}

async function runOnce(gpuPath, launchArgs) {
  const browser = await chromium.launch({ headless: true, args: launchArgs });
  try {
    const zooms = {};
    const prior = (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(outDir, "bench.json"), "utf8"));
      } catch {
        return null;
      }
    })();
    const firstReadyMs = Array.isArray(prior?.firstReadyMs) ? prior.firstReadyMs : [];
    let assets = Array.isArray(prior?.assets) ? prior.assets : null;
    let chromiumVersion = typeof prior?.meta?.chromium === "string" ? prior.meta.chromium : null;
    if (prior?.zooms && typeof prior.zooms === "object") {
      for (const [k, v] of Object.entries(prior.zooms)) zooms[k] = v;
    }
    if (!chromiumVersion) chromiumVersion = browser.version();
    // firstReady 3회 — 매번 새 브라우저 컨텍스트(캐시 비활성)
    const readyTarget = SKIP_READY && firstReadyMs.length > 0 ? firstReadyMs.length : 3;
    for (let i = firstReadyMs.length; i < readyTarget; i += 1) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      try {
        const page = await ctx.newPage();
        await page.goto(benchUrl(22, 3, 1), { waitUntil: "load" });
        await waitBenchReady(page);
        const st = await page.evaluate(() => window.__rtwBench.state());
        firstReadyMs.push(st.firstReadyMs);
        if (i === 0) assets = await page.evaluate(() => window.__rtwBench.assets());
      } finally {
        await ctx.close();
      }
    }
    const buildResult = () => {
      const sorted = [...firstReadyMs].sort((a, b) => a - b);
      return {
        meta: {
          node: process.version,
          chromium: chromiumVersion,
          gpuPath,
          viewport: "1280x800",
          base: BASE,
          at: new Date().toISOString(),
          memTotalMB: Math.round(os.totalmem() / 1048576),
          memFreeMB: Math.round(os.freemem() / 1048576),
        },
        firstReadyMs,
        firstReadyMedianMs: sorted[1] ?? null,
        assets,
        zooms,
      };
    };
    const savePartial = () => {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "bench.json"), JSON.stringify(buildResult(), null, 2));
    };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      for (const z of ZOOMS) {
        if (zooms[String(z)]?.cost && zooms[String(z)]?.capture) {
          console.log(`zoom ${z}: skip (already in bench.json)`);
          continue;
        }
        const page = await ctx.newPage();
        await page.goto(benchUrl(z, 3, 1), { waitUntil: "load" });
        await waitBenchReady(page);
        const m3 = await measure(page, FRAMES);
        await setRiders(page, 0);
        const m0 = await measure(page, FRAMES);
        await setRiders(page, 1);
        const m1 = await measure(page, FRAMES);
        const cost = await readCost(page, COST_FRAMES);
        await page.close();
        // animate=0 캡처 (새 페이지)
        const shot = await ctx.newPage();
        await shot.goto(benchUrl(z, 3, 0), { waitUntil: "load" });
        await waitBenchReady(shot);
        await shot.waitForTimeout(1500);
        const shotPath = path.join(outDir, `z${z}.png`);
        await shot.screenshot({ path: shotPath });
        await shot.close();
        zooms[String(z)] = {
          riders3: m3,
          riders0: m0,
          riders1: m1,
          perRiderDrawFrom3: (m3.drawCallsPerFrame - m0.drawCallsPerFrame) / 3,
          perRiderDrawFrom1: m1.drawCallsPerFrame - m0.drawCallsPerFrame,
          perRiderTriFrom3: (m3.trianglesPerFrame - m0.trianglesPerFrame) / 3,
          perRiderTriFrom1: m1.trianglesPerFrame - m0.trianglesPerFrame,
          cost,
          capture: shotPath,
        };
        console.log(
          `zoom ${z}: 3=${m3.drawCallsPerFrame} 0=${m0.drawCallsPerFrame} 1=${m1.drawCallsPerFrame} dc/f`,
        );
        savePartial();
      }
    } finally {
      await ctx.close();
    }
    return buildResult();
  } finally {
    await browser.close();
  }
}

fs.mkdirSync(outDir, { recursive: true });
let result = null;
let lastError = null;
const attempts = [
  { gpuPath: "default", args: [] },
  { gpuPath: "swiftshader", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
].filter((a) => !process.env.RTW_BENCH_GPU || a.gpuPath === process.env.RTW_BENCH_GPU);
try {
  const priorMeta = JSON.parse(fs.readFileSync(path.join(outDir, "bench.json"), "utf8"))?.meta;
  const known = attempts.findIndex((a) => a.gpuPath === priorMeta?.gpuPath);
  if (known > 0) {
    const [hit] = attempts.splice(known, 1);
    attempts.unshift(hit);
  }
} catch {
  /* 부분 결과가 없으면 기본 순서대로 */
}
// SwiftShader 재시도는 GPU 경로 실패(WebGL 컨텍스트 생성 실패·CONTEXT_LOST·흰 화면)일 때만 한다.
// 그 밖의 예외(ReferenceError 등 코드 오류 포함)는 바로 실패로 끝낸다.
function isGpuFailure(error) {
  const msg = String(error?.message ?? error ?? "");
  return /webgl|CONTEXT_LOST|context lost|lost context|failed to create.*context|gpu process|ANGLE|EGL|D3D|white|blank/i.test(
    msg,
  );
}
for (const attempt of attempts) {
  console.log(`attempts=${JSON.stringify(attempts.map((a) => a.gpuPath))}`);
  try {
    console.log(`launch: gpuPath=${attempt.gpuPath}`);
    result = await runOnce(attempt.gpuPath, attempt.args);
    break;
  } catch (error) {
    lastError = error;
    console.error(`attempt ${attempt.gpuPath} failed: ${error?.message ?? error}`);
    if (attempt.gpuPath === "swiftshader") throw error;
    if (!isGpuFailure(error)) throw error;
    console.error("gpu-path failure detected; retrying with swiftshader");
  }
}
if (!result) throw lastError ?? new Error("bench failed with no result");
const outPath = path.join(outDir, "bench.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`wrote ${outPath}`);
