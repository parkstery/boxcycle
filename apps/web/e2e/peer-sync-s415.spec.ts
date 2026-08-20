/**
 * S4-15 — displayDistM → 렌더 lngLat → project → DOM 을 한 rAF 로 캡처.
 * 스크린샷 픽셀 없음. 제품 보간·마커 로직 미수정.
 *
 * Chief: 좌측 · 16 m · 5 km/h · 두 라이더 근접·같은 속도.
 * 정렬: |gap|≤2.5 m 가 될 때까지 따라잡고, 그 다음에야 양쪽 5 km/h.
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const ALIGN_MS = 180_000;
const HOLD_MS = 2_000;
const RECORD_MS = 8_000;
const CLOSE_M = 2.5;
const QS = "rideCam=16";

type ChainDump = {
  instruction: string;
  conditionId: string | null;
  clockCanonical: string;
  sameRaf: boolean;
  pixelAnalysis: boolean;
  lngLatSource?: string;
  tickKind?: string;
  frames: unknown[];
  windowStartedAt: number | null;
  windowEndedAt: number | null;
};

type ChainApi = {
  begin: (c?: string) => void;
  end: () => ChainDump;
  peekGapM: () => number | null;
};

async function guestStart(page: import("@playwright/test").Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function loadIntroCourse(page: import("@playwright/test").Page) {
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

async function dismissRideSummaryIfAny(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (!(await summary.isVisible().catch(() => false))) return;
  const skip = summary.getByRole("button", { name: "저장 안 함" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    if (await skip.isVisible().catch(() => false)) await skip.click();
  } else {
    await summary.getByRole("button", { name: "닫기" }).first().click();
  }
  await expect(summary).toBeHidden({ timeout: 15_000 });
}

async function keepRiding(page: import("@playwright/test").Page) {
  const summary = page.getByRole("dialog", { name: "주행 결과" });
  if (await summary.isVisible().catch(() => false)) {
    await dismissRideSummaryIfAny(page);
  }
  await ensureRiding(page);
}

async function ensureRiding(page: import("@playwright/test").Page) {
  await dismissRideSummaryIfAny(page);
  if (await page.getByRole("button", { name: "주행 종료" }).isVisible().catch(() => false)) return;
  if (await page.getByRole("button", { name: "재개" }).first().isVisible().catch(() => false)) return;
  const start = page.getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
}

async function ensureDockExpanded(page: import("@playwright/test").Page) {
  await ensureRiding(page);
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (!(await fold.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "경로 패널 펼치기" }).click();
  }
  await expect(page.getByRole("slider", { name: "세션 속도 km/h" })).toBeVisible({
    timeout: 10_000,
  });
}

async function foldDock(page: import("@playwright/test").Page) {
  const fold = page.getByRole("button", { name: "경로 패널 접기" });
  if (await fold.isVisible().catch(() => false)) await fold.click();
}

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
}

async function openMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: "맵 뷰 설정" }).click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

async function closeMapSheet(page: import("@playwright/test").Page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) return;
  await sheet.getByRole("button", { name: "닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

async function setFollowLeft(page: import("@playwright/test").Page) {
  await openMapSheet(page);
  await page
    .getByRole("dialog", { name: "맵 뷰" })
    .getByRole("button", { name: "좌측", exact: true })
    .click({ force: true });
  await closeMapSheet(page);
}

async function peerGapM(page: import("@playwright/test").Page): Promise<number | null> {
  return page.evaluate(() => {
    const api = (window as Window & { __rtwPeerChainApi?: ChainApi }).__rtwPeerChainApi;
    return api?.peekGapM() ?? null;
  });
}

function catchUpSpeeds(gap: number): { a: number; b: number } {
  const abs = Math.abs(gap);
  if (abs <= CLOSE_M) return { a: 5, b: 5 };
  const fast = abs > 12 ? 8 : abs > 6 ? 7 : 6;
  if (gap > 0) return { a: 5, b: fast };
  return { a: fast, b: 5 };
}

async function recordChain(
  page: import("@playwright/test").Page,
  conditionId: string,
  ms: number,
): Promise<ChainDump> {
  await page.evaluate((id) => {
    (window as Window & { __rtwPeerChainApi: ChainApi }).__rtwPeerChainApi.begin(id);
  }, conditionId);
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as Window & { __rtwPeerChainApi: ChainApi }).__rtwPeerChainApi.end());
}

test.describe("S4-15 coord-stage same-rAF capture", () => {
  test.setTimeout(1_200_000);

  test("2인 근접·같은 속도 체인", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto(`/?${QS}`);
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await Promise.all([
      (async () => {
        await setFollowLeft(pageA);
        await setSpeedKmh(pageA, 5);
      })(),
      (async () => {
        await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&${QS}`);
        await guestStart(pageB);
        await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
        await ensureRiding(pageB);
        await setFollowLeft(pageB);
        await setSpeedKmh(pageB, 5);
      })(),
    ]);

    await expect
      .poll(
        async () =>
          pageB.evaluate(() => Boolean((window as Window & { __rtwPeerChainApi?: unknown }).__rtwPeerChainApi)),
        { timeout: 20_000 },
      )
      .toBe(true);

    const alignLog: Array<{ t: number; gap: number | null; speedA: number; speedB: number }> = [];
    const deadline = Date.now() + ALIGN_MS;
    let holdStart: number | null = null;
    let aligned = false;
    let speedA = 5;
    let speedB = 5;

    while (Date.now() < deadline) {
      await keepRiding(pageA);
      await keepRiding(pageB);
      const gap = await peerGapM(pageB);
      alignLog.push({ t: Date.now(), gap, speedA, speedB });
      if (gap == null) {
        holdStart = null;
        await pageA.waitForTimeout(300);
        continue;
      }
      const next = catchUpSpeeds(gap);
      if (next.a !== speedA) {
        await setSpeedKmh(pageA, next.a);
        speedA = next.a;
      }
      if (next.b !== speedB) {
        await setSpeedKmh(pageB, next.b);
        speedB = next.b;
      }
      if (Math.abs(gap) <= CLOSE_M && speedA === 5 && speedB === 5) {
        if (holdStart == null) holdStart = Date.now();
        if (Date.now() - holdStart >= HOLD_MS) {
          aligned = true;
          break;
        }
      } else {
        holdStart = null;
      }
      await pageA.waitForTimeout(300);
    }

    await keepRiding(pageA);
    await keepRiding(pageB);
    await setSpeedKmh(pageA, 5);
    await setSpeedKmh(pageB, 5);
    await foldDock(pageA);
    await foldDock(pageB);
    await pageB.waitForTimeout(1500);

    const pairDump = await recordChain(pageB, "pair-chief-left-16m-5kmh", RECORD_MS);

    await ctxA.close();
    await ctxB.close();

    const combined = {
      instruction: "S4-15",
      clockCanonical: "performance.now",
      sameRaf: true,
      pixelAnalysis: false,
      lngLatSource: "render-setLngLat",
      tickKind: "requestAnimationFrame",
      trailId,
      camera: "leftFlat",
      rideCamM: 16,
      speedKmh: 5,
      tabState: "both visible",
      closeM: CLOSE_M,
      aligned,
      alignLog,
      runs: [pairDump],
    };
    fs.writeFileSync(path.join(OUT_DIR, "S415-chain.json"), JSON.stringify(combined), "utf8");

    expect(pairDump.clockCanonical).toBe("performance.now");
    expect(pairDump.pixelAnalysis).toBe(false);
    expect(pairDump.lngLatSource).toBe("render-setLngLat");
    expect(pairDump.frames.length).toBeGreaterThan(60);
  });
});
