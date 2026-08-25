/**
 * G-1 시각 실험 측정 하네스. 제품 코드를 건드리지 않고 DEV 지도에서 실측한다.
 *
 *   GIENT_PHASE=before|after  RTW_DEV_PORT=5010
 *   firebase emulators:exec --only auth,firestore,database --project boxcycle-dc2df --config firebase.json \
 *     "npm run test:e2e -w boxcycle-web -- ../../document/ops/gient-relay/measure.spec.ts --workers=1"
 */
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const PHASE = (process.env.GIENT_PHASE ?? "before") as "before" | "after";
const PAIR = process.env.GIENT_PAIR === "1";
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(OUT_DIR, "shots");
const CAMERA_PATH = path.join(OUT_DIR, "camera.json");
const METRICS_PATH = path.join(OUT_DIR, `metrics-${PHASE}.json`);

const LAYER_ID = "boxcycle-rider-prototype-layer";
const SOURCE_ID = "boxcycle-rider-prototype-source";

type CameraLock = {
  center: { lng: number; lat: number };
  zoom: number;
  pitch: number;
  bearing: number;
  viewport: { width: number; height: number };
};

type Silhouette = {
  h: number;
  contactY: number;
  headY: number;
  wheelPx: number;
  ratio: number;
  bbox: { x0: number; y0: number; x1: number; y1: number; count: number };
  overflow: boolean;
};

test.describe("G-1 gient measure", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요");
  test.describe.configure({ timeout: 240_000 });

  test(`solo G0–G5 (${PHASE})`, async ({ page }) => {
    test.skip(PAIR, "pair 전용 실행");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?tickTest=follow");
    const net: { glb: { url: string; status: number }[]; failed: { url: string; err?: string }[] } = { glb: [], failed: [] };
    page.on("response", (r) => {
      if (r.url().includes(".glb")) net.glb.push({ url: r.url(), status: r.status() });
    });
    page.on("requestfailed", (r) => {
      net.failed.push({ url: r.url(), err: r.failure()?.errorText });
    });
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setSpeedKmh(page, 5);
    await setRideDistanceM(page, 1);
    await pauseRide(page);

    await waitForGlbLayer(page);
    await hideMeasureChrome(page);
    const camera = await lockCamera(page);
    await page.waitForTimeout(2_500);

    const g0 = await readModelScale(page);
    const models = await readModels(page);
    const camNow = await readCamera(page);
    const debug = await debugGlb(page);
    (debug as { net?: unknown }).net = net;

    await hideMeasureChrome(page);
    await isolateModelLayer(page);
    await page.waitForTimeout(800);
    const withRider = await shotCanvas(page);
    await page.evaluate(() => {
      (window as Window & { __rtwTick?: { rider: (on: boolean) => void } }).__rtwTick?.rider(false);
    });
    await page.waitForTimeout(1_200);
    const withoutRider = await shotCanvas(page);
    await page.evaluate(() => {
      (window as Window & { __rtwTick?: { rider: (on: boolean) => void } }).__rtwTick?.rider(true);
    });
    await page.waitForTimeout(1_200);
    await restoreModelIsolation(page);

    const sil = await silhouetteFromDiff(page, withRider, withoutRider, await projectedLive(page));

    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const g1Path = path.join(SHOT_DIR, `g1-${PHASE}.png`);
    fs.writeFileSync(g1Path, withRider);

    const contactCrop = await cropAround(
      page,
      withRider,
      (sil.bbox.x0 + sil.bbox.x1) / 2,
      sil.contactY,
      180,
      110,
    );
    const g4Path = path.join(SHOT_DIR, `g4-contact-${PHASE}.png`);
    fs.writeFileSync(g4Path, contactCrop);

    if (PHASE === "after") {
      const annotated = await annotateRatio(page, withRider, sil);
      fs.writeFileSync(path.join(SHOT_DIR, "g2-ratio.png"), annotated);
      const uiShot = await page.screenshot({ type: "png" });
      fs.writeFileSync(path.join(SHOT_DIR, "g5-ui.png"), uiShot);
    }

    const ui = await measureUi(page);
    const hashes = hashFiles(
      [g1Path, g4Path].concat(
        PHASE === "after"
          ? [path.join(SHOT_DIR, "g2-ratio.png"), path.join(SHOT_DIR, "g5-ui.png")]
          : [],
      ),
    );

    const metrics = {
      phase: PHASE,
      g0,
      models,
      debug,
      camera: camNow,
      cameraLock: camera,
      silhouette: sil,
      ui,
      hashes,
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify(metrics, null, 2));

    expect(g0, "model-scale must be a live array").toBeTruthy();
    expect(sil.h, "silhouette height must be non-zero").toBeGreaterThan(0);
    expect(ui.nametagPx, "nametag px").toBeGreaterThan(0);
    expect(ui.hudPx, "HUD px").toBeGreaterThan(0);
    expect(ui.routeWidthPx, "route width px").toBeGreaterThan(0);
    expect(ui.labelPx, "label px").toBeGreaterThan(0);
  });

  test(`pair G6 (${PHASE})`, async ({ browser }) => {
    test.skip(!PAIR, "GIENT_PAIR=1 일 때만");
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto("/?tickTest=follow");
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);
    await setSpeedKmh(pageA, 5);
    await setRideDistanceM(pageA, 1);
    await pauseRide(pageA);

    await expect.poll(async () => new URL(pageA.url()).searchParams.get("trail"), {
      timeout: 20_000,
    }).not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&tickTest=follow`);
    await guestStart(pageB);
    await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageB);
    await setSpeedKmh(pageB, 5);
    await pauseRide(pageB);

    await waitForGlbLayer(pageB);
    await tintRiderForMeasure(pageB);
    await hideMeasureChrome(pageB);
    await expect.poll(async () => Object.keys((await readModels(pageB)).models).length, {
      timeout: 40_000,
    }).toBeGreaterThanOrEqual(2);

    await frameBothRiders(pageB);
    await pageB.waitForTimeout(2_500);

    const withRider = await shotCanvas(pageB);
    await pageB.evaluate(() => {
      (window as Window & { __rtwTick?: { rider: (on: boolean) => void } }).__rtwTick?.rider(false);
    });
    await pageB.waitForTimeout(1_200);
    const withoutRider = await shotCanvas(pageB);
    await pageB.evaluate(() => {
      (window as Window & { __rtwTick?: { rider: (on: boolean) => void } }).__rtwTick?.rider(true);
    });

    const models = await readModels(pageB);
    const pair = await silhouettesForModels(pageB, withRider, withoutRider, models.models);
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const pairPath = path.join(SHOT_DIR, `g6-pair-${PHASE}.png`);
    fs.writeFileSync(pairPath, withRider);
    if (PHASE === "after") {
      fs.writeFileSync(path.join(SHOT_DIR, "g6-pair.png"), withRider);
    }
    const pairMetrics = {
      phase: PHASE,
      models,
      pair,
      hash: sha256(withRider),
    };
    fs.writeFileSync(path.join(OUT_DIR, `metrics-pair-${PHASE}.json`), JSON.stringify(pairMetrics, null, 2));
    console.log(JSON.stringify(pairMetrics, null, 2));
    expect(Object.keys(pair).length, "self+peer silhouettes").toBeGreaterThanOrEqual(2);
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
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  await items.first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible().catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
  await expect(summary).toBeHidden({ timeout: 10_000 });
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
  await expect.poll(async () => readModelScale(page), { timeout: 45_000 }).not.toBeNull();
}

async function readModelScale(page: import("@playwright/test").Page) {
  return page.evaluate((layerId) => {
    const map = (window as Window & { __RTW_MAP__?: { getLayer: (id: string) => unknown; getPaintProperty: (id: string, p: string) => unknown } }).__RTW_MAP__;
    if (!map?.getLayer(layerId)) return null;
    return map.getPaintProperty(layerId, "model-scale") ?? null;
  }, LAYER_ID);
}

async function readModels(page: import("@playwright/test").Page) {
  return page.evaluate((sourceId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const src = map?.getSource?.(sourceId) as
      | { _options?: { models?: Record<string, { position?: number[] }> }; _models?: Record<string, { position?: number[] }>; serialize?: () => unknown }
      | undefined;
    const models =
      src?._options?.models ??
      src?._models ??
      {};
    const positions: Record<string, number[] | undefined> = {};
    for (const [k, v] of Object.entries(models as Record<string, { position?: number[] }>)) {
      positions[k] = v?.position;
    }
    return { models: positions, sourceKeys: src ? Object.keys(src) : [] };
  }, SOURCE_ID);
}

type MapboxLike = {
  getSource?: (id: string) => unknown;
  getLayer?: (id: string) => unknown;
  getPaintProperty?: (id: string, p: string) => unknown;
  getLayoutProperty?: (id: string, p: string) => unknown;
  getCanvas?: () => HTMLCanvasElement;
  getContainer?: () => HTMLElement;
  project?: (ll: [number, number]) => { x: number; y: number };
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
  getPitch?: () => number;
  getBearing?: () => number;
  stop?: () => void;
  jumpTo?: (o: unknown) => void;
  queryRenderedFeatures?: (pt: unknown, o?: unknown) => unknown[];
  getStyle?: () => { layers?: { id: string; type: string }[] };
  setLayoutProperty?: (id: string, p: string, v: unknown) => void;
};

async function readCamera(page: import("@playwright/test").Page): Promise<CameraLock> {
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

async function lockCamera(page: import("@playwright/test").Page): Promise<CameraLock> {
  if (PHASE === "after" && fs.existsSync(CAMERA_PATH)) {
    const saved = JSON.parse(fs.readFileSync(CAMERA_PATH, "utf8")) as CameraLock;
    await applyCamera(page, saved);
    await tintRiderForMeasure(page);
    await hideMeasureChrome(page);
    await page.waitForTimeout(2_000);
    return saved;
  }

  const models = await readModels(page);
  const live = models.models["live-self"] ?? Object.values(models.models)[0];
  if (!live || live.length < 2) throw new Error("no live-self position");

  const candidate: CameraLock = {
    center: { lng: live[0], lat: live[1] },
    zoom: 19.0,
    pitch: 50,
    bearing: 90,
    viewport: { width: 1280, height: 900 },
  };
  await applyCamera(page, candidate);
  await tintRiderForMeasure(page);
  await hideMeasureChrome(page);
  await page.waitForTimeout(4_000);
  const locked = await readCamera(page);
  fs.writeFileSync(CAMERA_PATH, JSON.stringify(locked, null, 2));
  return locked;
}

async function tintRiderForMeasure(page: import("@playwright/test").Page) {
  await page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike & { setPaintProperty?: (id: string, p: string, v: unknown) => void } }).__RTW_MAP__;
    try {
      map?.setPaintProperty?.(layerId, "model-color", "#ff2bd6");
      map?.setPaintProperty?.(layerId, "model-color-mix-intensity", 1);
    } catch {
      /* paint prop 없으면 무시 — 실측만 실패할 수 있음 */
    }
  }, LAYER_ID);
}

async function applyCamera(page: import("@playwright/test").Page, cam: CameraLock) {
  await page.evaluate((c) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike; __rtwTick?: { follow: (on: boolean) => void } }).__RTW_MAP__;
    (window as unknown as { __rtwTick?: { follow: (on: boolean) => void } }).__rtwTick?.follow(false);
    map?.stop?.();
    map?.jumpTo?.({
      center: [c.center.lng, c.center.lat],
      zoom: c.zoom,
      pitch: c.pitch,
      bearing: c.bearing,
    });
  }, cam);
}

async function readSelfHeading(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    return map?.getBearing?.() ?? 0;
  });
}

async function frameBothRiders(page: import("@playwright/test").Page) {
  const models = await readModels(page);
  const positions = Object.values(models.models).filter((p): p is number[] => Array.isArray(p) && p.length >= 2);
  if (positions.length < 2) return;
  await page.evaluate((pts) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike & { fitBounds?: (b: unknown, o: unknown) => void } }).__RTW_MAP__;
    (window as unknown as { __rtwTick?: { follow: (on: boolean) => void } }).__rtwTick?.follow(false);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    map?.stop?.();
    map?.fitBounds?.(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 160, pitch: 45, duration: 0, maxZoom: 17.2 },
    );
  }, positions);
}

async function debugGlb(page: import("@playwright/test").Page) {
  return page.evaluate(async (ids) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const src = map?.getSource?.(ids.sourceId) as {
      _modelsInfo?: unknown;
      models?: unknown;
    } | undefined;
    const serializeUnknown = (v: unknown, depth = 0): unknown => {
      if (depth > 4) return "[depth]";
      if (v == null) return v;
      if (v instanceof Map) {
        const o: Record<string, unknown> = { __map: true };
        for (const [k, val] of v.entries()) o[String(k)] = serializeUnknown(val, depth + 1);
        return o;
      }
      if (typeof v !== "object") return v;
      if (Array.isArray(v)) return v.slice(0, 12).map((x) => serializeUnknown(x, depth + 1));
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).slice(0, 24)) {
        try {
          o[k] = serializeUnknown((v as Record<string, unknown>)[k], depth + 1);
        } catch {
          o[k] = "[unserializable]";
        }
      }
      return o;
    };
    let glb: { status: number; bytes: number } | null = null;
    try {
      const r = await fetch("/rider/prototype/rider-lowpoly.glb");
      glb = { status: r.status, bytes: (await r.arrayBuffer()).byteLength };
    } catch {
      glb = { status: -1, bytes: 0 };
    }
    let vis: unknown = null;
    let color: unknown = null;
    try {
      vis = map?.getLayoutProperty?.(ids.layerId, "visibility");
    } catch {
      vis = "err";
    }
    try {
      color = map?.getPaintProperty?.(ids.layerId, "model-color");
    } catch {
      color = "err";
    }
    let queried: unknown = null;
    try {
      const c = map?.getCenter?.();
      const pt = c ? map?.project?.([c.lng, c.lat]) : null;
      queried = pt ? map?.queryRenderedFeatures?.([pt.x, pt.y], { layers: [ids.layerId] }) : null;
    } catch (e) {
      queried = String(e);
    }
    return {
      vis,
      color,
      modelsInfo: serializeUnknown(src?._modelsInfo),
      sourceModels: serializeUnknown(src?.models),
      queried,
      glb,
    };
  }, { sourceId: SOURCE_ID, layerId: LAYER_ID });
}

async function isolateModelLayer(page: import("@playwright/test").Page) {
  await page.evaluate((layerId) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const layers = map?.getStyle?.()?.layers ?? [];
    const w = window as Window & { __GIENT_VIS__?: [string, unknown][] };
    w.__GIENT_VIS__ = [];
    for (const l of layers) {
      if (l.id === layerId) continue;
      try {
        const vis = map?.getLayoutProperty?.(l.id, "visibility");
        w.__GIENT_VIS__.push([l.id, vis]);
        map?.setLayoutProperty?.(l.id, "visibility", "none");
      } catch {
        /* some layers reject visibility */
      }
    }
    const canvas = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
    if (canvas) canvas.style.background = "#f4f1ea";
    const mapEl = document.querySelector(".mapboxgl-map") as HTMLElement | null;
    if (mapEl) mapEl.style.background = "#f4f1ea";
  }, LAYER_ID);
}

async function restoreModelIsolation(page: import("@playwright/test").Page) {
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

async function hideMeasureChrome(page: import("@playwright/test").Page) {
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

async function shotCanvas(page: import("@playwright/test").Page) {
  const canvas = page.locator(".mapboxgl-canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  return page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

async function canvasSize(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const c = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
    return { w: c?.width ?? 0, h: c?.height ?? 0 };
  });
}

async function projectedLive(page: import("@playwright/test").Page) {
  const models = await readModels(page);
  const live = models.models["live-self"] ?? Object.values(models.models)[0];
  if (!live || live.length < 2) return null;
  return page.evaluate((pos) => {
    const map = (window as unknown as { __RTW_MAP__?: MapboxLike }).__RTW_MAP__;
    const p = map?.project?.([pos[0], pos[1]]);
    return p ? { x: p.x, y: p.y } : null;
  }, live);
}

async function silhouetteFromDiff(
  page: import("@playwright/test").Page,
  withBuf: Buffer,
  withoutBuf: Buffer,
  target: { x: number; y: number } | null = null,
): Promise<Silhouette> {
  const result = await page.evaluate(
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
      const thresh = 12;
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const d =
          Math.abs(A.data[o] - B.data[o]) +
          Math.abs(A.data[o + 1] - B.data[o + 1]) +
          Math.abs(A.data[o + 2] - B.data[o + 2]);
        mask[i] = d > thresh ? 1 : 0;
      }
      const css = document.querySelector(".mapboxgl-canvas") as HTMLCanvasElement | null;
      const sx = css ? w / Math.max(1, css.clientWidth) : 1;
      const sy = css ? h / Math.max(1, css.clientHeight) : 1;
      const tx = target ? target.x * sx : w / 2;
      const ty = target ? target.y * sy : h / 2;
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
          let sxsum = 0;
          let sysum = 0;
          for (let qi = 0; qi < qx.length; qi++) {
            const cx = qx[qi];
            const cy = qy[qi];
            count++;
            sxsum += cx;
            sysum += cy;
            if (cx < x0) x0 = cx;
            if (cy < y0) y0 = cy;
            if (cx > x1) x1 = cx;
            if (cy > y1) y1 = cy;
            const nbs = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];
            for (const [nx, ny] of nbs) {
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const ni = ny * w + nx;
              if (!mask[ni] || seen[ni]) continue;
              seen[ni] = 1;
              qx.push(nx);
              qy.push(ny);
            }
          }
          if (count >= 40) comps.push({ x0, y0, x1, y1, count, cx: sxsum / count, cy: sysum / count });
        }
      }
      comps.sort((p, q) => Math.hypot(p.cx - tx, p.cy - ty) - Math.hypot(q.cx - tx, q.cy - ty));
      const half = Math.max(18, Math.floor(w * 0.045));
      const yGround = Math.min(h - 1, Math.floor(ty) + 10);
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
      if (count < 20) {
        return {
          h: 0,
          contactY: ty,
          headY: 0,
          wheelPx: 0,
          ratio: 0,
          bbox: { x0: 0, y0: 0, x1: 0, y1: 0, count },
          overflow: false,
        };
      }
      const y0 = headY;
      const y1 = contactY;
      const personH = contactY - headY + 1;
      const bandTop = y1 - Math.max(8, Math.floor(personH * 0.22));
      const leftX1 = x0 + Math.floor((x1 - x0) * 0.32);
      const rightX0 = x1 - Math.floor((x1 - x0) * 0.32);
      function bandHeight(xa: number, xb: number) {
        let minY = h;
        let maxY = 0;
        let n = 0;
        for (let y = bandTop; y <= y1; y++) {
          for (let x = xa; x <= xb; x++) {
            if (!mask[y * w + x]) continue;
            n++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        return n > 8 ? maxY - minY + 1 : 0;
      }
      const wheelPx = Math.max(bandHeight(x0, leftX1), bandHeight(rightX0, x1));
      const overflow = y0 <= 1 || y1 >= h - 2;
      return {
        h: personH,
        contactY: y1,
        headY: y0,
        wheelPx,
        ratio: wheelPx > 0 ? personH / wheelPx : 0,
        bbox: { x0, y0, x1, y1, count },
        overflow,
      };
    },
    { a: withBuf.toString("base64"), b: withoutBuf.toString("base64"), target },
  );
  return result as Silhouette;
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
      const p = map?.project?.([pos[0], pos[1]]);
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
        mask[i] = d > 28 ? 1 : 0;
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
            const nbs = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];
            for (const [nx, ny] of nbs) {
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
      return comps.slice(0, 4);
    },
    { a: withBuf.toString("base64"), b: withoutBuf.toString("base64") },
  );

  const assigned: Record<string, { h: number; bbox: unknown; projected?: { x: number; y: number } }> = {};
  for (const [id, proj] of Object.entries(projected)) {
    let best: (typeof components)[0] | null = null;
    let bestD = Infinity;
    for (const c of components) {
      const d = Math.hypot(c.cx - proj.x, c.cy - proj.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      assigned[id] = { h: best.y1 - best.y0 + 1, bbox: best, projected: proj };
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
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      return c.toDataURL("image/png").slice("data:image/png;base64,".length);
    },
    { png: buf.toString("base64"), x, y, hw, hh },
  );
  return Buffer.from(b64, "base64");
}

async function annotateRatio(page: import("@playwright/test").Page, buf: Buffer, sil: Silhouette) {
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
      ctx.beginPath();
      const midX = (sil.bbox.x0 + sil.bbox.x1) / 2;
      ctx.moveTo(midX, sil.headY);
      ctx.lineTo(midX, sil.contactY);
      ctx.stroke();
      ctx.strokeStyle = "#40a9ff";
      ctx.beginPath();
      ctx.moveTo(sil.bbox.x0, sil.contactY);
      ctx.lineTo(sil.bbox.x1, sil.contactY);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.fillText(`h=${sil.h}px wheel=${sil.wheelPx}px r=${sil.ratio.toFixed(3)}`, sil.bbox.x0, Math.max(16, sil.headY - 8));
      return c.toDataURL("image/png").slice("data:image/png;base64,".length);
    },
    { png: buf.toString("base64"), sil },
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
    const layers = map?.getStyle?.()?.layers ?? [];
    let labelPx = 0;
    let labelLayer = "";
    for (const l of layers) {
      if (l.type !== "symbol") continue;
      try {
        const vis = map?.getLayoutProperty?.(l.id, "visibility");
        if (vis === "none") continue;
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
    const nametagPx = nametag && nametag.style.display !== "none" ? nametag.getBoundingClientRect().height : 0;
    const hudEl = hud ?? hudFallback;
    const hudPx = hudEl ? hudEl.getBoundingClientRect().height : 0;
    return {
      nametagPx,
      nametagText: nametag?.textContent ?? "",
      hudPx,
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

function hashFiles(paths: string[]) {
  const out: Record<string, string> = {};
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    out[path.basename(p)] = sha256(fs.readFileSync(p));
  }
  return out;
}
