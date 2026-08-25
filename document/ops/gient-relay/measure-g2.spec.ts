/**
 * G-2 측정 — 한 세션에서 model-scale paint 만 23 ↔ 460 토글.
 */
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const PAIR = process.env.GIENT_PAIR === "1";
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(OUT_DIR, "shots");
const LAYER_ID = "boxcycle-rider-prototype-layer";
const SOURCE_ID = "boxcycle-rider-prototype-source";
const SCALE_BEFORE = 23;
const SCALE_AFTER = 460;

type MapboxLike = {
  getSource?: (id: string) => unknown;
  getLayer?: (id: string) => unknown;
  getPaintProperty?: (id: string, p: string) => unknown;
  setPaintProperty?: (id: string, p: string, v: unknown) => void;
  getLayoutProperty?: (id: string, p: string) => unknown;
  setLayoutProperty?: (id: string, p: string, v: unknown) => void;
  getCanvas?: () => HTMLCanvasElement;
  getContainer?: () => HTMLElement;
  project?: (ll: { lng: number; lat: number } | [number, number]) => { x: number; y: number };
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
  getPitch?: () => number;
  getBearing?: () => number;
  getFreeCameraOptions?: () => { position?: { x: number; y: number; z?: number } };
  stop?: () => void;
  jumpTo?: (o: unknown) => void;
  once?: (ev: string, cb: () => void) => void;
  queryRenderedFeatures?: (pt: unknown, o?: unknown) => unknown[];
  getStyle?: () => { layers?: { id: string; type: string }[] };
  fitBounds?: (b: unknown, o: unknown) => void;
};

test.describe("G-2 gient measure", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요");
  test.describe.configure({ timeout: 420_000 });

  test("solo toggle G0–G5 G1' G2' G10", async ({ page }) => {
    test.skip(PAIR, "pair 전용");
    const consoleErr: string[] = [];
    const consoleWarn: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErr.push(msg.text());
      if (msg.type() === "warning") consoleWarn.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErr.push(String(err)));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await page.waitForTimeout(2_500);
    const followCam = await readCamera(page);

    await page.evaluate(() => {
      (window as Window & { __rtwTick?: { follow: (on: boolean) => void } }).__rtwTick?.follow(false);
    });
    await setSpeedKmh(page, 5);
    await setRideDistanceM(page, 1);
    await pauseRide(page);
    await waitForGlbLayer(page);

    const live = await livePos(page);
    const camLocked = {
      center: { lng: live[0], lat: live[1] },
      zoom: 14.0,
      pitch: 50,
      bearing: 90,
    };
    await applyCamera(page, camLocked);
    await waitIdle(page);
    await hideChrome(page);

    await setScale(page, SCALE_BEFORE);
    await page.waitForTimeout(1_200);
    const g0Before = await readScale(page);
    const posBefore = await livePos(page);
    const uiBefore = await measureUi(page);

    await setScale(page, SCALE_AFTER);
    await page.waitForTimeout(1_200);
    const g0After = await readScale(page);
    const posAfter = await livePos(page);
    const uiAfter = await measureUi(page);
    const camAfterUi = await readCamera(page);

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOT_DIR, "g2-ui.png"), await page.screenshot({ type: "png" }));

    await tintRider(page);
    await isolateModelLayer(page);
    await applyCamera(page, camLocked);
    await waitIdle(page);

    await setScale(page, SCALE_BEFORE);
    await page.waitForTimeout(1_200);
    const capB = await captureSilhouette(page);
    const camG4Before = await readCamera(page);

    await setScale(page, SCALE_AFTER);
    await page.waitForTimeout(1_200);
    const capA = await captureSilhouette(page);
    const camG4After = await readCamera(page);
    const g10 = await debugRender(page);

    fs.writeFileSync(path.join(SHOT_DIR, "g2-wide.png"), capA.withR);
    fs.writeFileSync(
      path.join(SHOT_DIR, "g2-contact-before.png"),
      await cropAround(page, capB.withR, (capB.sil.bbox.x0 + capB.sil.bbox.x1) / 2, capB.sil.contactY, 180, 110),
    );
    fs.writeFileSync(
      path.join(SHOT_DIR, "g2-contact-after.png"),
      await cropAround(page, capA.withR, (capA.sil.bbox.x0 + capA.sil.bbox.x1) / 2, capA.sil.contactY, 180, 110),
    );

    const hBeforeFrame = await captureForInvert(page, SCALE_BEFORE, 19.0);
    fs.writeFileSync(path.join(SHOT_DIR, "g2-h-before.png"), hBeforeFrame.withR);
    const hBefore = await invertWorldHeight(page, hBeforeFrame.pos, hBeforeFrame.sil.cssHeadY);

    const hAfterFrame = await captureForInvert(page, SCALE_AFTER, 13.8);
    fs.writeFileSync(path.join(SHOT_DIR, "g2-h-after.png"), hAfterFrame.withR);
    const hAfter = await invertWorldHeight(page, hAfterFrame.pos, hAfterFrame.sil.cssHeadY);

    const g2Before = await measureRatioAtMinHeight(page, SCALE_BEFORE, 120);
    const g2After = await measureRatioAtMinHeight(page, SCALE_AFTER, 120);
    fs.writeFileSync(path.join(SHOT_DIR, "g2-ratio-after.png"), g2After.annotated);

    await restoreIsolation(page);
    await setScale(page, SCALE_AFTER);
    const restored = await readScale(page);

    const hashes: Record<string, string> = {};
    for (const name of [
      "g2-h-before.png",
      "g2-h-after.png",
      "g2-wide.png",
      "g2-contact-before.png",
      "g2-contact-after.png",
      "g2-ratio-after.png",
      "g2-ui.png",
    ]) {
      const p = path.join(SHOT_DIR, name);
      hashes[name] = sha256(fs.readFileSync(p));
    }

    const out: Record<string, unknown> = {
      followZoom: followCam.zoom,
      followCam,
      camLocked,
      camAfterUi,
      camG4Before,
      camG4After,
      g0Before,
      g0After,
      g0Ratio: ratioOf(g0After, g0Before),
      posBefore,
      posAfter,
      silG4Before: capB.sil,
      silG4After: capA.sil,
      hBeforeFrame: { zoom: hBeforeFrame.zoom, sil: hBeforeFrame.sil },
      hAfterFrame: { zoom: hAfterFrame.zoom, sil: hAfterFrame.sil },
      hBefore,
      hAfter,
      hRatio: hAfter.h > 0 && hBefore.h > 0 ? hAfter.h / hBefore.h : 0,
      g2Before: { h: g2Before.h, wheelPx: g2Before.wheelPx, ratio: g2Before.ratio, zoom: g2Before.zoom },
      g2After: { h: g2After.h, wheelPx: g2After.wheelPx, ratio: g2After.ratio, zoom: g2After.zoom },
      uiBefore,
      uiAfter,
      restored,
      g9: null as unknown,
      g10,
      consoleErr,
      consoleWarn,
      hashes,
    };
    fs.writeFileSync(path.join(OUT_DIR, "G2-gates.json"), JSON.stringify(out, null, 2));
    const g9 = await runG9RevertCheck(page);
    out.g9 = g9;
    fs.writeFileSync(path.join(OUT_DIR, "G2-gates.json"), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));

    expect(g0Before, "G0 before live").toEqual([23, 23, 23]);
    expect(g0After, "G0 after live").toEqual([460, 460, 460]);
    expect(uiBefore.nametagPx, "nametag").toBeGreaterThan(0);
    expect(uiAfter.hudPx, "HUD").toBeGreaterThan(0);
  });

  test("pair G6'", async ({ browser }) => {
    test.skip(!PAIR, "GIENT_PAIR=1");
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto("/");
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);
    await setSpeedKmh(pageA, 5);
    await setRideDistanceM(pageA, 1);
    await pauseRide(pageA);

    await expect.poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 }).not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}`);
    await guestStart(pageB);
    await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageB);
    await setSpeedKmh(pageB, 50);
    await waitForGlbLayer(pageB);

    await expect.poll(async () => Object.keys((await readModels(pageB)).models).length, { timeout: 40_000 }).toBeGreaterThanOrEqual(2);
    let pairDistM = 0;
    for (let i = 0; i < 20; i++) {
      const m = await readModels(pageB);
      const self = m.models["live-self"];
      const peer = Object.entries(m.models).find(([k]) => k !== "live-self")?.[1];
      if (self && peer) pairDistM = haversineM(self, peer);
      if (pairDistM > 80) break;
      await pageB.waitForTimeout(800);
    }
    await pauseRide(pageB);

    await pageB.evaluate(() => {
      (window as Window & { __rtwTick?: { follow: (on: boolean) => void } }).__rtwTick?.follow(false);
    });
    const models = await readModels(pageB);
    const positions = Object.values(models.models).filter((p): p is number[] => Array.isArray(p) && p.length >= 2);
    await pageB.evaluate((pts) => {
      const map = (window as unknown as { __RTW_MAP__?: MapboxLike & { fitBounds?: (b: unknown, o: unknown) => void } }).__RTW_MAP__;
      map?.stop?.();
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map?.fitBounds?.(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 180, pitch: 45, duration: 0, maxZoom: 12.5 },
      );
    }, positions);
    await tintRider(pageB);
    await hideChrome(pageB);
    await isolateModelLayer(pageB);
    await setScale(pageB, SCALE_AFTER);
    await pageB.waitForTimeout(2_500);

    const withR = await shotCanvas(pageB);
    await hideRider(pageB, false);
    await pageB.waitForTimeout(800);
    const withoutR = await shotCanvas(pageB);
    await hideRider(pageB, true);
    const pair = await silhouettesForModels(pageB, withR, withoutR, models.models);
    const ids = Object.keys(pair.assigned);
    const separated = ids.length >= 2 && pair.assigned[ids[0]].h !== undefined &&
      Math.hypot(
        (pair.assigned[ids[0]].projected?.x ?? 0) - (pair.assigned[ids[1]].projected?.x ?? 0),
        (pair.assigned[ids[0]].projected?.y ?? 0) - (pair.assigned[ids[1]].projected?.y ?? 0),
      ) > 80;

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOT_DIR, "g2-pair.png"), withR);

    const hSelf = pair.assigned["live-self"];
    const peerId = ids.find((k) => k !== "live-self");
    const hPeer = peerId ? pair.assigned[peerId] : undefined;
    let Hself = { h: 0, converged: false };
    let Hpeer = { h: 0, converged: false };
    if (separated && hSelf && hPeer && peerId) {
      const selfPos = models.models["live-self"] ?? [0, 0];
      const peerPos = models.models[peerId] ?? [0, 0];
      const ySelf = await pngToCssY(pageB, withR, hSelf.bbox.y0);
      const yPeer = await pngToCssY(pageB, withR, hPeer.bbox.y0);
      Hself = await invertWorldHeight(pageB, selfPos, ySelf);
      Hpeer = await invertWorldHeight(pageB, peerPos, yPeer);
    }

    const pairOut = {
      pairDistM,
      separated,
      assigned: pair.assigned,
      Hself,
      Hpeer,
      ratio: Hself.h > 0 && Hpeer.h > 0 ? Hself.h / Hpeer.h : null,
      hash: sha256(withR),
    };
    fs.writeFileSync(path.join(OUT_DIR, "G2-pair.json"), JSON.stringify(pairOut, null, 2));
    console.log(JSON.stringify(pairOut, null, 2));
    await ctxA.close();
    await ctxB.close();
  });
});

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.locator("button.oc-modal__item").first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible().catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
}

async function ensureRiding(page: import("@playwright/test").Page) {
  await dismissRideSummaryIfAny(page);
  if (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false)) return;
  if (await page.getByRole("button", { name: "재개" }).first().isVisible().catch(() => false)) return;
  const start = page.getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
}

async function ensureDockExpanded(page: import("@playwright/test").Page) {
  await ensureRiding(page);
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (!(await fold.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "경로 패널 펼치기" }).click();
  }
  await expect(page.getByRole("slider", { name: "세션 속도 km/h" })).toBeVisible({ timeout: 10_000 });
}

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
}

async function pauseRide(page: import("@playwright/test").Page) {
  const pause = page.getByRole("button", { name: "일시정지" });
  if (await pause.isVisible().catch(() => false)) {
    await pause.click();
    await expect(page.getByRole("button", { name: "재개" }).first()).toBeVisible({ timeout: 10_000 });
  }
}

async function openMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

async function closeMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) return;
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function setRideDistanceM(page: import("@playwright/test").Page, m: number) {
  await openMapSheet(page);
  const slider = page.getByRole("slider", { name: /거리 / });
  await slider.fill(String(m));
  await closeMapSheet(page);
}

async function waitForGlbLayer(page: import("@playwright/test").Page) {
  await expect.poll(async () => readScale(page), { timeout: 45_000 }).not.toBeNull();
}

async function readScale(page: import("@playwright/test").Page) {
  return page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    if (!map?.getLayer?.(layerId)) return null;
    return map.getPaintProperty?.(layerId, "model-scale") ?? null;
  }, LAYER_ID);
}

async function setScale(page: import("@playwright/test").Page, s: number) {
  await page.evaluate(({ layerId, s }) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    map?.setPaintProperty?.(layerId, "model-scale", [s, s, s]);
  }, { layerId: LAYER_ID, s });
}

async function readModels(page: import("@playwright/test").Page) {
  return page.evaluate((sourceId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const src = map?.getSource?.(sourceId) as
      | { _options?: { models?: Record<string, { position?: number[] }> }; _models?: Record<string, { position?: number[] }> }
      | undefined;
    const models = src?._options?.models ?? src?._models ?? {};
    const positions: Record<string, number[] | undefined> = {};
    for (const [k, v] of Object.entries(models as Record<string, { position?: number[] }>)) {
      positions[k] = v?.position;
    }
    return { models: positions };
  }, SOURCE_ID);
}

async function livePos(page: import("@playwright/test").Page) {
  const m = await readModels(page);
  const p = m.models["live-self"] ?? Object.values(m.models)[0];
  if (!p || p.length < 2) throw new Error("no live-self");
  return p;
}

async function readCamera(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const c = map?.getCenter?.();
    const el = map?.getContainer?.();
    return {
      center: { lng: c?.lng ?? 0, lat: c?.lat ?? 0 },
      zoom: map?.getZoom?.() ?? 0,
      pitch: map?.getPitch?.() ?? 0,
      bearing: map?.getBearing?.() ?? 0,
      viewport: { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 },
    };
  });
}

async function applyCamera(
  page: import("@playwright/test").Page,
  cam: { center: { lng: number; lat: number }; zoom: number; pitch: number; bearing: number },
) {
  await page.evaluate((c) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    (window as unknown as { __rtwTick?: { follow: (on: boolean) => void } }).__rtwTick?.follow(false);
    map?.stop?.();
    map?.jumpTo?.({ center: [c.center.lng, c.center.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing });
  }, cam);
}

async function projectedLive(page: import("@playwright/test").Page) {
  const live = await livePos(page);
  return page.evaluate((pos) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const p = map?.project?.({ lng: pos[0], lat: pos[1] });
    return p ? { x: p.x, y: p.y } : null;
  }, live);
}

async function tintRider(page: import("@playwright/test").Page) {
  await page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    try {
      map?.setPaintProperty?.(layerId, "model-color", "#ff2bd6");
      map?.setPaintProperty?.(layerId, "model-color-mix-intensity", 1);
    } catch {
      /* optional */
    }
  }, LAYER_ID);
}

async function hideChrome(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const hide = (sel: string) => {
      document.querySelectorAll(sel).forEach((el) => {
        (el as HTMLElement).style.visibility = "hidden";
      });
    };
    hide(".hud-action");
    hide(".map-hud__scrim");
    hide(".map-view__tick-test");
    hide(".route-dock");
    hide("[class*='route-dock']");
  });
}

async function isolateModelLayer(page: import("@playwright/test").Page) {
  await page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const w = window as Window & { __GIENT_VIS__?: [string, unknown][] };
    w.__GIENT_VIS__ = [];
    for (const l of map?.getStyle?.()?.layers ?? []) {
      if (l.id === layerId) continue;
      try {
        w.__GIENT_VIS__.push([l.id, map?.getLayoutProperty?.(l.id, "visibility")]);
        map?.setLayoutProperty?.(l.id, "visibility", "none");
      } catch {
        /* skip */
      }
    }
    const canvas = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
    if (canvas) canvas.style.background = "#f4f1ea";
  }, LAYER_ID);
}

async function restoreIsolation(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const w = window as Window & { __GIENT_VIS__?: [string, unknown][] };
    for (const [id, vis] of w.__GIENT_VIS__ ?? []) {
      try {
        map?.setLayoutProperty?.(id, "visibility", vis === "none" ? "none" : "visible");
      } catch {
        /* skip */
      }
    }
  });
}

async function hideRider(page: import("@playwright/test").Page, on: boolean) {
  await page.evaluate((on) => {
    (window as Window & { __rtwTick?: { rider: (v: boolean) => void } }).__rtwTick?.rider(on);
  }, on);
}

async function shotCanvas(page: import("@playwright/test").Page) {
  const canvas = page.locator(".mapboxgl-canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

async function waitIdle(page: import("@playwright/test").Page) {
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
        if (!map?.once) {
          setTimeout(res, 1_200);
          return;
        }
        const t = setTimeout(res, 2_500);
        map.once("idle", () => {
          clearTimeout(t);
          res();
        });
      }),
  );
}

async function captureSilhouette(page: import("@playwright/test").Page) {
  await hideChrome(page);
  const withR = await shotCanvas(page);
  await hideRider(page, false);
  await page.waitForTimeout(800);
  const withoutR = await shotCanvas(page);
  await hideRider(page, true);
  await page.waitForTimeout(600);
  const sil = await silhouette(page, withR, withoutR, await projectedLive(page));
  return { withR, sil };
}

async function captureForInvert(page: import("@playwright/test").Page, scale: number, startZoom: number) {
  const live = await livePos(page);
  let zoom = startZoom;
  let last = {
    withR: Buffer.from([]),
    sil: {
      h: 0,
      contactY: 0,
      headY: 0,
      wheelPx: 0,
      ratio: 0,
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0, count: 0 },
      overflow: true,
      cssHeadY: 0,
    },
    pos: live,
    zoom,
  };
  for (let i = 0; i < 8; i++) {
    await setScale(page, scale);
    await applyCamera(page, {
      center: { lng: live[0], lat: live[1] },
      zoom,
      pitch: 50,
      bearing: 90,
    });
    await hideChrome(page);
    await isolateModelLayer(page);
    await tintRider(page);
    await waitIdle(page);
    const cap = await captureSilhouette(page);
    last = { withR: cap.withR, sil: cap.sil, pos: await livePos(page), zoom };
    if (cap.sil.h >= 40 && !cap.sil.overflow && cap.sil.cssHeadY > 2) return last;
    if (cap.sil.overflow || cap.sil.cssHeadY <= 2) zoom -= 0.7;
    else zoom += 0.45;
  }
  return last;
}

async function debugRender(page: import("@playwright/test").Page) {
  return page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const c = map?.getCenter?.();
    const pt = c ? map?.project?.([c.lng, c.lat]) : null;
    let queried: unknown = null;
    try {
      queried = pt ? map?.queryRenderedFeatures?.([pt.x, pt.y], { layers: [layerId] }) : null;
    } catch (e) {
      queried = String(e);
    }
    const n = Array.isArray(queried) ? queried.length : 0;
    return {
      queriedCount: n,
      layerPresent: Boolean(map?.getLayer?.(layerId)),
      zoom: map?.getZoom?.() ?? 0,
    };
  }, LAYER_ID);
}

async function runG9RevertCheck(page: import("@playwright/test").Page) {
  const configPath = path.resolve(OUT_DIR, "../../../apps/web/src/lib/riderPrototype/config.ts");
  const orig = fs.readFileSync(configPath, "utf8");
  const reverted = orig.replace("RIDER_GIANT_SCALE_FACTOR = 400", "RIDER_GIANT_SCALE_FACTOR = 20");
  if (reverted === orig) return { paint: null, note: "replace missed", restored: true };
  fs.writeFileSync(configPath, reverted);
  try {
    await page.waitForTimeout(4_000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await waitForGlbLayer(page);
    const paint = await readScale(page);
    return { paint, note: "factor=20 after reload", restored: true };
  } catch (e) {
    return { paint: null, note: String(e), restored: true };
  } finally {
    fs.writeFileSync(configPath, orig);
  }
}

async function silhouette(
  page: import("@playwright/test").Page,
  withBuf: Buffer,
  withoutBuf: Buffer,
  target: { x: number; y: number } | null,
) {
  return page.evaluate(
    async ({ a, b, target }) => {
      async function load(b64: string) {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("img"));
          img.src = "data:image/png;base64," + b64;
        });
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      }
      const A = await load(a);
      const B = await load(b);
      const w = A.width;
      const h = A.height;
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const d =
          Math.abs(A.data[o] - B.data[o]) +
          Math.abs(A.data[o + 1] - B.data[o + 1]) +
          Math.abs(A.data[o + 2] - B.data[o + 2]);
        mask[i] = d > 12 ? 1 : 0;
      }
      const css = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
      const sx = css ? w / Math.max(1, css.clientWidth) : 1;
      const sy = css ? h / Math.max(1, css.clientHeight) : 1;
      const tx = target ? target.x * sx : w / 2;
      const ty = target ? target.y * sy : h / 2;
      const half = Math.max(24, Math.floor(w * 0.06));
      const yGround = Math.min(h - 1, Math.floor(ty) + 12);
      const xL = Math.max(0, Math.floor(tx) - half);
      const xR = Math.min(w - 1, Math.floor(tx) + half);
      let headY = h;
      let contactY = 0;
      let count = 0;
      let x0 = w;
      let x1 = 0;
      for (let y = 0; y <= yGround; y++) {
        for (let x = xL; x <= xR; x++) {
          if (!mask[y * w + x]) continue;
          count++;
          if (y < headY) headY = y;
          if (y > contactY) contactY = y;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
      const personH = count >= 20 ? contactY - headY + 1 : 0;
      const bandTop = contactY - Math.max(8, Math.floor(personH * 0.22));
      function bandHeight(xa: number, xb: number) {
        let minY = h;
        let maxY = 0;
        let n = 0;
        for (let y = bandTop; y <= contactY; y++) {
          for (let x = xa; x <= xb; x++) {
            if (!mask[y * w + x]) continue;
            n++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        return n > 8 ? maxY - minY + 1 : 0;
      }
      const leftX1 = x0 + Math.floor((x1 - x0) * 0.32);
      const rightX0 = x1 - Math.floor((x1 - x0) * 0.32);
      const wheelPx = Math.max(bandHeight(x0, leftX1), bandHeight(rightX0, x1));
      return {
        h: personH,
        contactY,
        headY: count >= 20 ? headY : 0,
        wheelPx,
        ratio: wheelPx > 0 && personH > 0 ? personH / wheelPx : 0,
        bbox: { x0, y0: headY, x1, y1: contactY, count },
        overflow: count >= 20 && headY <= 1,
        cssHeadY: count >= 20 ? headY / sy : 0,
      };
    },
    { a: withBuf.toString("base64"), b: withoutBuf.toString("base64"), target },
  );
}

/** rideCameraFraming.projectLngLatAltitude 와 같은 식. 파일을 수정하지 않고 측정 하네스에 복제. */
async function invertWorldHeight(
  page: import("@playwright/test").Page,
  lngLat: number[],
  yTopCss: number,
) {
  return page.evaluate(
    ({ lngLat, yTopCss }) => {
      const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
      if (!map || !(yTopCss > 0)) return { h: 0, converged: false, yTopCss, residual: 99, used: "none" };
      const earthCircumference = 2 * Math.PI * 6378137;
      function mercatorFromLngLat(lng: number, lat: number, altitude = 0) {
        const x = (180 + lng) / 360;
        const y =
          (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
        const z = (altitude / earthCircumference) * Math.cos((lat * Math.PI) / 180);
        return {
          x,
          y,
          z,
          meterInMercatorCoordinateUnits() {
            return 1 / earthCircumference / Math.cos((lat * Math.PI) / 180);
          },
        };
      }

      function viewportPxFromMap(m: MapboxLike) {
        const el = m.getContainer?.();
        return { width: Math.max(1, el?.clientWidth || 1), height: Math.max(1, el?.clientHeight || 1) };
      }
      function projectLngLatAltitude(m: MapboxLike, ll: number[], altitudeM: number) {
        const ground = m.project?.({ lng: ll[0], lat: ll[1] }) ?? { x: 0, y: 0 };
        if (!Number.isFinite(ground.x) || !Number.isFinite(ground.y)) return { x: 0, y: 0 };
        if (!(altitudeM > 0)) return { x: ground.x, y: ground.y };
        const cam = m.getFreeCameraOptions?.()?.position;
        const mb = (window as unknown as { mapboxgl?: { MercatorCoordinate?: { fromLngLat: (a: { lng: number; lat: number }, alt: number) => { x: number; y: number; z?: number; meterInMercatorCoordinateUnits?: () => number } } } }).mapboxgl;
        let distM = 0;
        try {
          const foot =
            mb?.MercatorCoordinate?.fromLngLat({ lng: ll[0], lat: ll[1] }, 0) ??
            mercatorFromLngLat(ll[0], ll[1], 0);
          if (cam && foot && typeof foot.meterInMercatorCoordinateUnits === "function") {
            const mPer = foot.meterInMercatorCoordinateUnits();
            if (mPer > 0) {
              const dx = (cam.x - foot.x) / mPer;
              const dy = (cam.y - foot.y) / mPer;
              const dz = ((cam.z ?? 0) - (foot.z ?? 0)) / mPer;
              distM = Math.hypot(dx, dy, dz);
            }
          }
        } catch {
          distM = 0;
        }
        const vp = viewportPxFromMap(m);
        const t = (m as unknown as { transform?: { fov?: number } }).transform;
        const fovDeg = typeof t?.fov === "number" ? t.fov : 36.87;
        const pitchRad = ((m.getPitch?.() ?? 0) * Math.PI) / 180;
        if (distM > 0.05) {
          const f = vp.height / 2 / Math.tan((fovDeg * Math.PI) / 360);
          const dyPx = (altitudeM * Math.sin(pitchRad) * f) / distM;
          const y = ground.y - dyPx;
          if (Number.isFinite(y)) return { x: ground.x, y };
        }
        const latRad = (ll[1] * Math.PI) / 180;
        const mpp = (156543.03392 * Math.cos(latRad)) / Math.pow(2, m.getZoom?.() ?? 1);
        return { x: ground.x, y: ground.y - (altitudeM * Math.sin(pitchRad)) / Math.max(1e-9, mpp) };
      }

      let lo = 0.1;
      let hi = 8000;
      const yLo = projectLngLatAltitude(map, lngLat, lo).y;
      const yHi = projectLngLatAltitude(map, lngLat, hi).y;
      if (Math.abs(yHi - yLo) < 0.5) return { h: 0, converged: false, yTopCss, residual: 99, note: "no y span" };
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        const y = projectLngLatAltitude(map, lngLat, mid).y;
        if (y > yTopCss) lo = mid;
        else hi = mid;
      }
      const h = (lo + hi) / 2;
      const residual = Math.abs(projectLngLatAltitude(map, lngLat, h).y - yTopCss);
      return { h, converged: residual <= 1.5, yTopCss, residual, used: "copied-framing" };
    },
    { lngLat, yTopCss },
  );
}

async function measureRatioAtMinHeight(page: import("@playwright/test").Page, scale: number, minPx: number) {
  await setScale(page, scale);
  const live = await livePos(page);
  let zoom = scale === SCALE_BEFORE ? 20.4 : 15.2;
  let last = { h: 0, wheelPx: 0, ratio: 0, shot: Buffer.from([]), annotated: Buffer.from([]), zoom: 0 };
  for (let i = 0; i < 8; i++) {
    await applyCamera(page, {
      center: { lng: live[0], lat: live[1] },
      zoom,
      pitch: 50,
      bearing: 90,
    });
    await hideChrome(page);
    await isolateModelLayer(page);
    await tintRider(page);
    await page.waitForTimeout(1_200);
    const withR = await shotCanvas(page);
    await hideRider(page, false);
    await page.waitForTimeout(700);
    const withoutR = await shotCanvas(page);
    await hideRider(page, true);
    const sil = await silhouette(page, withR, withoutR, await projectedLive(page));
    last = { h: sil.h, wheelPx: sil.wheelPx, ratio: sil.ratio, shot: withR, annotated: Buffer.from([]), zoom };
    if (sil.h >= minPx && !sil.overflow) {
      last.annotated = await annotateRatio(page, withR, sil);
      return last;
    }
    if (sil.overflow) zoom -= 0.6;
    else zoom += 0.5;
  }
  last.annotated = await annotateRatio(page, last.shot, {
    h: last.h,
    wheelPx: last.wheelPx,
    ratio: last.ratio,
    headY: 20,
    contactY: 20 + last.h,
    bbox: { x0: 20, y0: 20, x1: 120, y1: 20 + last.h },
  });
  return last;
}

async function silhouettesForModels(
  page: import("@playwright/test").Page,
  withBuf: Buffer,
  withoutBuf: Buffer,
  models: Record<string, number[] | undefined>,
) {
  const projected = await page.evaluate((ms) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const out: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of Object.entries(ms)) {
      if (!pos || pos.length < 2) continue;
      const p = map?.project?.({ lng: pos[0], lat: pos[1] });
      if (p) out[id] = { x: p.x, y: p.y };
    }
    return out;
  }, models);
  const components = await page.evaluate(
    async ({ a, b }) => {
      async function load(b64: string) {
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("img"));
          img.src = "data:image/png;base64," + b64;
        });
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
      }
      const A = await load(a);
      const B = await load(b);
      const w = A.width;
      const h = A.height;
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const d =
          Math.abs(A.data[o] - B.data[o]) +
          Math.abs(A.data[o + 1] - B.data[o + 1]) +
          Math.abs(A.data[o + 2] - B.data[o + 2]);
        mask[i] = d > 12 ? 1 : 0;
      }
      const seen = new Uint8Array(w * h);
      const comps: { x0: number; y0: number; x1: number; y1: number; count: number; cx: number; cy: number }[] = [];
      const qx: number[] = [];
      const qy: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i0 = y * w + x;
          if (!mask[i0] || seen[i0]) continue;
          qx.length = 0;
          qy.length = 0;
          qx.push(x);
          qy.push(y);
          seen[i0] = 1;
          let x0 = x;
          let y0 = y;
          let x1 = x;
          let y1 = y;
          let count = 0;
          let sx = 0;
          let sy = 0;
          for (let qi = 0; qi < qx.length; qi++) {
            const cx = qx[qi];
            const cy = qy[qi];
            count++;
            sx += cx;
            sy += cy;
            if (cx < x0) x0 = cx;
            if (cy < y0) y0 = cy;
            if (cx > x1) x1 = cx;
            if (cy > y1) y1 = cy;
            for (const [nx, ny] of [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ]) {
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const ni = ny * w + nx;
              if (!mask[ni] || seen[ni]) continue;
              seen[ni] = 1;
              qx.push(nx);
              qy.push(ny);
            }
          }
          if (count >= 40) comps.push({ x0, y0, x1, y1, count, cx: sx / count, cy: sy / count });
        }
      }
      comps.sort((p, q) => q.count - p.count);
      return comps.slice(0, 6);
    },
    { a: withBuf.toString("base64"), b: withoutBuf.toString("base64") },
  );
  const assigned: Record<string, { h: number; bbox: (typeof components)[0]; projected?: { x: number; y: number } }> = {};
  const used = new Set<number>();
  for (const [id, proj] of Object.entries(projected)) {
    let bestI = -1;
    let bestD = Infinity;
    components.forEach((c, i) => {
      if (used.has(i)) return;
      const d = Math.hypot(c.cx - proj.x, c.cy - proj.y);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI >= 0) {
      used.add(bestI);
      const c = components[bestI];
      assigned[id] = { h: c.y1 - c.y0 + 1, bbox: c, projected: proj };
    }
  }
  return { assigned, components };
}

async function cropAround(
  page: import("@playwright/test").Page,
  buf: Buffer,
  x: number,
  y: number,
  hw: number,
  hh: number,
) {
  const b64 = await page.evaluate(
    async ({ png, x, y, hw, hh }) => {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img"));
        img.src = "data:image/png;base64," + png;
      });
      const x0 = Math.max(0, Math.floor(x - hw));
      const y0 = Math.max(0, Math.floor(y - hh));
      const x1 = Math.min(img.width, Math.ceil(x + hw));
      const y1 = Math.min(img.height, Math.ceil(y + hh));
      const c = document.createElement("canvas");
      c.width = Math.max(1, x1 - x0);
      c.height = Math.max(1, y1 - y0);
      c.getContext("2d")!.drawImage(img, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      return c.toDataURL("image/png").slice("data:image/png;base64,".length);
    },
    { png: buf.toString("base64"), x, y, hw, hh },
  );
  return Buffer.from(b64, "base64");
}

async function measureUi(page: import("@playwright/test").Page) {
  return page.evaluate((layerId) => {
    const nametag = document.querySelector(".map-view__rider-nametag") as HTMLElement | null;
    const hud = document.querySelector(".hud-metrics__cell--hero .hud-metrics__value") as HTMLElement | null;
    const hudFallback = document.querySelector(".hud-metrics__value") as HTMLElement | null;
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    let routeWidthPx = 0;
    try {
      const rw = map?.getPaintProperty?.("route", "line-width");
      routeWidthPx = typeof rw === "number" ? rw : 0;
    } catch {
      routeWidthPx = 0;
    }
    const asNum = (v: unknown): number => {
      if (typeof v === "number" && v > 0) return v;
      if (Array.isArray(v)) {
        const nums = v.filter((x): x is number => typeof x === "number" && x > 0);
        if (nums.length) return nums[nums.length - 1];
      }
      return 0;
    };
    let labelPx = 0;
    let labelLayer = "";
    for (const l of map?.getStyle?.()?.layers ?? []) {
      if (l.type !== "symbol") continue;
      try {
        if (map?.getLayoutProperty?.(l.id, "visibility") === "none") continue;
        const ts = asNum(map?.getLayoutProperty?.(l.id, "text-size"));
        if (ts > 0) {
          labelPx = ts;
          labelLayer = l.id;
          break;
        }
      } catch {
        /* skip */
      }
    }
    return {
      nametagPx: nametag && nametag.style.display !== "none" ? nametag.getBoundingClientRect().height : 0,
      nametagText: nametag?.textContent ?? "",
      hudPx: (hud ?? hudFallback)?.getBoundingClientRect().height ?? 0,
      routeWidthPx,
      labelPx,
      labelLayer,
      layerPresent: Boolean(map?.getLayer?.(layerId)),
    };
  }, LAYER_ID);
}

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function ratioOf(after: unknown, before: unknown) {
  const a = Array.isArray(after) ? Number(after[0]) : NaN;
  const b = Array.isArray(before) ? Number(before[0]) : NaN;
  return b > 0 ? a / b : NaN;
}

async function pngToCssY(page: import("@playwright/test").Page, png: Buffer, yPng: number) {
  return page.evaluate(
    async ({ b64, yPng }) => {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img"));
        img.src = "data:image/png;base64," + b64;
      });
      const canvas = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
      const sy = canvas ? img.height / Math.max(1, canvas.clientHeight) : 1;
      return yPng / sy;
    },
    { b64: png.toString("base64"), yPng },
  );
}

function haversineM(a: number[], b: number[]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function annotateRatio(
  page: import("@playwright/test").Page,
  buf: Buffer,
  sil: {
    h: number;
    wheelPx: number;
    ratio: number;
    headY: number;
    contactY: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  },
) {
  const b64 = await page.evaluate(
    async ({ png, sil }) => {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("img"));
        img.src = "data:image/png;base64," + png;
      });
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = "#ff4d4f";
      ctx.lineWidth = 2;
      const midX = (sil.bbox.x0 + sil.bbox.x1) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, sil.headY);
      ctx.lineTo(midX, sil.contactY);
      ctx.stroke();
      ctx.strokeStyle = "#40a9ff";
      ctx.beginPath();
      ctx.moveTo(sil.bbox.x0, sil.contactY);
      ctx.lineTo(sil.bbox.x1, sil.contactY);
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        `h=${sil.h}px wheel=${sil.wheelPx}px r=${sil.ratio.toFixed(3)}`,
        Math.max(8, sil.bbox.x0),
        Math.max(16, sil.headY - 8),
      );
      return c.toDataURL("image/png").slice("data:image/png;base64,".length);
    },
    { png: buf.toString("base64"), sil },
  );
  return Buffer.from(b64, "base64");
}
