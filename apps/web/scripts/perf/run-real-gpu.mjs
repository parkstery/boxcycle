/**
 * 실GPU 성능 측정. headed Playwright 로 대상 사이트를 실제 GPU 에서 연다.
 * 헤드리스(SwiftShader)는 GPU 수치가 무의미하다. 브라우저와 GPU 가 있는 PC 에서만 실행한다.
 * 기본 대상은 운영 URL 이다.
 *
 *   node apps/web/scripts/perf/run-real-gpu.mjs
 *
 * 환경 변수
 *   BASE      대상 주소. 기본값 운영 https://boxcycle-dc2df.web.app
 *   COURSE    입문 코스 버튼 글자(예: 파리). 없으면 목록의 첫 코스
 *   VARIANTS  쉼표로 구분한 변형. 기본 none,terrain,buildings,labels,roads,all
 *
 * 변형 이름
 *   none                 ?perflab=1
 *   labelsOn             ?perflab=1&labels=1
 *   mode-X               ?perflab=1&labelmode=X
 *   mode-X@D             위 + &labeldist=D
 *   deco                 ?perflab=1&labelmode=all, 장식 심볼 레이어를 추가로 숨김
 *   skin-cpu | skin-gpu  ?perflab=1&skin=cpu|gpu. 끝의 숫자(skin-gpu2)는 뺀다
 *   그 밖(mapcut 키)      ?perflab=1&mapcut=키. all 은 terrain,buildings,labels,poi,sky,minimap,roads
 *
 * 결과: apps/web/scripts/perf/.out/<날짜시각>/ (gitignore)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const here = path.dirname(fileURLToPath(import.meta.url));
function outStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const outDir = path.join(here, ".out", outStamp());
fs.mkdirSync(outDir, { recursive: true });
console.log("[mapcut] out", outDir);
const BASE = process.env.BASE || "https://boxcycle-dc2df.web.app";
const VARIANTS = (process.env.VARIANTS || "none,terrain,buildings,labels,roads,all").split(",");
const ALL = "terrain,buildings,labels,poi,sky,minimap,roads";
function log(...a) { console.log("[mapcut]", ...a); }
const results = [];
for (const v of VARIANTS) {
  const q = v.startsWith("skin-") ? `?perflab=1&skin=${v.slice(5).replace(/\d+$/, "")}` : v.startsWith("deco") ? "?perflab=1&labelmode=all" : v.startsWith("mode-") ? `?perflab=1&labelmode=${v.slice(5).split("@")[0]}${v.includes("@") ? "&labeldist=" + v.split("@")[1] : ""}` : v.startsWith("none") ? "?perflab=1" : v.startsWith("labelsOn") ? "?perflab=1&labels=1" : `?perflab=1&mapcut=${v === "all" ? ALL : v}`;
  const browser = await chromium.launch({ headless: false, args: ["--window-size=1400,820", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const report = {};
  let lastStep = "";
  async function step(name, fn) { lastStep = name; log(v, name); await fn(); }
  async function shot() {}
  try {
    await page.goto(`${BASE}/${q}`, { waitUntil: "domcontentloaded", timeout: 40_000 });
  await step("entry", async () => {
    const intro = page.getByRole("region", { name: "앱 소개" });
    const gate = page.getByRole("dialog", { name: "시작" });
    const account = page.getByRole("button", { name: "사용자 정보" });
    const trail = page.getByRole("button", { name: "Trail 메뉴" });
    const failed = page.getByText("서비스에 연결할 수 없습니다.", { exact: true });
    const unconfigured = page.getByText("Firebase 설정 필요", { exact: true });
    const deadline = Date.now() + 50_000;
    let surface = "waiting";
    while (Date.now() < deadline) {
      if (await failed.isVisible().catch(() => false)) {
        surface = "connect-failed";
        break;
      }
      if (await unconfigured.isVisible().catch(() => false)) {
        surface = "unconfigured";
        break;
      }
      if (await intro.isVisible().catch(() => false)) {
        surface = "intro";
        await intro.getByRole("button", { name: "시작하기", exact: true }).click();
        await intro.waitFor({ state: "hidden", timeout: 15_000 });
        continue;
      }
      if (await gate.isVisible().catch(() => false)) {
        surface = "guest";
        await gate.getByRole("button", { name: "시작", exact: true }).click();
        await gate.waitFor({ state: "hidden", timeout: 30_000 });
        continue;
      }
      const menuClose = page.getByRole("button", { name: "메뉴 닫기" }).first();
      if (await menuClose.isVisible().catch(() => false)) {
        await menuClose.click();
        await page.waitForTimeout(300);
        continue;
      }
      const dock = await page.locator(".route-dock-anchor").count();
      if (dock > 0 && (await trail.isVisible().catch(() => false))) {
        surface = "map";
        break;
      }
      await page.waitForTimeout(400);
    }
    report.entrySurface = surface;
    log("entrySurface", surface);
    if (surface !== "map") throw new Error(`entry did not reach map (${surface})`);
  });

    await step("lightlab-before-ride", async () => {
    report.lightLabCountBeforeRide = await page.locator(".light-lab").count();
    const diag = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")].slice(0, 40).map((b) => ({
        name: b.getAttribute("aria-label") || b.textContent?.trim().slice(0, 40) || "",
        hidden: b.offsetParent == null,
      }));
      return {
        title: document.title,
        text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 500),
        buttons,
        dock: Boolean(document.querySelector(".route-dock-anchor")),
        lightLab: Boolean(document.querySelector(".light-lab")),
      };
    });
    report.uiDiag = diag;
    log("ui", JSON.stringify(diag).slice(0, 800));
    const toggle = page.locator(".light-lab").getByRole("button", { name: "조절판 펼치기" });
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(400);
    }
    
  });

    await step("arm-and-ride", async () => {
    const intro = page.getByRole("region", { name: "앱 소개" });
    if (await intro.isVisible().catch(() => false)) {
      await intro.getByRole("button", { name: "시작하기", exact: true }).click();
      await intro.waitFor({ state: "hidden", timeout: 15_000 });
    }
    const caret = page.getByRole("button", { name: /^센서 설정 열기/ });
    const expand = page.getByRole("button", { name: /^경로 패널 펼치기/ });
    const chip = page.getByRole("button", { name: /^케이던스 센서/ });
    await caret.or(expand).or(chip).first().waitFor({ state: "visible", timeout: 30_000 });
    if (await caret.isVisible().catch(() => false)) await caret.click();
    else {
      if (await expand.isVisible().catch(() => false)) await expand.click();
      await chip.click();
    }
    const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
    await sheet.waitFor({ state: "visible", timeout: 15_000 });
    await sheet.getByRole("button", { name: "센서 없음" }).click();
    await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
    await sheet.waitFor({ state: "hidden", timeout: 15_000 });

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "입문", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
    await modal.waitFor({ state: "visible", timeout: 20_000 });
    await (process.env.COURSE ? modal.locator("button.oc-modal__item", { hasText: process.env.COURSE }).first() : modal.locator("button.oc-modal__item").first()).click();
    const start = page.getByRole("button", { name: "주행 시작" });
    await start.waitFor({ state: "visible", timeout: 25_000 });
    await start.click();
    await page.getByRole("button", { name: "주행 종료" }).waitFor({ state: "visible", timeout: 40_000 });
  });

    const cam2 = page.getByRole("button", { name: "카메라 2" });
    let zoomNow = 0;
    await cam2.dispatchEvent("click").catch(() => {});
    await page.waitForTimeout(3000);
    const zoomIn = page.getByRole("button", { name: "줌 한 단계 확대" });
    for (let k = 0; k < 10; k++) {
      zoomNow = await page.evaluate(() => window.__RTW_MAP__?.getZoom?.() ?? 0).catch(() => 0);
      log(v, "zoom", zoomNow.toFixed(1));
      if (zoomNow >= 21) break;
      await cam2.dispatchEvent("click").catch(() => {});
      await page.waitForTimeout(2000);
    }
    if (v.startsWith("deco")) {
      const hidden = await page.evaluate(() => {
        const m = window.__RTW_MAP__;
        const keep = /^(road-label|poi-label|settlement|natural|water|waterway|airport|state|country|continent)/;
        const out = [];
        for (const l of m.getStyle().layers) {
          if (l.type !== "symbol" || /^(boxcycle-|route|distance-|debug-|live-self)/.test(l.id)) continue;
          if (keep.test(l.id) && !/(shield|number|navigation|simple|exit)/.test(l.id)) continue;
          m.setLayoutProperty(l.id, "visibility", "none"); out.push(l.id);
        }
        return out;
      });
      log(v, "hidden", JSON.stringify(hidden));
    }
    await page.waitForTimeout(12_000);
    await page.screenshot({ path: path.join(outDir, `view-${process.env.COURSE ? "c-" : ""}${v}.png`) });
    const toggle = page.getByRole("button", { name: "성능 펼치기" });
    const copy = page.getByRole("button", { name: "결과 복사" });
    if (!(await copy.isVisible().catch(() => false))) await toggle.click().catch(() => {});
    await page.waitForTimeout(500);
    await copy.click();
    await page.waitForTimeout(500);
    let text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (!text) text = await page.getByLabel("결과 JSON").inputValue().catch(() => "");
    const j = JSON.parse(text);
    const b = j.breakdown || {};
    const row = { variant: v, skin: j.skinMode, msPerRider: j.rider?.msPerRider, posePct: j.rider?.posePct, mode: j.rideLabelMode, dist: j.rideLabelDist, labelsHidden: j.rideLabelsHidden, mapcut: j.mapcut, fps: +j.frame.fps.toFixed(1), frameP50: j.frame.p50Ms, frameP95: j.frame.p95Ms,
      tick: +(b.tick?.meanMs ?? 0).toFixed(2), mapExRider: +(b.map?.exRiderMeanMs ?? 0).toFixed(2), rider: +(j.rider?.msPerFrame ?? 0).toFixed(2),
      gpu: b.gpu?.meanMs != null ? +b.gpu.meanMs.toFixed(2) : null, wait: +(b.summary?.waitMs ?? 0).toFixed(2), zoom: +(j.rider?.zoom ?? 0).toFixed(1),
      renderer: j.device?.webgl?.unmaskedRenderer };
    results.push(row); log(JSON.stringify(row));
    fs.writeFileSync(path.join(outDir, `report-${v}.json`), text);
    await page.screenshot({ path: path.join(outDir, `shot-${v}.png`) });
  } catch (e) { log(v, "FAIL@" + lastStep, String(e).split(String.fromCharCode(10))[0]); results.push({ variant: v, error: String(e).slice(0, 300) }); }
  finally { await browser.close(); }
}
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
console.table(results);
