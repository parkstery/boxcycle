/**
 * 지시05 — QC1 Route Fit 이 3초 후에도 유지되는지 촬영.
 * npm run test:e2e:camera-qc1-hold -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-qc1-hold");
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260922-new_camera/.out/지시05",
);

test.describe("QC1 Route Fit hold (지시05)", () => {
  test.skip(!LIVE, "에뮬레이터 필요");

  test("t0 · t3s · aerial", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
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

    const qc = page.getByRole("group", { name: "Quick Camera" });
    await expect(qc).toBeVisible({ timeout: 15_000 });
    await qc.getByRole("button", { name: /카메라 1/ }).click();
    // fitBounds 애니메이션(~1.1s) 직후
    await page.waitForTimeout(1300);
    const z0 = await readMapZoom(page);
    await shot("qc1-t0.png");

    await page.waitForTimeout(3000);
    const z3 = await readMapZoom(page);
    await shot("qc1-t3s.png");

    fs.writeFileSync(
      path.join(OUT_DIR, "zoom.json"),
      JSON.stringify({ z0, z3, delta: z0 != null && z3 != null ? Math.abs(z0 - z3) : null }, null, 2),
    );
    fs.copyFileSync(path.join(OUT_DIR, "zoom.json"), path.join(OPS_OUT, "zoom.json"));

    await qc.getByRole("button", { name: /카메라 1/ }).click();
    await page.waitForTimeout(1200);
    await shot("qc1-aerial60.png");
    await qc.getByRole("button", { name: /카메라 1/ }).click();
    await page.waitForTimeout(1200);
    await shot("qc1-aerial10.png");

    // 줌이 크게 달라지면 Route Fit 이 풀린 것 — 보고용(테스트 fail 은 감리 판단)
    console.log("[qc1-hold] zoom t0=", z0, "t3s=", z3);
  });
});

async function readMapZoom(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector(".mapboxgl-map");
    // mapbox 인스턴스 직접 접근 불가 — 스케일 바 텍스트로 대략 비교는 캡처에 맡김
    void el;
    return null;
  });
}

async function enterAsGuest(page: Page) {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });
  } catch {
    /* session reuse */
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
