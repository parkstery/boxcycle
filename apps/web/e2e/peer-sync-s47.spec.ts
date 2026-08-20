import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-7 — 카메라 좌측 16.0 m 창에서 경로 위 기지 1 m 두 점을 map.project 로 실측.
 * 제품 코드는 고치지 않는다. 주행 캡처가 아니라 축척만 잰다.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");

test.describe("S4-7 16m scale", () => {
  test.setTimeout(180_000);

  test("leftFlat · 16.0m · 경로 1m 두 점 투영", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?rideCam=16");
    await guestStart(page);
    await loadIntroCourse(page);
    await ensureRiding(page);
    await setFollowLeft(page);
    await setRideDistanceM(page, 16);
    await setSpeedKmh(page, 5);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = window as Window & {
              __RTW_MAP__?: { project?: unknown; isStyleLoaded?: () => boolean };
              __RTW_PEER_SYNC_SELF_DIST_M?: number;
            };
            return (
              typeof w.__RTW_MAP__?.project === "function" &&
              Number.isFinite(w.__RTW_PEER_SYNC_SELF_DIST_M)
            );
          }),
        { timeout: 45_000 },
      )
      .toBe(true);

    await page.waitForTimeout(2500);

    const measured = await page.evaluate(() => {
      type Ll = { lng: number; lat: number };
      const w = window as Window & {
        __RTW_MAP__?: {
          project: (ll: Ll) => { x: number; y: number };
          getSource?: (id: string) => { _data?: unknown; serialize?: () => { data?: unknown } };
          querySourceFeatures?: (id: string) => Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
          getBearing?: () => number;
          getPitch?: () => number;
          getZoom?: () => number;
          getCenter?: () => Ll;
        };
        __RTW_PEER_SYNC_SELF_DIST_M?: number;
      };
      const map = w.__RTW_MAP__;
      if (!map?.project) return { ok: false as const, reason: "no map.project" };

      const coords = readRouteCoords(map);
      if (coords.length < 2) return { ok: false as const, reason: "route coords < 2", coordN: coords.length };

      const dist0 = w.__RTW_PEER_SYNC_SELF_DIST_M ?? 0;
      const spanM = 1;
      const a = pointOnLine(coords, dist0);
      const b = pointOnLine(coords, dist0 + spanM);
      if (!a || !b) return { ok: false as const, reason: "pointOnLine failed", dist0, coordN: coords.length };

      const pa = map.project({ lng: a[0], lat: a[1] });
      const pb = map.project({ lng: b[0], lat: b[1] });
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const pixelSep = Math.hypot(dx, dy);
      const pxPerM = pixelSep / spanM;

      const span3 = 3.2;
      const c = pointOnLine(coords, dist0 + span3);
      let pxPerM_3_2: number | null = null;
      let pc: { x: number; y: number } | null = null;
      if (c) {
        pc = map.project({ lng: c[0], lat: c[1] });
        pxPerM_3_2 = Math.hypot(pc.x - pa.x, pc.y - pa.y) / span3;
      }

      return {
        ok: true as const,
        cameraDistanceM: 16,
        follow: "leftFlat",
        viewport: { width: 1280, height: 900 },
        selfDistM: dist0,
        spanM,
        aLngLat: a,
        bLngLat: b,
        aPx: { x: pa.x, y: pa.y },
        bPx: { x: pb.x, y: pb.y },
        pixelSep,
        pxPerM,
        span3M: span3,
        cPx: pc,
        pxPerM_3_2,
        map: {
          zoom: map.getZoom?.() ?? null,
          pitch: map.getPitch?.() ?? null,
          bearing: map.getBearing?.() ?? null,
          center: map.getCenter?.() ?? null,
        },
        coordN: coords.length,
      };

      function readRouteCoords(m: NonNullable<typeof map>): [number, number][] {
        const src = m.getSource?.("route") as
          | { _data?: unknown; serialize?: () => { data?: unknown } }
          | undefined;
        const fromData = coordsFromUnknown(src?._data ?? src?.serialize?.()?.data);
        if (fromData.length >= 2) return fromData;
        const feats = m.querySourceFeatures?.("route") ?? [];
        for (const f of feats) {
          const g = f.geometry;
          if (g?.type === "LineString" && Array.isArray(g.coordinates)) {
            const c = g.coordinates.filter(
              (p): p is [number, number] => Array.isArray(p) && p.length >= 2,
            );
            if (c.length >= 2) return c;
          }
        }
        return [];
      }

      function coordsFromUnknown(data: unknown): [number, number][] {
        if (!data || typeof data !== "object") return [];
        const d = data as {
          type?: string;
          geometry?: { type?: string; coordinates?: unknown };
          features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
          coordinates?: unknown;
        };
        if (d.type === "FeatureCollection" && Array.isArray(d.features)) {
          for (const f of d.features) {
            const g = f.geometry;
            if (g?.type === "LineString" && Array.isArray(g.coordinates)) {
              const c = g.coordinates.filter(
                (p): p is [number, number] => Array.isArray(p) && p.length >= 2,
              );
              if (c.length >= 2) return c;
            }
          }
        }
        if (d.type === "Feature" && d.geometry?.type === "LineString") {
          const c = Array.isArray(d.geometry.coordinates)
            ? d.geometry.coordinates.filter(
                (p): p is [number, number] => Array.isArray(p) && p.length >= 2,
              )
            : [];
          if (c.length >= 2) return c;
        }
        if (d.type === "LineString" && Array.isArray(d.coordinates)) {
          return d.coordinates.filter(
            (p): p is [number, number] => Array.isArray(p) && p.length >= 2,
          );
        }
        return [];
      }

      function distM(p: [number, number], q: [number, number]): number {
        const R = 6371000;
        const toRad = (x: number) => (x * Math.PI) / 180;
        const dLat = toRad(q[1] - p[1]);
        const dLng = toRad(q[0] - p[0]);
        const a0 =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(p[1])) * Math.cos(toRad(q[1])) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a0)));
      }

      function pointOnLine(line: [number, number][], meters: number): [number, number] | null {
        if (line.length < 2) return null;
        let remain = Math.max(0, meters);
        for (let i = 0; i < line.length - 1; i += 1) {
          const s = line[i]!;
          const e = line[i + 1]!;
          const seg = distM(s, e);
          if (seg <= 1e-6) continue;
          if (remain <= seg) {
            const u = remain / seg;
            return [s[0] + (e[0] - s[0]) * u, s[1] + (e[1] - s[1]) * u];
          }
          remain -= seg;
        }
        return line[line.length - 1] ?? null;
      }
    });

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const shotPath = path.join(OUT_DIR, "S47-scale-16m.png");
    await page.screenshot({ path: shotPath, fullPage: false });

    const out = {
      instruction: "S4-7",
      method:
        "leftFlat · rideCam=16 · 경로 LineString 위 selfDistM 과 +1 m 두 점을 map.project. 40/16 환산 아님.",
      ...measured,
      shot: "S47-scale-16m.png",
      auditorEyeballPxPerM: 91,
      auditorNote: "감리 눈대중 ~91 px/m 는 참고. 본 파일의 pxPerM 이 실측 정본.",
    };
    fs.writeFileSync(path.join(OUT_DIR, "S47-scale-16m.json"), JSON.stringify(out, null, 2));

    expect(measured.ok, measured.ok ? "ok" : measured.reason).toBe(true);
    if (measured.ok) {
      expect(measured.pxPerM).toBeGreaterThan(10);
      expect(measured.pxPerM).toBeLessThan(400);
    }
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
  const n = await items.count();
  await items.nth(Math.max(0, n - 1)).click();
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
  await expect(page.getByRole("slider", { name: "세션 속도 km/h" })).toBeVisible({
    timeout: 10_000,
  });
}

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
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

async function setFollowLeft(page: import("@playwright/test").Page) {
  await openMapSheet(page);
  await page
    .getByRole("dialog", { name: "맵 뷰" })
    .getByRole("button", { name: "좌측", exact: true })
    .click({ force: true });
  await closeMapSheet(page);
}

async function setRideDistanceM(page: import("@playwright/test").Page, m: number) {
  await openMapSheet(page);
  const slider = page.getByRole("slider", { name: /거리 / });
  await slider.fill(String(m));
  await closeMapSheet(page);
}
