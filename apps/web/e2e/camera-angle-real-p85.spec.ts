/**
 * 지시08 잔여 — pitch 85 그룹만 (페이지 크래시 회피: 짧은 세션).
 * RIDE_VERIFY_LIVE=1 npx playwright test camera-angle-real-p85 --workers=1 --retries=0
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-angle-real");
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260922-new_camera/.out/지시08",
);

const SHOTS = [
  { file: "c-p85-d6.png", distanceM: 6, minZoom: 21.5 },
  { file: "e-p85-d10.png", distanceM: 10, minZoom: 20.5 },
  { file: "f-p85-d20.png", distanceM: 20, minZoom: 19.5 },
] as const;

test.describe("지시08 pitch85 only", () => {
  test.skip(!LIVE, "RIDE_VERIFY_LIVE=1");

  test("c e f", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    for (const d of [OUT_DIR, OPS_OUT]) fs.mkdirSync(d, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 720 });
    await enterAsGuest(page, "/?ridePitch=85");
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
      () => Boolean((window as unknown as { __RTW_MAP__?: unknown }).__RTW_MAP__),
      null,
      { timeout: 30_000 },
    );

    // 3D on (Chief 조건)
    await page.getByRole("button", { name: "맵 뷰 설정" }).click();
    const sheet = page.getByRole("dialog", { name: "맵 뷰" });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    const threeD = sheet.getByRole("checkbox", { name: /3D 뷰/ });
    if (!(await threeD.isChecked())) await threeD.check();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);

    await assertLiveStyle(page);

    const qc = page.getByRole("group", { name: "Quick Camera" });
    await qc.getByRole("button", { name: /카메라 2/ }).click();
    await page.waitForTimeout(1000);

    const notes: unknown[] = [];
    for (const s of SHOTS) {
      await setRideDistanceM(page, s.distanceM);
      await page.waitForFunction(
        ({ zmin }) => {
          const map = (window as unknown as { __RTW_MAP__?: { getZoom: () => number } }).__RTW_MAP__;
          return Boolean(map && map.getZoom() >= zmin);
        },
        { zmin: s.minZoom },
        { timeout: 12_000 },
      );
      await page.waitForTimeout(600);
      const cam = await page.evaluate(() => {
        const map = (window as unknown as {
          __RTW_MAP__?: {
            getPitch: () => number;
            getZoom: () => number;
            getStyle?: () => { name?: string };
            getTerrain?: () => unknown;
          };
        }).__RTW_MAP__;
        return {
          pitch: map?.getPitch() ?? NaN,
          zoom: map?.getZoom() ?? NaN,
          styleName: map?.getStyle?.()?.name ?? null,
          hasTerrain: Boolean(map?.getTerrain?.()),
        };
      });
      if (cam.styleName === "e2e-stub") throw new Error("stub");
      const buf = await page.screenshot({ fullPage: false, timeout: 20_000 });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, s.file), buf);
      await testInfo.attach(s.file, { body: buf, contentType: "image/png" });
      notes.push({ file: s.file, distanceM: s.distanceM, ...cam });
      console.log("[p85]", s.file, cam);
    }

    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).sort();
    const manifest = { outDir: OUT_DIR, opsOut: OPS_OUT, notes, files, stubMapboxStyle: false, enable3D: true };
    for (const d of [OUT_DIR, OPS_OUT]) {
      fs.writeFileSync(path.join(d, "manifest-p85.json"), JSON.stringify(manifest, null, 2));
    }
    expect(files.filter((f) => f.startsWith("c-") || f.startsWith("e-") || f.startsWith("f-")).length).toBe(3);
  });
});

async function assertLiveStyle(page: Page) {
  await page.waitForFunction(() => {
    const map = (window as unknown as {
      __RTW_MAP__?: { getStyle?: () => { name?: string; layers?: unknown[] } };
    }).__RTW_MAP__;
    const style = map?.getStyle?.();
    const attr = document.querySelector(".mapboxgl-ctrl-attrib")?.textContent ?? "";
    return Boolean(style && style.name !== "e2e-stub" && (style.layers?.length ?? 0) >= 5 && /Mapbox/i.test(attr));
  }, null, { timeout: 45_000 });
}

async function setRideDistanceM(page: Page, distanceM: number) {
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  const slider = sheet.getByRole("slider", { name: /거리/ });
  await slider.evaluate((el, want) => {
    const input = el as HTMLInputElement;
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 0.5;
    const snapped = Math.round(Math.min(max, Math.max(min, want)) / step) * step;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, String(snapped));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, distanceM);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden({ timeout: 5_000 });
}

async function enterAsGuest(page: Page, url: string) {
  await page.goto(url);
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });
  } catch {
    /* session */
  }
}

async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
}

async function loadIntroCourse(page: Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.locator("button.oc-modal__item").first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}
