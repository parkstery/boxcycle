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

  /*
   * 표고 그래프 영역은 「표시 전용」이다 — 사용자가 그래프를 조작할 일이 없으므로
   * 그 영역을 포함해 지도 팬·핀치가 되어야 한다(2026-09-17 Chief).
   *
   * 위의 「표고 그래프 영역이 지도 터치를 통과시킨다」는 오버레이 **한가운데 한 점**만,
   * 그것도 주행 전(idle)에서 본다. 그 계약은 통과하는데도 Chief 는 여전히 막힌다고 했다 —
   * 오버레이는 이미 통과하고 있었고, 주행 중에만 뜨는 `.map-hud__bc`(코치 토스트 슬롯)가
   * 같은 자리에서 그 **위를** 덮고 있었기 때문이다. 그래서 여기서는 주행 중에,
   * 오버레이 면 전체를 격자로 훑는다. 한 점 표본은 이런 부분 가림을 놓친다.
   */
  test("표고 그래프 면 전체가 주행 중에도 지도 조작을 막지 않는다", async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".elevation-overlay")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);

    const scan = await page.evaluate(() => {
      const ident = (el: Element | null): string => {
        if (!el) return "(null)";
        const e = el as HTMLElement;
        const cls = typeof e.className === "string" ? e.className : "";
        return `${el.tagName.toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).join(".")}` : ""}`;
      };
      /** 진짜 조작 요소인가 — 버튼·dock·Mapbox 컨트롤이면 막아도 정상이다. */
      const isInteractive = (el: Element | null) =>
        !!el?.closest("button, .route-dock-anchor, .mapboxgl-ctrl-group");
      const elev = document.querySelector(".elevation-overlay") as HTMLElement | null;
      if (!elev) return null;
      const r = elev.getBoundingClientRect();
      const points: { x: number; y: number; hit: string }[] = [];
      const blockedByChrome: { x: number; y: number; hit: string }[] = [];
      for (let y = Math.ceil(r.top) + 2; y < r.bottom - 2; y += 6) {
        for (let x = Math.ceil(r.left) + 2; x < r.right - 2; x += 8) {
          const hit = document.elementFromPoint(x, y);
          const id = ident(hit);
          points.push({ x, y, hit: id });
          const reachesMap = id.includes("mapboxgl-canvas");
          if (!reachesMap && !isInteractive(hit)) blockedByChrome.push({ x, y, hit: id });
        }
      }
      const counts: Record<string, number> = {};
      for (const b of blockedByChrome) counts[b.hit] = (counts[b.hit] ?? 0) + 1;
      return {
        elevRect: { x: r.x, y: r.y, w: r.width, h: r.height },
        elevPointerEvents: getComputedStyle(elev).pointerEvents,
        totalPoints: points.length,
        blockedByChrome: blockedByChrome.length,
        blockedCounts: counts,
        blockedSamples: blockedByChrome.slice(0, 12),
      };
    });

    fs.writeFileSync(
      path.join(OUT_DIR, "elevation-area-scan.json"),
      `${JSON.stringify(scan, null, 2)}\n`,
      "utf8",
    );

    expect(scan, "표고 그래프를 찾아야 한다").not.toBeNull();
    // 축퇴 방어 — 표본이 없으면 "막힘 0" 은 통과가 아니라 계측 실패다.
    expect(scan!.totalPoints, "격자 표본이 없으면 계측 실패").toBeGreaterThan(400);
    expect(
      scan!.blockedByChrome,
      `표시 전용 크롬이 지도 조작을 막는 지점: ${JSON.stringify(scan!.blockedCounts)}`,
    ).toBe(0);
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

  /*
   * 캐럿에서 세로 텍스트 「경로」를 뺐다(2026-09-17 Chief) — 그 텍스트가 높이를 벌어주던
   * 지지대였다. 폰 가로(루트 13.5px)에서 `min-height: 2.75rem` 은 약 37px 로 44px 계약 미달.
   *
   * 해법은 `::after` 투명 히트 영역이 **아니다**. 부모 `.route-dock__shell { overflow: hidden }`
   * 이 caret 테두리 1px 바깥에서 잘라내므로 밖으로 뻗는 영역은 `elementFromPoint` 에 안 잡힌다
   * (`getComputedStyle(::after)` 은 44px 를 보고한다 — 선언만 보는 계약이면 통과했을 축퇴 함정).
   * 캐럿은 배경이 transparent 이고 보이는 것이 14px 셰브런뿐이라, 버튼의 **실제 높이**를 키우는
   * 쪽이 시각 비용 0 으로 같은 목적을 달성한다. 그래서 여기서는 선언이 아니라 버튼 자신의
   * `getBoundingClientRect` 와 그 안쪽 끝에서의 실제 히트를 본다.
   *
   * 폭(1.55rem = 약 21px)은 「경로」 제거와 무관하게 **원래부터** 44px 미만이다. 넓히면 dock
   * 접힘 폭이 커져 시각 footprint 가 바뀌므로 별건으로 두고 실측만 기록한다(Chief 판단 대기).
   */
  test("RouteDock 캐럿 히트 높이 44px · 옆 센서 칩 탭을 가로채지 않는다", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);

    const probe = await page.evaluate(() => {
      const caret = document.querySelector(".route-dock__caret") as HTMLElement | null;
      const chip = document.querySelector(".route-dock__top .hud-cadence") as HTMLElement | null;
      if (!caret || !chip) return null;
      const r = caret.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const isCaret = (el: Element | null) => (el ? el === caret || caret.contains(el) : null);
      const chipRect = chip.getBoundingClientRect();
      const chipHit = document.elementFromPoint(
        chipRect.x + chipRect.width / 2,
        chipRect.y + chipRect.height / 2,
      );
      return {
        box: {
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
        },
        // 선언(::after)이 아니라 버튼 박스 안쪽 위·아래 끝에서 실제로 캐럿이 잡히는지
        topHitsCaret: isCaret(document.elementFromPoint(cx, r.y + 2)),
        bottomHitsCaret: isCaret(document.elementFromPoint(cx, r.y + r.height - 2)),
        chipStolenByCaret: isCaret(chipHit),
        chipHitIsChip: chipHit ? chipHit === chip || chip.contains(chipHit) : null,
      };
    });

    fs.writeFileSync(
      path.join(OUT_DIR, "route-dock-caret.json"),
      `${JSON.stringify(probe, null, 2)}
`,
      "utf8",
    );

    expect(probe, "캐럿과 옆 센서 칩을 찾아야 한다").not.toBeNull();
    // 축퇴 방어 — 박스를 못 찾아 0 이 나온 것을 "통과"로 세지 않는다.
    expect(probe!.box.h, "캐럿 박스 높이가 0 이면 요소를 못 찾은 것").toBeGreaterThan(0);
    expect(probe!.box.w, "캐럿 박스 폭이 0 이면 요소를 못 찾은 것").toBeGreaterThan(0);

    expect(probe!.box.h, "캐럿 히트 높이").toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(probe!.topHitsCaret, "박스 위쪽 끝이 캐럿에 잡혀야 한다").toBe(true);
    expect(probe!.bottomHitsCaret, "박스 아래쪽 끝이 캐럿에 잡혀야 한다").toBe(true);
    // 폭은 위 주석대로 별건(기존 미달) — 이웃 칩을 가로채지 않는 것이 이번 작업의 계약이다.
    expect(probe!.chipStolenByCaret, "캐럿 히트 영역이 옆 센서 칩 탭을 가로채면 안 된다").toBe(
      false,
    );
    expect(probe!.chipHitIsChip, "센서 칩 중심은 여전히 칩이 잡아야 한다").toBe(true);
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
