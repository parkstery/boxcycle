/**
 * Quick Camera 캡처 전용 — 검증 assert 최소. 지시04.
 * 실행: npm run test:e2e:camera-quick -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 지시04 지정 경로 */
const OUT_DIR = path.resolve(__dirname, "../.out/camera-quick");
/** 보고용 미러(gitignore 밖 ops 폴더) */
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260922-new_camera/.out/지시04",
);

test.describe("Quick Camera 캡처 (지시04)", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — 에뮬레이터 exec 또는 RIDE_VERIFY_LIVE=1");

  test("주행 중 QC 1~6 · 칩 · pitch80", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    for (const dir of [OUT_DIR, OPS_OUT]) fs.mkdirSync(dir, { recursive: true });
    console.log("[camera-quick] OUT_DIR=", OUT_DIR);

    const shot = async (name: string) => {
      await page.waitForTimeout(600);
      const buf = await page.screenshot({ fullPage: false });
      for (const dir of [OUT_DIR, OPS_OUT]) {
        fs.writeFileSync(path.join(dir, name), buf);
      }
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
      console.log("[camera-quick] wrote", name, buf.length);
    };

    await stubMapboxStyle(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    await enterAsGuest(page, "/");
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({
      timeout: 30_000,
    });

    const qc = page.getByRole("group", { name: "Quick Camera" });
    await expect(qc).toBeVisible({ timeout: 15_000 });
    await shot("qc-bar.png");

    await qc.getByRole("button", { name: /카메라 1/ }).click();
    await shot("qc1-routefit.png");
    await qc.getByRole("button", { name: /카메라 1/ }).click();
    await shot("qc1-aerial60.png");
    await qc.getByRole("button", { name: /카메라 1/ }).click();
    await shot("qc1-aerial10.png");

    for (const [n, file] of [
      [2, "qc2-forward.png"],
      [3, "qc3-backward.png"],
      [4, "qc4-left.png"],
      [5, "qc5-right.png"],
      [6, "qc6-north.png"],
    ] as const) {
      await qc.getByRole("button", { name: new RegExp(`카메라 ${n}`) }).click();
      await shot(file);
    }

    await page.getByRole("button", { name: "맵 뷰 설정" }).click();
    const sheet = page.getByRole("dialog", { name: "맵 뷰" });
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await shot("chips-after.png");
    await page.keyboard.press("Escape");

    // pitch80 — 세션이 남아 게이트가 안 뜰 수 있음. 실패해도 본 캡처는 유지.
    try {
      await enterAsGuest(page, "/?ridePitch=80");
      await armRideInput(page);
      await loadIntroCourse(page);
      await page.getByRole("button", { name: "주행 시작" }).click();
      await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({
        timeout: 30_000,
      });
      const qc2 = page.getByRole("group", { name: "Quick Camera" });
      await expect(qc2).toBeVisible({ timeout: 15_000 });
      await qc2.getByRole("button", { name: /카메라 2/ }).click();
      await shot("pitch80-forward.png");
    } catch (err) {
      console.warn("[camera-quick] pitch80 구간 스킵:", err);
      await shot("pitch80-forward-FAILED.png");
    }

    const listed = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).sort();
    const manifest = { outDir: OUT_DIR, opsOut: OPS_OUT, files: listed };
    fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(OPS_OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    expect(listed.length, `캡처 0장 — ${OUT_DIR}`).toBeGreaterThan(0);
  });
});

/** 게이트가 있으면 클릭, 이미 인증된 세션이면 통과 */
async function enterAsGuest(page: Page, url: string) {
  await page.goto(url);
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 30_000 });
  } catch {
    // 이미 맵에 들어온 세션(에뮬 인증 유지) — 게이트 없이 진행
    console.warn("[camera-quick] 시작 게이트 없음 — 기존 세션으로 진행", url);
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
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  await items.first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}
