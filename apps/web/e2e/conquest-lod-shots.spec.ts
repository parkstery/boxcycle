import { test, expect } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 줌아웃 LOD — 「내 도로망」 집계 광채의 육안 검증 샷.
 *
 * 실제 주행 데이터 없이 conquest traces 소스에 합성 도로망을 주입하고 줌 단계별로 찍는다.
 * 인증·에뮬레이터가 필요 없다(소스·레이어는 데이터가 비어도 mapLoaded 시점에 생성된다).
 *
 * 실행: npx playwright test conquest-lod-shots --workers=1
 * 산출: apps/web/.out/conquest-lod/z{n}-{before|after}.png
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/conquest-lod");
const LABEL = process.env.LOD_SHOT_LABEL ?? "after";
const ZOOMS = [5, 8, 11, 14];
/** 화면 중앙 부분 확대 크롭 — 원거리에서의 차이를 육안으로 판정하기 위함 */
const CROP = { x: 480, y: 300, width: 320, height: 320 };

/**
 * 합성 「내 도로망」 — 실제 누적을 닮게 만든다: 서로 떨어진 주행 3건(각 8~11km).
 * 촘촘한 격자를 쓰면 이미 덩어리로 보여 LOD 의 효과를 가린다 — 성긴 실주행이 진짜 문제 사례다.
 */
function syntheticNetwork() {
  const lines: number[][][] = [];
  const meander = (
    lng0: number,
    lat0: number,
    dLng: number,
    dLat: number,
    wobble: number,
  ): number[][] => {
    const pts: number[][] = [];
    for (let i = 0; i <= 60; i += 1) {
      const t = i / 60;
      pts.push([
        lng0 + dLng * t + Math.sin(t * 9) * wobble,
        lat0 + dLat * t + Math.cos(t * 7) * wobble * 0.6,
      ]);
    }
    return pts;
  };
  // 주행 1 — 한강 서쪽으로 약 11km
  lines.push(meander(126.80, 37.552, 0.125, 0.004, 0.0016));
  // 주행 2 — 북쪽으로 4km 떨어진 곳에서 약 8km
  lines.push(meander(126.845, 37.60, 0.09, -0.012, 0.0013));
  // 주행 3 — 남동 대각선 약 9km
  lines.push(meander(126.89, 37.515, 0.06, 0.055, 0.0011));
  return lines;
}

test.describe("Conquest 줌아웃 LOD 샷", () => {
  test("zoom ladder", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    // 소스·레이어는 mapLoaded 이후 effect 에서 만들어진다 — 존재할 때까지 기다린다.
    await page.waitForFunction(
      () => {
        const map = (
          window as unknown as {
            __RTW_MAP__?: { getSource: (id: string) => unknown };
          }
        ).__RTW_MAP__;
        if (!map) return false;
        try {
          return Boolean(map.getSource("boxcycle-conquest-traces"));
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 90_000 },
    );

    // 시작 게이트가 지도를 가리면 시각 판정이 불가능하다 — 오버레이만 숨긴다.
    await page.addStyleTag({
      content: '[role="dialog"], .modal-backdrop { display: none !important; }',
    });

    const diag: Array<Record<string, number>> = [];
    const injected = await page.evaluate(
      ({ lines }) => {
        const map = (
          window as unknown as {
            __RTW_MAP__?: {
              getSource: (id: string) => { setData?: (d: unknown) => void } | undefined;
              getLayer: (id: string) => unknown;
            };
          }
        ).__RTW_MAP__;
        if (!map) return { ok: false, halo: false, line: false };
        const src = map.getSource("boxcycle-conquest-traces");
        src?.setData?.({
          type: "FeatureCollection",
          features: lines.map((coordinates) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          })),
        });
        return {
          ok: Boolean(src),
          halo: Boolean(map.getLayer("boxcycle-conquest-traces-halo")),
          line: Boolean(map.getLayer("boxcycle-conquest-traces-line")),
        };
      },
      { lines: syntheticNetwork() },
    );

    expect(injected.ok, "conquest traces 소스 존재").toBe(true);
    expect(injected.line, "누적 궤적 레이어 존재").toBe(true);
    expect(injected.halo, "LOD 광채 레이어 존재").toBe(true);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const zoom of ZOOMS) {
      await page.evaluate(
        ({ zoom }) => {
          const map = (
            window as unknown as { __RTW_MAP__?: { jumpTo: (o: unknown) => void } }
          ).__RTW_MAP__;
          map?.jumpTo({ center: [126.862, 37.578], zoom, pitch: 0, bearing: 0 });
        },
        { zoom },
      );
      await page.waitForTimeout(2_000);
      // 앱 effect 가 style.load 마다 빈 FC 로 되돌리므로 촬영 직전에 다시 넣는다.
      await injectTraces(page);
      await page.waitForTimeout(1_500);
      const rendered = await page.evaluate(() => {
        const map = (
          window as unknown as {
            __RTW_MAP__?: {
              queryRenderedFeatures: (o: unknown, f: unknown) => unknown[];
              getSource: (id: string) => { _data?: { features?: unknown[] } } | undefined;
            };
          }
        ).__RTW_MAP__;
        const src = map?.getSource("boxcycle-conquest-traces");
        let halo = -1;
        let line = -1;
        try {
          halo = map?.queryRenderedFeatures(undefined, {
            layers: ["boxcycle-conquest-traces-halo"],
          }).length ?? -1;
          line = map?.queryRenderedFeatures(undefined, {
            layers: ["boxcycle-conquest-traces-line"],
          }).length ?? -1;
        } catch {
          /* noop */
        }
        return { srcFeatures: src?._data?.features?.length ?? -1, halo, line };
      });
      diag.push({ zoom, ...rendered });
      // before = LOD 광채를 끈 상태(종전 동작), after = 켠 상태. 같은 데이터·같은 서버로 대조한다.
      await setHaloVisible(page, false);
      await injectTraces(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT_DIR, `z${zoom}-before.png`) });
      await page.screenshot({ path: path.join(OUT_DIR, `z${zoom}-before-crop.png`), clip: CROP });
      await setHaloVisible(page, true);
      await injectTraces(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT_DIR, `z${zoom}-${LABEL}.png`) });
      await page.screenshot({ path: path.join(OUT_DIR, `z${zoom}-${LABEL}-crop.png`), clip: CROP });
    }
    fs.writeFileSync(path.join(OUT_DIR, "diag.json"), JSON.stringify(diag, null, 2));
    for (const d of diag) {
      expect(d.srcFeatures, `z${d.zoom} 소스 feature`).toBeGreaterThan(0);
    }
  });
});

async function setHaloVisible(page: import("@playwright/test").Page, visible: boolean) {
  await page.evaluate(
    ({ visible }) => {
      const map = (
        window as unknown as {
          __RTW_MAP__?: { setLayoutProperty: (id: string, k: string, v: string) => void };
        }
      ).__RTW_MAP__;
      map?.setLayoutProperty(
        "boxcycle-conquest-traces-halo",
        "visibility",
        visible ? "visible" : "none",
      );
    },
    { visible },
  );
}

async function injectTraces(page: import("@playwright/test").Page) {
  await page.evaluate(
    ({ lines }) => {
      const map = (
        window as unknown as {
          __RTW_MAP__?: { getSource: (id: string) => { setData?: (d: unknown) => void } | undefined };
        }
      ).__RTW_MAP__;
      map?.getSource("boxcycle-conquest-traces")?.setData?.({
        type: "FeatureCollection",
        features: lines.map((coordinates) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        })),
      });
    },
    { lines: syntheticNetwork() },
  );
}
