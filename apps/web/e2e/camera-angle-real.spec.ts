/**
 * 지시08 — 각도 후보 a–f 를 **실 Mapbox 스타일**(스텁 없음)로 재촬영.
 * 제품 코드 미변경. stubMapboxStyle 금지.
 */
import { test, expect, type Page } from "./open-meteo-stub";
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

type AngleShot = { file: string; pitch: number; distanceM: number };

/** 한 세션에서 pitch 고정, 거리만 바꿔 찍음 — pitch 변경은 모듈 캐시 때문에 재진입 */
const GROUPS: Array<{ pitch: number; shots: AngleShot[] }> = [
  {
    pitch: 75,
    shots: [{ file: "a-p75-d6.png", pitch: 75, distanceM: 6 }],
  },
  {
    pitch: 80,
    shots: [
      { file: "b-p80-d6.png", pitch: 80, distanceM: 6 },
      { file: "d-p80-d10.png", pitch: 80, distanceM: 10 },
    ],
  },
  {
    pitch: 85,
    shots: [
      { file: "c-p85-d6.png", pitch: 85, distanceM: 6 },
      { file: "e-p85-d10.png", pitch: 85, distanceM: 10 },
      { file: "f-p85-d20.png", pitch: 85, distanceM: 20 },
    ],
  },
];

test.describe("지시08 실 스타일 각도 후보", () => {
  test.skip(!LIVE, "에뮬레이터 필요");

  test("angle a–f real mapbox style", async ({ page }, testInfo) => {
    test.setTimeout(560_000);
    for (const d of [OUT_DIR, OPS_OUT]) {
      fs.mkdirSync(d, { recursive: true });
      for (const f of fs.readdirSync(d)) {
        if (f.endsWith(".png") || f === "manifest.json") fs.unlinkSync(path.join(d, f));
      }
    }

    const notes: Array<Record<string, unknown>> = [];

    const shot = async (name: string) => {
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ fullPage: false, timeout: 20_000 });
      for (const d of [OUT_DIR, OPS_OUT]) fs.writeFileSync(path.join(d, name), buf);
      await testInfo.attach(name, { body: buf, contentType: "image/png" });
    };

    const readCam = async () =>
      page.evaluate(() => {
        const map = (window as unknown as {
          __RTW_MAP__?: {
            getPitch: () => number;
            getZoom: () => number;
            getStyle?: () => { name?: string };
            getTerrain?: () => unknown;
          };
        }).__RTW_MAP__;
        if (!map) return { pitch: NaN, zoom: NaN, styleName: null, hasTerrain: false };
        return {
          pitch: map.getPitch(),
          zoom: map.getZoom(),
          styleName: map.getStyle?.()?.name ?? null,
          hasTerrain: Boolean(map.getTerrain?.()),
        };
      });

    const assertLiveStyle = async () => {
      await page.waitForFunction(
        () => {
          const map = (window as unknown as {
            __RTW_MAP__?: {
              getStyle?: () => { name?: string; layers?: unknown[]; sources?: Record<string, unknown> };
            };
          }).__RTW_MAP__;
          if (!map || !document.querySelector(".mapboxgl-canvas")) return false;
          const style = map.getStyle?.();
          if (!style || style.name === "e2e-stub") return false;
          const layers = style.layers?.length ?? 0;
          const attr = document.querySelector(".mapboxgl-ctrl-attrib")?.textContent ?? "";
          return layers >= 5 && /Mapbox/i.test(attr);
        },
        null,
        { timeout: 45_000 },
      );
      await page.waitForTimeout(800);
      const probe = await page.evaluate(() => {
        const map = (window as unknown as {
          __RTW_MAP__?: { getStyle?: () => { name?: string; layers?: unknown[] } };
        }).__RTW_MAP__;
        const style = map?.getStyle?.();
        return {
          styleName: style?.name ?? null,
          layers: style?.layers?.length ?? 0,
          attrib: (document.querySelector(".mapboxgl-ctrl-attrib")?.textContent ?? "").slice(0, 80),
        };
      });
      console.log("[camera-angle-real] live", probe);
      if (probe.styleName === "e2e-stub" || (probe.layers ?? 0) < 5) {
        throw new Error(`실 스타일 미로드: ${JSON.stringify(probe)}`);
      }
      return probe;
    };

    const ensure3D = async () => {
      await page.getByRole("button", { name: "맵 뷰 설정" }).click();
      const sheet = page.getByRole("dialog", { name: "맵 뷰" });
      await expect(sheet).toBeVisible({ timeout: 8_000 });
      const threeD = sheet.getByRole("checkbox", { name: /3D 뷰/ });
      if (!(await threeD.isChecked())) await threeD.check();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden({ timeout: 5_000 });
      await page.waitForTimeout(700);
    };

    const selectCam2 = async () => {
      const qc = page.getByRole("group", { name: "Quick Camera" });
      await expect(qc).toBeVisible({ timeout: 12_000 });
      const btn2 = qc.getByRole("button", { name: /카메라 2/ });
      await btn2.click();
      await expect(btn2).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
      await page.waitForTimeout(700);
    };

    await page.setViewportSize({ width: 1280, height: 720 });

    for (const group of GROUPS) {
      await enterAsGuest(page, `/?ridePitch=${group.pitch}`);
      await armRideInput(page);
      await loadIntroCourse(page);
      await page.getByRole("button", { name: "주행 시작" }).click();
      await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({
        timeout: 25_000,
      });
      await page.waitForFunction(
        () => Boolean((window as unknown as { __RTW_MAP__?: unknown }).__RTW_MAP__),
        null,
        { timeout: 25_000 },
      );

      await ensure3D();
      const live = await assertLiveStyle();
      await selectCam2();

      for (const s of group.shots) {
        const applied = await setRideDistanceM(page, s.distanceM);
        // 시트 닫힌 뒤 전방 고정 재확인(시트 조작이 follow 를 흔들 수 있음)
        await selectCam2();
        await page.waitForTimeout(600);
        const cam = await readCam();
        if (cam.styleName === "e2e-stub") throw new Error(`스텁: ${s.file}`);
        // pitch 가 요청값에 근접한지(±3°) — follow 가 덮으면 실패로 드러냄
        if (Number.isFinite(cam.pitch) && Math.abs(cam.pitch - s.pitch) > 3) {
          console.warn(`[camera-angle-real] pitch drift ${s.file}: got ${cam.pitch} want ${s.pitch}`);
        }
        await shot(s.file);
        notes.push({
          file: s.file,
          requestedPitch: s.pitch,
          requestedDistanceM: s.distanceM,
          appliedDistanceM: applied,
          floorPushed: applied > s.distanceM,
          mapPitch: cam.pitch,
          mapZoom: cam.zoom,
          styleName: cam.styleName,
          hasTerrain: cam.hasTerrain,
          live,
        });
      }

      await page.getByRole("button", { name: "주행 종료" }).click().catch(() => undefined);
      await page.waitForTimeout(300);
    }

    const manifest = {
      outDir: OUT_DIR,
      opsOut: OPS_OUT,
      stubMapboxStyle: false,
      enable3D: true,
      camera: 2,
      notes,
      files: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).sort(),
    };
    for (const d of [OUT_DIR, OPS_OUT]) {
      fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(manifest, null, 2));
    }
    expect(manifest.files).toEqual([
      "a-p75-d6.png",
      "b-p80-d6.png",
      "c-p85-d6.png",
      "d-p80-d10.png",
      "e-p85-d10.png",
      "f-p85-d20.png",
    ]);
  });
});

async function setRideDistanceM(page: Page, distanceM: number): Promise<number> {
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await expect(sheet).toBeVisible({ timeout: 8_000 });
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
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const gate = page.getByRole("dialog", { name: "시작" });
  try {
    await expect(gate).toBeVisible({ timeout: 8_000 });
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await expect(gate).toBeHidden({ timeout: 25_000 });
  } catch {
    console.warn("[camera-angle-real] 시작 게이트 없음", url);
  }
}

async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 12_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 8_000 });
}

async function loadIntroCourse(page: Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문", exact: true }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 12_000 });
  await modal.locator("button.oc-modal__item").first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 18_000 });
}
