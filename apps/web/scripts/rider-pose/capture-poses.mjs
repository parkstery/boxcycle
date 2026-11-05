#!/usr/bin/env node
/**
 * rider15 pose 시안 캡처 — 제품 GLB 는 건드리지 않고, 상체 본이 들어갔을 때의
 * 결과를 근사(2-bone IK + 거리 가중 LBS)해 정지 이미지로 굽는다.
 *
 * 실행: node apps/web/scripts/rider-pose/capture-poses.mjs
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../../..");
const OUT = path.join(ROOT, "document/ops/20261104-rider-v2-upper-body/pose-preview");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw new Error("outside root");
    const buf = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(buf);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[page]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("requestfailed", (r) => console.log("[reqfail]", r.url(), r.failure()?.errorText));
page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url()); });

await page.goto(`http://127.0.0.1:${port}/apps/web/scripts/rider-pose/pose-lab.html`, {
  waitUntil: "load",
});
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) throw new Error(err);

const shots = [
  ["ride", "hero", "pose-0-ride.png"],
  ["manse", "hero", "pose-1-manse.png"],
  ["fight", "hero", "pose-2-fight.png"],
  ["thumb", "hero", "pose-3-thumb.png"],
  ["thumb", "closeup", "pose-3-thumb-closeup.png"],
  ["fight", "closeup", "pose-2-fight-closeup.png"],
];

for (const [pose, view, file] of shots) {
  await page.evaluate(([p, v]) => { window.__debugMoved = true; window.setView(v); window.setPose(p); }, [pose, view]);
  await page.waitForTimeout(350);
  if (pose !== "ride" && view === "hero") {
    const moved = await page.evaluate(() => window.__moved);
    console.log("moved", pose, JSON.stringify(moved));
  }
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("saved", file);
}

// 제품 화면 축척(360p 가로) — 라이더 키 ≈ 115 px
await page.setViewportSize({ width: 640, height: 360 });
const phone = [
  ["ride", "phone-0-ride.png"],
  ["manse", "phone-1-manse.png"],
  ["fight", "phone-2-fight.png"],
  ["thumb", "phone-3-thumb.png"],
];
for (const [pose, file] of phone) {
  await page.evaluate((p) => { window.setView("phone"); window.setPose(p); }, pose);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("saved", file);
}

// 접촉 시트
const sheet = [
  ["pose-1-manse.png", "만세"],
  ["pose-2-fight.png", "파이팅"],
  ["pose-3-thumb.png", "엄지 척"],
  ["phone-1-manse.png", "만세 · 360p"],
  ["phone-2-fight.png", "파이팅 · 360p"],
  ["phone-3-thumb.png", "엄지 척 · 360p"],
];
await page.setViewportSize({ width: 1600, height: 1080 });
await page.goto(
  `http://127.0.0.1:${port}/apps/web/scripts/rider-pose/compose-sheet.html?base=${encodeURIComponent("/document/ops/20261104-rider-v2-upper-body/pose-preview/")}&items=${encodeURIComponent(sheet.map(([f, l]) => `${f}|${l}`).join(";"))}`,
  { waitUntil: "load" },
);
await page.waitForFunction(() => window.__sheetReady, null, { timeout: 30000 });
await page.screenshot({ path: path.join(OUT, "sheet.png") });
console.log("saved sheet.png");

await browser.close();
server.close();
console.log("OUT:", OUT);