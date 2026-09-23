/**
 * 지시07 — 각도(지평선) 후보 6장 + QC1 3단.
 * npm run test:e2e:camera-angle -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-angle");
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260922-new_camera/.out/지시07",
);

type AngleShot = { file: string; pitch: number; distanceM: number };

const ANGLE_BY_PITCH: Record<number, AngleShot[]> = {
  75: [{ file: "a-p75-d6.png", pitch: 75, distanceM: 6 }],
  80: [
    { file: "b-p80-d6.png", pitch: 80, distanceM: 6 },
    { file: "d-p80-d10.png", pitch: 80, distanceM: 10 },
  ],
  85: [
    { file: "c-p85-d6.png", pitch: 85, distanceM: 6 },
    { file: "e-p85-d10.png", pitch: 85, distanceM: 10 },
    { file: "f-p85-d20.png", pitch: 85, distanceM: 20 },
  ],
};

test.describe("지시07 각도 후보 · QC1 3단", () => {
  test.skip(!LIVE, "에뮬레이터 필요");

  test("angle a–f + qc1 3단", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    for (const d of [OUT_DIR, OPS_OUT]) fs.mkdirSync(d, { recursive: true });

    const notes: Array<Record<string, unknown>> = [];

    const shot = async (name: string) => {
      await page.waitForTimeout(700);
      const buf = await page.screenshot({ fullPage: false });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, name), buf);
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
    };

    const readCam = async () =>
      page.evaluate(() => {
        const map = (window as unknown as {
          __RTW_MAP__?: { getPitch: () => number; getZoom: () => number };
        }).__RTW_MAP__;
        if (!map) return { pitch: NaN, zoom: NaN };
        return { pitch: map.getPitch(), zoom: map.getZoom() };
      });

    await stubMapboxStyle(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    // ── A) 각도 후보: pitch 그룹별 1회 진입(같은 경로·같은 지점) ──
    for (const pitch of [75, 80, 85] as const) {
      const group = ANGLE_BY_PITCH[pitch]!;
      await enterAsGuest(page, `/?ridePitch=${pitch}`);
      await armRideInput(page);
      await loadIntroCourse(page);
      await page.getByRole("button", { name: "주행 시작" }).click();
      await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForFunction(
        () => Boolean((window as unknown as { __RTW_MAP__?: unknown }).__RTW_MAP__),
        null,
        { timeout: 30_000 },
      );

      const qc = page.getByRole("group", { name: "Quick Camera" });
      await expect(qc).toBeVisible({ timeout: 15_000 });
      await qc.getByRole("button", { name: /카메라 2/ }).click();
      await page.waitForTimeout(1000);

      for (const s of group) {
        const applied = await setRideDistanceM(page, s.distanceM);
        await page.waitForTimeout(900);
        const cam = await readCam();
        await shot(s.file);
        notes.push({
          file: s.file,
          requestedPitch: s.pitch,
          requestedDistanceM: s.distanceM,
          appliedDistanceM: applied,
          floorPushed: applied > s.distanceM,
          mapPitch: cam.pitch,
          mapZoom: cam.zoom,
        });
      }

      // 다음 pitch 그룹 전 종료 — 세션 정리
      await page.getByRole("button", { name: "주행 종료" }).click().catch(() => undefined);
    }

    // ── B) QC1 3단 (기본 pitch 80) ──
    await enterAsGuest(page, "/");
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => Boolean((window as unknown as { __RTW_MAP__?: unknown }).__RTW_MAP__),
      null,
      { timeout: 30_000 },
    );

    const qc1 = page.getByRole("group", { name: "Quick Camera" });
    await expect(qc1).toBeVisible({ timeout: 15_000 });
    const btn1 = qc1.getByRole("button", { name: /카메라 1/ });

    await btn1.click();
    await page.waitForTimeout(1300);
    await expect(btn1).toHaveAttribute("data-camera1-mode", "routeFit");
    await shot("qc1-routefit.png");

    await btn1.click();
    await page.waitForTimeout(1200);
    await expect(btn1).toHaveAttribute("data-camera1-mode", "aerial60");
    await shot("qc1-aerial60.png");

    await btn1.click();
    await page.waitForTimeout(1200);
    await expect(btn1).toHaveAttribute("data-camera1-mode", "aerial10");
    await shot("qc1-aerial10.png");

    const manifest = {
      outDir: OUT_DIR,
      opsOut: OPS_OUT,
      notes,
      files: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).sort(),
    };
    for (const d of [OUT_DIR, OPS_OUT]) {
      fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(manifest, null, 2));
    }
    expect(manifest.files.length).toBeGreaterThanOrEqual(9);
  });
});

/** 맵 뷰 시트 거리 슬라이더로 preset 거리 설정. 하한에 걸리면 실제 값을 반환. */
async function setRideDistanceM(page: Page, distanceM: number): Promise<number> {
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  const slider = sheet.getByRole("slider", { name: /거리/ });
  await expect(slider).toBeVisible();
  const applied = await slider.evaluate((el, want) => {
    const input = el as HTMLInputElement;
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 0.5;
    const clamped = Math.min(max, Math.max(min, want));
    const snapped = Math.round(clamped / step) * step;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    proto?.set?.call(input, String(snapped));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return Number(input.value);
  }, distanceM);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden({ timeout: 5_000 });
  return applied;
}

async function enterAsGuest(page: Page, url: string) {
  await page.goto(url);
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });
  } catch {
    console.warn("[camera-angle] 시작 게이트 없음", url);
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
