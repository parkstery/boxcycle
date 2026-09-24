/**
 * 20260924-지시02 — 라이더 조명 조절판(`?lightlab=1`) 캡처.
 * npm run test:e2e:camera-qc-lightlab -w boxcycle-web
 */
import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stubMapboxStyle } from "./mapbox-stub";

const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/camera-qc-lightlab");
/** 지시02 §6 지정 경로 */
const OPS_OUT = path.resolve(
  __dirname,
  "../../../document/ops/20260924-camera-qc/.out/jisi02",
);

/** 지시02 §7 — 폰 가로 근사(공간 밀도 원칙 SoT) */
const PHONE_LANDSCAPE_VIEWPORT = { width: 740, height: 300 };

test.describe("라이더 조명 조절판 (20260924-지시02)", () => {
  test.skip(!LIVE, "Firebase 준비 필요 — 에뮬레이터 exec 또는 RIDE_VERIFY_LIVE=1");

  test("lightlab=1 없으면 패널 없음 → 있으면 조절판 + 프리셋 4종", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    for (const d of [OUT_DIR, OPS_OUT]) fs.mkdirSync(d, { recursive: true });

    const shot = async (name: string) => {
      await page.waitForTimeout(900);
      const buf = await page.screenshot({ fullPage: false });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, name), buf);
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
      console.log("[camera-qc-lightlab] wrote", name, buf.length);
    };

    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE_VIEWPORT);

    // ── A: ?lightlab=1 없이 접속 — 패널이 없어야 한다(지시02 §3·§7) ──────────
    await enterAsGuest(page, "/");
    await expect(page.getByRole("button", { name: "Trail 메뉴" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".light-lab")).toHaveCount(0);
    const localStorageEmpty = await page.evaluate(() => {
      try {
        return window.localStorage.getItem("rtw:riderLightLab:v1") == null;
      } catch {
        return true;
      }
    });
    expect(localStorageEmpty, "lightlab=1 없이 방문했는데 localStorage 에 기록이 생겼다").toBe(true);
    await shot("01-panel-closed.png");

    // ── B 이후: ?lightlab=1 로 재진입(같은 세션 재사용) — 조절판이 뜬다 ───────
    await page.goto("/?lightlab=1");
    await expect(page.getByRole("button", { name: "Trail 메뉴" })).toBeVisible({ timeout: 20_000 });
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    const panel = page.locator(".light-lab");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // 조절판은 기본 접힘(§5, 주행 중 Quick Camera·계정 칩과 같은 자리) — 카메라 각도부터
    // 먼저 고르고 나서 편다. 같은 각도·같은 위치에서 비교하기 위해 라이더 클로즈업
    // 카메라(2 = forward, pitch 80)로 고정 — Quick Camera 행에서 조절판과 안 겹치는 가장
    // 왼쪽 근접 카메라.
    const qc = page.getByRole("group", { name: "Quick Camera" });
    await expect(qc).toBeVisible({ timeout: 15_000 });
    await qc.getByRole("button", { name: "카메라 2" }).click();
    await page.waitForTimeout(600);

    await panel.getByRole("button", { name: "조절판 펼치기" }).click();
    await shot("02-panel-open.png");

    const rect = await panel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    const vpArea = PHONE_LANDSCAPE_VIEWPORT.width * PHONE_LANDSCAPE_VIEWPORT.height;
    const panelArea = rect.w * rect.h;
    console.log(
      "[camera-qc-lightlab] panel rect",
      rect,
      "viewport",
      PHONE_LANDSCAPE_VIEWPORT,
      "area%",
      ((panelArea / vpArea) * 100).toFixed(1),
    );

    const presets: { name: string; file: string }[] = [
      { name: "기본", file: "03-preset-기본.png" },
      { name: "진한 색", file: "04-preset-진한색.png" },
      { name: "입체", file: "05-preset-입체.png" },
      { name: "평평", file: "06-preset-평평.png" },
    ];
    const presetValues: Record<string, unknown> = {};
    for (const p of presets) {
      await panel.getByRole("button", { name: p.name, exact: true }).click();
      await page.waitForTimeout(400);
      await shot(p.file);
      presetValues[p.name] = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll(".light-lab__row"));
        return rows.map((r) => ({
          label: r.querySelector(".light-lab__label")?.textContent,
          value: r.querySelector(".light-lab__value")?.textContent,
        }));
      });
    }

    // ── 패널 터치가 지도로 새지 않는지 확인(이 리포에서 반복된 함정, §5) ──────
    const readMapDiag = () =>
      page.evaluate(() => {
        const map = (window as unknown as {
          __RTW_MAP__?: { getCenter(): { lng: number; lat: number }; getZoom(): number; getBearing(): number };
        }).__RTW_MAP__;
        if (!map) return null;
        const c = map.getCenter();
        return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), bearing: map.getBearing() };
      });
    await panel.getByRole("button", { name: "초기화" }).click();
    const ambientSlider = panel.locator(".light-lab__row input[type='range']").first();
    const valueBeforeDrag = await ambientSlider.inputValue();
    const mapBeforeDrag = await readMapDiag();
    const sliderBox = await ambientSlider.boundingBox();
    if (!sliderBox) throw new Error("ambient slider boundingBox 없음");
    const midY = sliderBox.y + sliderBox.height / 2;
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.15, midY);
    await page.mouse.down();
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.55, midY, { steps: 10 });
    await page.mouse.move(sliderBox.x + sliderBox.width * 0.85, midY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const valueAfterDrag = await ambientSlider.inputValue();
    const mapAfterDrag = await readMapDiag();
    console.log("[camera-qc-lightlab] drag leak check", {
      valueBeforeDrag,
      valueAfterDrag,
      mapBeforeDrag,
      mapAfterDrag,
    });
    expect(valueAfterDrag, "슬라이더 드래그가 실제로 값을 바꿔야 한다").not.toBe(valueBeforeDrag);
    expect(mapAfterDrag, "패널 드래그 중 지도가 움직였다(터치 누출)").toEqual(mapBeforeDrag);

    const manifest = {
      outDir: OUT_DIR,
      opsOut: OPS_OUT,
      panelRectPx: rect,
      viewport: PHONE_LANDSCAPE_VIEWPORT,
      panelAreaPct: (panelArea / vpArea) * 100,
      presetValues,
      dragLeakCheck: { valueBeforeDrag, valueAfterDrag, mapBeforeDrag, mapAfterDrag },
    };
    fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(OPS_OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

    const listed = fs.readdirSync(OPS_OUT).filter((f) => f.endsWith(".png")).sort();
    expect(listed.length, `캡처 0장 — ${OPS_OUT}`).toBeGreaterThan(0);
  });
});

async function enterAsGuest(page: Page, url = "/") {
  await page.goto(url);
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
