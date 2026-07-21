#!/usr/bin/env node
/**
 * 라이더 GLB 멀티뷰 렌더 — 앱 구동·로그인 없이 오프스크린 스크린샷.
 *
 * 동작: rider-viewer.html 을 public/ 아래 임시 복사 → 일회용 vite dev 서버 →
 *       Playwright(Chromium)로 접속해 그리드 렌더 → PNG 저장 → 임시파일·서버 정리.
 *
 * 산출물(기본 out 디렉토리):
 *   rider-body.png  전신 6뷰(front/back/left/right/top/q34)  — 형태·비율 확인
 *   rider-head.png  머리 4방향(front/left/right/top)          — 얼굴 노출·헬멧 얹힘 확인
 *
 * 사용:
 *   node scripts/rider-preview/render-views.mjs [--out <dir>] [--glb <publicPath>] [--body|--head|--both]
 *   기본: --both, out=scripts/rider-preview/.out, glb=/rider/prototype/rider-lowpoly.glb
 *
 * 의존: three(앱 번들), @playwright/test 의 chromium(이미 설치됨), vite.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..", "..");
const publicDir = path.join(webRoot, "public");

// ── 인자 파싱 ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const outDir = path.resolve(webRoot, argVal("--out", path.join("scripts", "rider-preview", ".out")));
const glbPublicPath = argVal("--glb", "/rider/prototype/rider-lowpoly.glb");
const doBody = args.includes("--body") || args.includes("--both") || (!args.includes("--head"));
const doHead = args.includes("--head") || args.includes("--both") || (!args.includes("--body"));

const VIEWER_SRC = path.join(__dirname, "rider-viewer.html");
const VIEWER_TMP = path.join(publicDir, "__rider_viewer_tmp.html"); // vite 가 서빙하도록 public 에 임시 배치

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(VIEWER_SRC, VIEWER_TMP);

let server;
let browser;
async function cleanup() {
  try { if (fs.existsSync(VIEWER_TMP)) fs.unlinkSync(VIEWER_TMP); } catch {}
  try { await browser?.close(); } catch {}
  try { await server?.close(); } catch {}
}
process.on("SIGINT", async () => { await cleanup(); process.exit(130); });

try {
  server = await createServer({
    root: webRoot,
    server: { port: 0 }, // 임의 빈 포트
    logLevel: "error",
  });
  await server.listen();
  const port = server.config.server.port || server.httpServer.address().port;
  const base = `http://127.0.0.1:${port}`;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });

  async function shoot(mode, file) {
    const url = `${base}/__rider_viewer_tmp.html?mode=${mode}&glb=${encodeURIComponent(glbPublicPath)}`;
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__RIDER_VIEWER_READY__ === true, { timeout: 15000 });
    await page.waitForTimeout(200); // GL 프레임 안착
    const grid = page.locator("#grid");
    const out = path.join(outDir, file);
    await grid.screenshot({ path: out });
    console.log(`  ✓ ${mode}: ${path.relative(webRoot, out)}`);
  }

  console.log(`\n라이더 GLB 렌더 → ${path.relative(webRoot, outDir)}`);
  if (doBody) await shoot("body", "rider-body.png");
  if (doHead) await shoot("head", "rider-head.png");
  console.log("");
} catch (err) {
  console.error("렌더 실패:", err.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
