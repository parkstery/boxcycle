import { test, expect } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  projectRouteMinimap,
  routeMinimapStaticImageUrl,
} from "../src/features/map-overlays/routeMinimapProjection";
import type { LngLat } from "../src/lib/geo/geo";

/**
 * 미니맵 배경 정지 지도(보류01, 2026-10-07).
 *   1) 정합 — Static API 핀 끝점 ↔ 우리 투영 점이 2px 이내(에뮬레이터 불필요, 실 Mapbox 호출)
 *   2) 주행 캡처 — 740×300 원본·3배 확대, 주행 중 재요청 0회 (에뮬레이터 필요)
 *   3) 폴백 — 정지 지도 요청 실패 시 어두운 배경, 깨진 이미지 없음 (에뮬레이터 필요)
 *
 * 실행(apps/web): node scripts/e2e/run-with-functions-emulator.mjs "npx playwright test minimap-map-shots --workers=1 --retries=0"
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/minimap-map");
const STATIC_GLOB = "https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/**";

function readMapboxToken(): string {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(__dirname, "..", f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^VITE_MAPBOX_ACCESS_TOKEN=(.+)$/m);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return process.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
}

test.describe("미니맵 정지 지도", () => {
  test("Static 기준 표식과 투영 점이 2px 안에서 겹친다", async ({ page }) => {
    const token = readMapboxToken();
    test.skip(!token, "Mapbox 토큰 없음");
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 원주 단구동 둘레 ~4km — 시점(남서)·중간(북)·종점(동)이 서로 떨어진 합성 경로
    const points: Record<string, LngLat> = {
      start: [127.921, 37.309],
      mid: [127.936, 37.334],
      end: [127.958, 37.318],
    };
    const W = 218;
    const H = 88; // 740×300 실측 미니맵 상자와 같은 크기대
    const layout = projectRouteMinimap(
      { type: "LineString", coordinates: [points.start!, points.mid!, points.end!] },
      W,
      H,
    );
    expect(layout).not.toBeNull();
    const base = routeMinimapStaticImageUrl(layout!, W, H, token)!;

    /*
     * 기준 표식 — 좌표 둘레 ±0.0012° 정사각형(마젠타)을 같은 center·zoom 이미지에 얹고 무게중심을 잰다.
     * pin-s 핀은 쓰지 않는다: 핀 끝이 실제 앵커(그림자 중심)보다 ~3px 위에 그려져 y 를 속인다(실측).
     * 캡처 전용 — 제품 코드에 없다.
     */
    const markerUrl = ([lng, lat]: LngLat) => {
      const d = 0.0012;
      const gj = {
        type: "Feature",
        properties: { fill: "#ff00ff", "fill-opacity": 1, stroke: "#ff00ff", "stroke-width": 0 },
        geometry: {
          type: "Polygon",
          coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]],
        },
      };
      return base.replace("/static/", `/static/geojson(${encodeURIComponent(JSON.stringify(gj))})/`);
    };

    await page.goto("about:blank");
    const report: Record<string, number> = {};
    for (const [key, ll] of Object.entries(points)) {
      const found = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (!res.ok) return { error: `${res.status} ${await res.text()}` };
        const bmp = await createImageBitmap(await res.blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let y = 0; y < bmp.height; y++) {
          for (let x = 0; x < bmp.width; x++) {
            const i = (y * bmp.width + x) * 4;
            if (data[i]! > 220 && data[i + 1]! < 40 && data[i + 2]! > 220) {
              sx += x + 0.5;
              sy += y + 0.5;
              n += 1;
            }
          }
        }
        return { w: bmp.width, n, x: n ? sx / n : NaN, y: n ? sy / n : NaN };
      }, markerUrl(ll));
      expect("error" in found ? found.error : null, `${key} 기준 표식 요청`).toBeNull();
      const f = found as { w: number; n: number; x: number; y: number };
      expect(f.n, `${key} 기준 표식 픽셀`).toBeGreaterThan(4);
      const ratio = f.w / W; // @2x
      const ours = layout!.project(ll);
      const d = Math.hypot(f.x / ratio - ours.x, f.y / ratio - ours.y);
      report[key] = Math.round(d * 100) / 100;
    }
    console.log(
      `[minimap-align] center=${layout!.center.join(",")} zoom=${layout!.zoom} px=${JSON.stringify(report)}`,
    );
    for (const d of Object.values(report)) expect(d).toBeLessThanOrEqual(2);

    // 03-align-markers.png — 시점 표식 이미지 위에 우리 경로·점을 겹쳐 그린 검산 캡처(3배)
    const ours = Object.values(points).map((ll) => layout!.project(ll));
    const shotUrl = markerUrl(points.start!);
    await page.setViewportSize({ width: W * 3, height: H * 3 });
    await page.setContent(`<body style="margin:0"><div style="position:relative;width:${W}px;height:${H}px;transform:scale(3);transform-origin:0 0">
      <img src="${shotUrl}" width="${W}" height="${H}" style="position:absolute;inset:0">
      <svg width="${W}" height="${H}" style="position:absolute;inset:0">
        <path d="${layout!.pathD}" stroke="#ef4444" stroke-width="1" fill="none"/>
        ${ours
          .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="1.2" fill="none" stroke="#000" stroke-width="0.5"/>`)
          .join("")}
      </svg></div></body>`);
    await page.locator("img").evaluate((img: HTMLImageElement) => img.decode());
    await page.screenshot({ path: path.join(OUT_DIR, "03-align-markers.png") });
  });

  test("주행 중 미니맵에 Outdoors 지도가 깔리고 다시 받지 않는다", async ({ page }) => {
    test.skip(!LIVE, "Firebase 에뮬레이터 필요");
    test.setTimeout(120_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    // performance resource 버퍼(기본 250건)는 지도 타일로 금방 차서 0 을 센다 — 요청을 직접 센다
    const staticUrls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/outdoors-v12/static/")) staticUrls.push(r.url());
    });
    await page.setViewportSize({ width: 740, height: 300 });
    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page);
    await startRide(page);

    const map = page.locator(".route-minimap__map");
    await expect(map).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => map.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), {
        timeout: 15_000,
      })
      .toBe(true);
    const first = staticUrls.length;
    await page.waitForTimeout(6_000); // 주행이 진행되는 동안 현재 위치만 움직여야 한다
    const after = staticUrls.length;
    const distinct = new Set(staticUrls).size;
    // 바이트는 재요청을 센 뒤에 잰다 — 이 fetch 자체가 요청 1건이다
    const bytes = await map.evaluate(async (img: HTMLImageElement) => (await (await fetch(img.src)).blob()).size);
    const box = await page.locator(".route-minimap").boundingBox();
    console.log(`[minimap-live] staticRequests first=${first} after6s=${after} distinct=${distinct} bytes=${bytes} box=${JSON.stringify(box)}`);
    expect(first, "정지 지도 요청이 있어야 한다").toBeGreaterThanOrEqual(1);
    expect(after, "주행 중 재요청 없음").toBe(first);

    await page.screenshot({ path: path.join(OUT_DIR, "01-outdoors-740x300.png") });
    // 3배 확대 — 미니맵 영역만 잘라 픽셀 그대로 3배로 다시 찍는다
    const clip = box!;
    const crop = await page.screenshot({
      clip: { x: clip.x - 4, y: clip.y - 4, width: clip.width + 8, height: clip.height + 8 },
    });
    const zoom = await page.context().newPage();
    const zw = Math.ceil((clip.width + 8) * 3);
    const zh = Math.ceil((clip.height + 8) * 3);
    await zoom.setViewportSize({ width: zw, height: zh });
    await zoom.setContent(
      `<body style="margin:0"><img src="data:image/png;base64,${crop.toString("base64")}" style="width:${zw}px;height:${zh}px;image-rendering:pixelated"></body>`,
    );
    await zoom.screenshot({ path: path.join(OUT_DIR, "02-outdoors-zoom.png") });
    await zoom.close();
  });

  test("정지 지도가 실패하면 어두운 배경으로 남는다", async ({ page }) => {
    test.skip(!LIVE, "Firebase 에뮬레이터 필요");
    test.setTimeout(120_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.route(STATIC_GLOB, (route) => route.abort());
    await page.setViewportSize({ width: 740, height: 300 });
    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page);
    await startRide(page);

    const mm = page.locator(".route-minimap");
    await expect(mm).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".route-minimap__map")).toHaveCount(0, { timeout: 15_000 });
    await expect(mm).not.toHaveClass(/route-minimap--map/);
    await expect(page.locator(".route-minimap__path")).toHaveCount(1);
    await page.screenshot({ path: path.join(OUT_DIR, "05-fallback-no-map.png") });
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
  await items.nth(Math.max(0, (await items.count()) - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function startRide(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "주행 시작" }).click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 30_000 });
}
