import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * UI-DECLUTTER-SENSOR-6A — 센서 칩을 RouteDock 으로.
 *
 * 지시서(document/ops/route-relay/260905-…-6A-작업지시서.md) §5 의 시험 항목:
 *   1. 표시 불변식  4 stage × 접힘/펼침 = 8 조합에서 칩이 보인다
 *   2. 우상단 제거  map-hud__tr 에 칩이 없다. 계정 칩·맵 버튼은 남는다
 *   3. 동작 보존    클릭하면 센서 시트가 열린다
 *   4. 레이아웃     폰 가로에서 Go 가 밀려나거나 줄바꿈이 생기지 않는다(실측 px)
 *
 * 실행: npm run test:e2e:sensor-chip -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/sensor-chip-6a");

/** 폰 가로 기준 화면 — 루트 폰트 16→13.5px 구간(max-height 560px) */
const PHONE_LANDSCAPE = { width: 690, height: 275 };

type Box = { x: number; y: number; width: number; height: number };

const measurements: Record<string, unknown> = {};

test.describe("센서 칩 — RouteDock 이전", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:sensor-chip");

  test("8 조합 표시 · 우상단 제거 · 시트 열림 · Go 실측", async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    const chip = page.getByRole("button", { name: /케이던스 센서/ });
    const trChip = page.locator(".map-hud__tr .hud-cadence");
    const dockChip = page.locator(".route-dock__top .hud-cadence");

    // ── idle: dock 이 없는 stage. 폴백이 우상단에 남아야 한다(§4.3) ──────────
    await expect(chip, "idle 에서도 센서 시트 입구는 있어야 한다").toBeVisible({ timeout: 30_000 });
    expect(await trChip.count(), "idle = 우상단 폴백").toBe(1);
    expect(await dockChip.count(), "idle 엔 dock 자체가 없다").toBe(0);
    // 부팅 직후 연결 안내가 화면을 덮은 채로 찍히지 않도록 지도가 안정된 뒤 촬영
    await expect(page.locator(".mapboxgl-canvas").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, "01-idle-fallback-tr.png") });

    // ── 3) 동작 보존 — 칩을 눌러 센서 시트를 열고 주행 입력을 준비 ──────────
    await armRideInput(page);

    await loadIntroCourse(page); // → ready-to-start

    // ── 2) 우상단 제거: 칩은 빠지고 계정 칩·맵 버튼은 남는다 ────────────────
    expect(await trChip.count(), "우상단에 센서 칩이 남으면 안 된다").toBe(0);
    await expect(page.locator(".map-hud__tr .hud-account"), "계정 칩은 남는다").toBeVisible();
    await expect(page.getByRole("button", { name: "맵 뷰 설정" }), "맵 버튼은 남는다").toBeVisible();
    // 중복 렌더 금지 — strict 위반이면 여기서 깨진다
    await expect(chip, "칩은 정확히 하나").toHaveCount(1);
    expect(await dockChip.count(), "ready-to-start = dock").toBe(1);

    // ── 4) 레이아웃 실측: 같은 페이지에서 칩만 껐다 켜 Go 이동량을 잰다 ──────
    const go = page.getByRole("button", { name: "주행 시작" });
    await expect(go).toBeVisible({ timeout: 20_000 });
    const goAfter = await box(go);
    const headAfter = await box(page.locator(".route-dock__head"));
    const shellAfter = await box(page.locator(".route-dock__shell"));
    const chipBox = await box(dockChip);

    /*
     * ⚠ 되돌릴 때 style 태그를 **내용으로 골라 지우면 안 된다** — Vite dev 가 주입한
     * CadenceHudChip.css 도 같은 문자열을 담고 있어 칩 스타일이 통째로 사라진다.
     * (실제로 그 버그로 이후 모든 스크린샷에 스타일 없는 칩이 찍혔다.)
     * addStyleTag 가 돌려주는 바로 그 노드만 지운다.
     */
    const hideChipTag = await page.addStyleTag({
      content: ".hud-cadence--dock{display:none !important}",
    });
    await page.waitForTimeout(250);
    const goBefore = await box(go);
    const headBefore = await box(page.locator(".route-dock__head"));
    const shellBefore = await box(page.locator(".route-dock__shell"));
    await hideChipTag.evaluate((node: Element) => node.remove());
    await expect(dockChip).toBeVisible();
    await page.waitForTimeout(250);

    measurements.viewport = PHONE_LANDSCAPE;
    measurements.rootFontPx = await page.evaluate(
      () => getComputedStyle(document.documentElement).fontSize,
    );
    measurements.go = { before: goBefore, after: goAfter };
    measurements.routeDockHead = { before: headBefore, after: headAfter };
    measurements.routeDockShell = { before: shellBefore, after: shellAfter };
    measurements.sensorChip = chipBox;
    measurements.computed = await page.evaluate(() => {
      const pick = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          className: el.className,
          background: cs.backgroundColor,
          color: cs.color,
          borderRadius: cs.borderRadius,
        };
      };
      return {
        shell: pick(".route-dock__shell"),
        caret: pick(".route-dock__caret"),
        chip: pick(".route-dock__top .hud-cadence"),
        panel: pick(".route-dock__panel"),
      };
    });
    await page.locator(".route-dock__shell").screenshot({
      path: path.join(OUT_DIR, "06-shell-closeup.png"),
    });

    /*
     * 칩 스타일이 실제로 먹었는가 — 계측만으로는 안 잡힌다.
     * 칩 CSS 가 통째로 빠지면 브라우저 기본 버튼(밝은 회색 바탕·검은 글자)이 되는데,
     * 그래도 위치·크기 assert 는 전부 통과한다(축퇴). 색으로 직접 못 박는다.
     */
    const chipStyle = (measurements.computed as Record<string, { background: string; color: string }>)
      .chip;
    expect(chipStyle.background, "칩이 dock 톤을 입어야 한다(기본 버튼 아님)").toBe(
      "rgba(10, 16, 26, 0.35)",
    );
    expect(chipStyle.color, "칩 글자는 밝은 색").toBe("rgb(248, 250, 252)");

    // Go 자체는 그대로 — 좁아지지도, 줄바꿈으로 높아지지도 않는다
    expect(Math.abs(goAfter.width - goBefore.width), "Go 폭 불변").toBeLessThanOrEqual(1);
    expect(
      Math.abs(goAfter.height - goBefore.height),
      "Go 높이 불변(줄바꿈 없음)",
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(headAfter.height - headBefore.height),
      "헤더 행 줄바꿈 없음",
    ).toBeLessThanOrEqual(1);
    /*
     * ★ 핵심: 칩이 들어가도 **dock 자체는 커지지 않는다**(2026-09-16 Chief).
     * 칩은 첫 행 안에 앉으므로 폭·높이 모두 칩 유무와 무관해야 한다.
     * 전용 세로 컬럼이던 종전 안은 여기서 폭 +53px 로 깨진다.
     */
    expect(shellAfter.width, "dock 폭은 칩 유무와 무관").toBe(shellBefore.width);
    expect(shellAfter.height, "dock 높이는 칩 유무와 무관").toBe(shellBefore.height);
    // 칩은 첫 행 안 — 높이가 행 높이를 넘지 않는다(세로 컬럼 금지)
    expect(chipBox.height, "칩이 세로로 늘어나면 안 된다").toBeLessThanOrEqual(
      headAfter.height + 1,
    );
    // Go 는 칩 폭만큼만 오른쪽으로 — 그 이상 밀리면 다른 것이 끼어든 것이다
    const goShift = goAfter.x - goBefore.x;
    expect(goShift, "Go 는 칩 폭만큼만 이동").toBeGreaterThanOrEqual(0);
    expect(goShift, "Go 이동량 ≤ 칩 폭 + 여백").toBeLessThanOrEqual(chipBox.width + 8);
    // dock·Go 가 화면 안에 온전히 있다
    expect(goAfter.x + goAfter.width, "Go 오른쪽 끝이 화면 안").toBeLessThanOrEqual(
      PHONE_LANDSCAPE.width,
    );
    expect(shellAfter.x + shellAfter.width, "dock 오른쪽 끝이 화면 안").toBeLessThanOrEqual(
      PHONE_LANDSCAPE.width,
    );
    await page.screenshot({ path: path.join(OUT_DIR, "02-ready-to-start-expanded.png") });

    // ── 1) 8 조합 표시 불변식 ───────────────────────────────────────────────
    const grid: Record<string, Record<string, boolean>> = {};
    grid["ready-to-start"] = await bothFoldStates(page, dockChip);

    await startRide(page); // → riding (자동 접힘)
    await expect(page.getByRole("button", { name: "경로 패널 펼치기" })).toBeVisible({
      timeout: 20_000,
    });
    expect(await dockChip.count(), "주행 중 접힘 상태에서도 칩은 DOM 에 있다").toBe(1);
    await expect(dockChip, "주행 중 접혀도 센서가 보여야 한다").toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, "03-riding-collapsed.png") });
    grid.riding = await bothFoldStates(page, dockChip);

    await page.getByRole("button", { name: "일시정지" }).click();
    // 「재개」는 일시정지 패널 텍스트 버튼과 FAB 아이콘 버튼 둘 다에 있다 — FAB 로 특정한다
    await expect(page.locator('button[aria-label="재개"]')).toBeVisible({ timeout: 20_000 });
    grid.paused = await bothFoldStates(page, dockChip);
    await page.screenshot({ path: path.join(OUT_DIR, "04-paused.png") });
    expect(await trChip.count(), "주행 중에도 우상단엔 칩이 없다").toBe(0);

    measurements.foldGrid = grid;
    for (const [stage, folds] of Object.entries(grid)) {
      for (const [fold, visible] of Object.entries(folds)) {
        expect(visible, `${stage} · ${fold} 에서 센서 칩이 보여야 한다`).toBe(true);
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, "measurements.json"),
      `${JSON.stringify(measurements, null, 2)}\n`,
      "utf8",
    );
  });

  /** setup = 핀은 있고 경로는 없는 상태. 경로가 없어도 dock 이 칩을 그린다 */
  test("setup(경로 없이 핀만) — 접힘·펼침 모두 센서가 보인다", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    /*
     * 지도를 눌러 지점 팝업 → 「Set start」. 출발 핀만 있고 경로는 없으므로 stage=setup.
     * 코스를 로드한 뒤 도착 핀을 지우는 길로는 setup 에 못 간다 — 코스의 routeGeometry 가
     * 남아 hasRoute 가 참이라 stage 는 ready-to-start 그대로다(제품 동작, 이번 범위 밖).
     */
    const map = page.locator(".mapboxgl-canvas").first();
    await expect(map).toBeVisible({ timeout: 30_000 });
    await map.click({ position: { x: 420, y: 130 } });
    const setStart = page.getByRole("button", { name: "Set start" });
    await expect(setStart, "지도 지점 팝업").toBeVisible({ timeout: 20_000 });
    await setStart.click();

    const dockChip = page.locator(".route-dock__top .hud-cadence");
    await expect(dockChip, "setup 에서 dock 이 센서를 그린다").toBeVisible({ timeout: 20_000 });
    expect(await page.locator(".map-hud__tr .hud-cadence").count(), "우상단 폴백 없음").toBe(0);

    const grid = await bothFoldStates(page, dockChip);
    await page.screenshot({ path: path.join(OUT_DIR, "05-setup.png") });
    expect(grid.expanded, "setup · 펼침").toBe(true);
    expect(grid.collapsed, "setup · 접힘").toBe(true);
    fs.writeFileSync(
      path.join(OUT_DIR, "setup-fold-grid.json"),
      `${JSON.stringify({ setup: grid }, null, 2)}\n`,
      "utf8",
    );
  });
});

/** 접힘·펼침 두 상태에서 칩 가시성을 재고, 원래 상태로 되돌린다 */
async function bothFoldStates(page: Page, dockChip: Locator) {
  const out: Record<string, boolean> = {};
  const collapse = page.getByRole("button", { name: "경로 패널 접기" });
  const expand = page.getByRole("button", { name: "경로 패널 펼치기" });

  if (await expand.isVisible()) {
    out.collapsed = await dockChip.isVisible();
    await expand.click();
    await expect(collapse).toBeVisible();
    out.expanded = await dockChip.isVisible();
    await collapse.click();
    await expect(expand).toBeVisible();
  } else {
    out.expanded = await dockChip.isVisible();
    await collapse.click();
    await expect(expand).toBeVisible();
    out.collapsed = await dockChip.isVisible();
    await expand.click();
    await expect(collapse).toBeVisible();
  }
  return out;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("boundingBox 없음 — 요소가 화면에 없다");
  return { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet, "칩 클릭 → 센서 시트(동작 보존)").toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function loadIntroCourse(page: Page) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "입문" }).click();
  const modal = page.getByRole("dialog").filter({ has: page.locator("#oc-modal-title") });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  const items = modal.locator("button.oc-modal__item");
  await expect(items.first()).toBeVisible();
  const n = await items.count();
  await items.nth(Math.max(0, n - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}

async function startRide(page: Page) {
  await page.getByRole("button", { name: "주행 시작" }).click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
}
