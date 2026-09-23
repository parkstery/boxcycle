/**
 * 지시06 — F5 반증(구현 전) + 줌 비간섭 증거.
 * npm run test:e2e:camera-zoom -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-zoom");
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260922-new_camera/.out/지시06",
);

async function mapZoom(page: Page): Promise<number> {
  const z = await page.evaluate(() => {
    const canvas = document.querySelector(".mapboxgl-canvas");
    const map = (canvas as unknown as { _map?: { getZoom: () => number } } | null)?._map
      ?? (window as unknown as { __RTW_MAP__?: { getZoom: () => number } }).__RTW_MAP__;
    if (map && typeof map.getZoom === "function") return map.getZoom();
    return NaN;
  });
  if (!Number.isFinite(z)) {
    throw new Error(`M0: map.getZoom() 가 유한수가 아님: ${z}`);
  }
  return z;
}

/** Mapbox Map 인스턴스는 앱이 `__RTW_MAP__` 으로 노출 — 아래 waitForFunction 이 기다린다. */

test.describe("지시06 줌 비간섭", () => {
  test.skip(!LIVE, "에뮬레이터 필요");

  test("F5 샘플 + preset→휠→유지→재클릭", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    for (const d of [OUT_DIR, OPS_OUT]) fs.mkdirSync(d, { recursive: true });

    const shot = async (name: string) => {
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ fullPage: false });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, name), buf);
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
    };

    await stubMapboxStyle(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await enterAsGuest(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    // Map 핸들 노출(앱 훅)
    await page.waitForFunction(() => Boolean((window as unknown as { __RTW_MAP__?: unknown }).__RTW_MAP__), null, {
      timeout: 30_000,
    });

    const qc = page.getByRole("group", { name: "Quick Camera" });
    await expect(qc).toBeVisible({ timeout: 15_000 });
    await qc.getByRole("button", { name: /카메라 2/ }).click();
    await page.waitForTimeout(1200);

    const z0 = await mapZoom(page);
    await shot("zoom-t0.png");

    // 사용자 줌 시뮬레이션 — Mapbox zoomstart 에 originalEvent 를 실어 지시06 핸들러를 탄다.
    // (Playwright mouse.wheel 은 이 환경에서 맵 줌을 거의 바꾸지 못함)
    const targetZoom = z0 + 1.2;
    await page.evaluate((tz) => {
      const map = (window as unknown as {
        __RTW_MAP__?: {
          getZoom: () => number;
          jumpTo: (o: { zoom: number }) => void;
          fire: (type: string, e?: { originalEvent?: Event }) => void;
        };
      }).__RTW_MAP__;
      if (!map) throw new Error("no map");
      const oe = new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true });
      map.fire("zoomstart", { originalEvent: oe });
      map.jumpTo({ zoom: tz });
      map.fire("zoomend", { originalEvent: oe });
    }, targetZoom);
    await page.waitForTimeout(500);

    let z_user = await mapZoom(page);
    if (!Number.isFinite(z_user) || Math.abs(z_user - z0) < 0.25) {
      throw new Error(`M0: 사용자 줌 시뮬 실패 z0=${z0} z_user=${z_user}`);
    }

    // ── §3 F5 샘플: 줌 직후 1초간 3회 (비간섭이면 preset 으로 복귀하지 않음)
    const f5: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      f5.push(await mapZoom(page));
      await page.waitForTimeout(333);
    }

    z_user = await mapZoom(page);
    await shot("zoom-user.png");

    await page.waitForTimeout(3000);
    const z3 = await mapZoom(page);
    await shot("zoom-t3s.png");

    await qc.getByRole("button", { name: /카메라 2/ }).click();
    await page.waitForTimeout(1200);
    const z_repress = await mapZoom(page);
    await shot("zoom-repress.png");

    const payload = {
      z0,
      z_user,
      z3,
      z_repress,
      f5_samples: f5,
      f5_mean: f5.reduce((a, b) => a + b, 0) / f5.length,
      abs_z_user_minus_z0: Math.abs(z_user - z0),
      abs_z3_minus_z_user: Math.abs(z3 - z_user),
      abs_z_repress_minus_z0: Math.abs(z_repress - z0),
      method: "map.fire(zoomstart+jumpTo+zoomend) with originalEvent",
    };
    for (const d of [OUT_DIR, OPS_OUT]) {
      fs.writeFileSync(path.join(d, "zoom.json"), JSON.stringify(payload, null, 2));
    }

    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "number" && !Number.isFinite(v)) {
        throw new Error(`M0: ${k}=${v}`);
      }
    }
    expect(Math.abs(z3 - z_user), `|z3-z_user|=${Math.abs(z3 - z_user)}`).toBeLessThan(0.05);
    expect(Math.abs(z_repress - z0), `|z_repress-z0|=${Math.abs(z_repress - z0)}`).toBeLessThan(0.35);
  });
});

async function enterAsGuest(page: Page) {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });
  } catch {
    /* reuse */
  }
}

async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function loadIntroCourse(page: Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.locator("button.oc-modal__item").first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}
