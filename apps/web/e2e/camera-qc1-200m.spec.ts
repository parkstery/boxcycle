/**
 * 20260924-지시01 — QC1 3단(routeFit/60m/10m) → 4단(+200m) 캡처.
 * npm run test:e2e:camera-qc1-200m -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-qc1-200m");
/** 지시01 §5 지정 경로 */
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260924-camera-qc/.out/jisi01",
);

test.describe("QC1 200m 추가 4단 (20260924-지시01)", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — 에뮬레이터 exec 또는 RIDE_VERIFY_LIVE=1");

  test("routeFit → 200m → 60m → 10m → routeFit", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    for (const d of [OUT_DIR, OPS_OUT]) fs.mkdirSync(d, { recursive: true });

    const readMapDiag = () =>
      page.evaluate(() => {
        const map = (window as unknown as { __RTW_MAP__?: { getZoom(): number; getPitch(): number; getBearing(): number } }).__RTW_MAP__;
        if (!map) return null;
        return { zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      });

    const diagLog: Record<string, unknown> = {};
    const shot = async (name: string) => {
      await page.waitForTimeout(1200);
      const buf = await page.screenshot({ fullPage: false });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, name), buf);
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
      const diag = await readMapDiag();
      diagLog[name] = diag;
      console.log("[camera-qc1-200m] wrote", name, buf.length, "diag=", diag);
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
    const btn1 = qc.getByRole("button", { name: /카메라 1/ });

    // 같은 경로·같은 위치에서 1번을 연속으로 눌러 찍는다(§5).
    await btn1.click();
    await shot("01-stage1-routefit.png");

    await btn1.click();
    await shot("02-stage2-200m.png");

    await btn1.click();
    await shot("03-stage3-60m.png");

    await btn1.click();
    // 파일명은 지시서 §5 표기 그대로(04-stage4-10m.png) — 실제 단계는 aerial5(요청 5m,
    // pitch 80 floor≈5.59m 클램프로 실효 6.0m). 수치는 보고서 §6 참조.
    await shot("04-stage4-10m.png");

    await btn1.click();
    // 순환이 닫히는지가 핵심(§5 E) — 5번째 클릭은 다시 Route Fit.
    await shot("05-cycle-back.png");

    const listed = fs.readdirSync(OPS_OUT).filter((f) => f.endsWith(".png")).sort();
    const manifest = { outDir: OUT_DIR, opsOut: OPS_OUT, files: listed, diag: diagLog };
    fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(OPS_OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    expect(listed.length, `캡처 0장 — ${OPS_OUT}`).toBeGreaterThan(0);
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
