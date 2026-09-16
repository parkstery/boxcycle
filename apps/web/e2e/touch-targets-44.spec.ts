import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 터치 타깃 44px · 표고 그래프 통과 계약 (2026-09-17 Chief).
 *
 * 증상: 폰에서 메뉴를 누르려는데 지도 지점 팝업이 떴다.
 * 원인: HUD 버튼이 rem 으로 잡혀 폰 가로(루트 16→13.5px)에서 28.4~32.4px 까지 줄었다.
 * 손가락 접점(≈40px)보다 작아 가장자리를 빗맞히면 그 밑이 곧 지도다.
 *
 * ⚠ CSS 선언만 보는 계약은 축퇴다 — `height: max(100%, 44px)` 이 **실제로** 44px 로
 * 잡히는지는 렌더된 박스를 재야 안다. 그래서 `elementFromPoint` 로 **정말 그 버튼이
 * 집히는지**까지 확인한다.
 *
 * 실행: npm run test:e2e:touch-targets -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/touch-targets");

const PHONE_LANDSCAPE = { width: 690, height: 275 };
const MIN_TOUCH_PX = 44;

/**
 * 히트 영역을 넓힌 HUD 컨트롤 — [셀렉터, 두 축 다 44px 이어야 하는가]
 * `.hud-icon-btn`(주행 종료·재개)은 idle 에 없어 아래 별도 시험에서 잰다.
 */
const TARGETS: [string, boolean][] = [
  [".hud-brand", false],
  [".hud-place-search-btn", false],
  [".hud-account", false],
  [".hud-bc-trigger", false],
];

test.describe("터치 타깃 44px", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:touch-targets");

  test("HUD 히트 영역이 44px · 표고 그래프는 지도 터치를 막지 않는다", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await expect(page.locator(".mapboxgl-canvas").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);

    const measured = await page.evaluate(
      ({ targets, minPx }) => {
        const out: {
          sel: string;
          visible: { w: number; h: number };
          hit: { w: number; h: number };
          /** 시각 경계 바로 바깥(위/아래 2px)을 눌렀을 때 그 버튼이 집히는가 */
          edgeHitsButton: boolean | null;
          bothAxes: boolean;
        }[] = [];
        for (const [sel, bothAxes] of targets as [string, boolean][]) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const after = getComputedStyle(el, "::after");
          const hw = parseFloat(after.width);
          const hh = parseFloat(after.height);
          // 시각 상단보다 2px 위 = 종전이라면 지도였던 지점
          const probeX = r.x + r.width / 2;
          const probeY = r.y - 2;
          const hitEl = document.elementFromPoint(probeX, probeY);
          out.push({
            sel,
            visible: { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 },
            hit: {
              w: Number.isFinite(hw) ? Math.round(hw * 10) / 10 : r.width,
              h: Number.isFinite(hh) ? Math.round(hh * 10) / 10 : r.height,
            },
            edgeHitsButton: hitEl ? hitEl === el || el.contains(hitEl) : null,
            bothAxes,
          });
        }
        void minPx;
        return out;
      },
      { targets: TARGETS, minPx: MIN_TOUCH_PX },
    );

    fs.writeFileSync(
      path.join(OUT_DIR, "targets.json"),
      `${JSON.stringify({ viewport: PHONE_LANDSCAPE, measured }, null, 2)}\n`,
      "utf8",
    );

    expect(measured.length, "잴 대상이 하나도 없으면 계약이 축퇴다").toBeGreaterThanOrEqual(3);
    for (const m of measured) {
      expect(m.hit.h, `${m.sel} 히트 높이`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      if (m.bothAxes) {
        expect(m.hit.w, `${m.sel} 히트 폭`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      }
      // 종전에 지도였던 가장자리 바깥이 이제 버튼에 잡힌다 — 이게 실제 증상의 해소다
      expect(m.edgeHitsButton, `${m.sel}: 시각 경계 2px 바깥이 버튼에 잡혀야 한다`).toBe(true);
    }
  });

  test("표고 그래프 영역이 지도 터치를 통과시킨다", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page);

    const overlay = page.locator(".elevation-overlay");
    await expect(overlay, "경로가 있으면 표고 그래프가 나온다").toBeVisible({ timeout: 30_000 });

    const probe = await page.evaluate(() => {
      const el = document.querySelector(".elevation-overlay") as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        box: { w: Math.round(r.width), h: Math.round(r.height) },
        areaPct:
          Math.round(((r.width * r.height) / (window.innerWidth * window.innerHeight)) * 1000) / 10,
        pointerEvents: getComputedStyle(el).pointerEvents,
        hitTag: hit ? hit.tagName.toLowerCase() : null,
        hitClass: hit ? String((hit as HTMLElement).className) : null,
        /** 가운데를 눌렀을 때 오버레이(또는 그 자식)가 집히면 지도가 막힌 것 */
        blocksMap: hit ? el === hit || el.contains(hit) : false,
      };
    });

    fs.writeFileSync(
      path.join(OUT_DIR, "elevation.json"),
      `${JSON.stringify(probe, null, 2)}\n`,
      "utf8",
    );
    expect(probe, "표고 그래프를 찾아야 한다").not.toBeNull();
    expect(probe!.pointerEvents, "표시 전용이어야 한다").toBe("none");
    expect(probe!.blocksMap, "그래프 한가운데 터치가 지도로 내려가야 한다").toBe(false);
  });

  test("주행 컨트롤(정사각 아이콘)도 두 축 다 44px", async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    const probe = await page.evaluate(() => {
      const el = document.querySelector(".hud-icon-btn") as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y - 2);
      return {
        visible: { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 },
        hit: { w: parseFloat(after.width), h: parseFloat(after.height) },
        edgeHitsButton: hit ? hit === el || el.contains(hit) : null,
      };
    });

    /* Mapbox 자체 컨트롤(+ − 🌐 ▲)은 우리 HUD 가 아니다 — 기록만 남긴다 */
    const mapboxCtrl = await page.evaluate(() => {
      const b = document.querySelector(".mapboxgl-ctrl button") as HTMLElement | null;
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    });

    fs.writeFileSync(
      path.join(OUT_DIR, "ride-controls.json"),
      `${JSON.stringify({ hudIconBtn: probe, mapboxCtrlButton: mapboxCtrl }, null, 2)}
`,
      "utf8",
    );

    expect(probe, "주행 컨트롤을 찾아야 한다").not.toBeNull();
    expect(probe!.hit.w, "히트 폭").toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(probe!.hit.h, "히트 높이").toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(probe!.edgeHitsButton, "시각 경계 2px 바깥이 버튼에 잡혀야 한다").toBe(true);
  });
});

/** 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4) */
async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
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
