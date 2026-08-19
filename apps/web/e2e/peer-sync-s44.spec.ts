import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * S4-4 — 상대 라이더 앞뒤 튐. 다섯 축을 같은 시계로 남기고 축 판정한다.
 * 수정 게이트가 아니다. 증상 구간 캡처가 목적.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../document/ops/sync-relay");
const SHOT_DIR = path.join(OUT_DIR, "S44-jitter-shots");

type JitterDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  events: unknown[];
  judgment: {
    axis: string;
    maxDistBacktrackM: number;
    distBacktrackCount: number;
    maxScreenReversePx: number;
    screenReverseCount: number;
    displayFrames: number;
    ingestEvents: number;
    peerUids: string[];
    reason: string;
  };
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
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else await summary.getByRole("button", { name: "닫기" }).first().click();
  await expect(summary).toBeHidden({ timeout: 10_000 });
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

async function setSpeedKmh(page: import("@playwright/test").Page, kmh: number) {
  await ensureDockExpanded(page);
  await page.getByRole("slider", { name: "세션 속도 km/h" }).fill(String(kmh));
}

test.describe("S4-4 peer jitter capture", () => {
  test.setTimeout(180_000);

  test("2인 주행에서 다섯 축을 남긴다", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.setViewportSize({ width: 1280, height: 900 });
    await pageB.setViewportSize({ width: 1280, height: 900 });

    await pageA.goto("/?peerSyncLogMs=200");
    await guestStart(pageA);
    await loadIntroCourse(pageA);
    await ensureRiding(pageA);

    await expect
      .poll(async () => new URL(pageA.url()).searchParams.get("trail"), { timeout: 20_000 })
      .not.toBeNull();
    const trailId = new URL(pageA.url()).searchParams.get("trail")!;

    await pageB.goto(`/?trail=${encodeURIComponent(trailId)}&peerSyncLogMs=200`);
    await guestStart(pageB);
    await expect(pageB.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 45_000 });
    await ensureRiding(pageB);

    await expect
      .poll(
        async () =>
          pageB.evaluate(() => Boolean((window as Window & { __rtwPeerJitterApi?: unknown }).__rtwPeerJitterApi)),
        { timeout: 20_000 },
      )
      .toBe(true);

    await pageB.evaluate(() => {
      (window as Window & { __rtwPeerJitterApi: { begin: () => void } }).__rtwPeerJitterApi.begin();
    });

    fs.mkdirSync(SHOT_DIR, { recursive: true });

    // 조건 1: 같은 속도(근접). 샷은 피어가 화면에 있는 이 구간에서 찍는다.
    await setSpeedKmh(pageA, 25);
    await setSpeedKmh(pageB, 25);
    await pageA.waitForTimeout(4_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "close-00.png"), fullPage: false });
    await pageA.waitForTimeout(180);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "close-01.png"), fullPage: false });
    await pageA.waitForTimeout(180);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "close-02.png"), fullPage: false });
    await pageA.waitForTimeout(3_000);

    // 조건 2: 속도차(추월). 피어가 화면 밖으로 나가는지 확인용.
    await setSpeedKmh(pageA, 32);
    await setSpeedKmh(pageB, 10);
    await pageA.waitForTimeout(8_000);
    await pageB.screenshot({ path: path.join(SHOT_DIR, "far-00.png"), fullPage: false });

    const dump = (await pageB.evaluate(() => {
      const api = (
        window as Window & {
          __rtwPeerJitterApi: { end: () => JitterDump };
        }
      ).__rtwPeerJitterApi;
      return api.end();
    })) as JitterDump;

    const ingestChoices = (dump.events as Array<{ kind?: string; merge?: { choice?: string } }>)
      .filter((e) => e.kind === "ingest")
      .reduce<Record<string, number>>((acc, e) => {
        const c = e.merge?.choice ?? "unknown";
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});

    const out = {
      instruction: "S4-4",
      trailId,
      conditions: [
        { riders: 2, speedKmh: [25, 25], durationMs: 8000, note: "same speed, close — shots close-00..02" },
        { riders: 2, speedKmh: [32, 10], durationMs: 8000, note: "speed diff, overtake — shot far-00" },
      ],
      tabState: "both visible",
      judgment: dump.judgment,
      ingestChoices,
      windowStartedAt: dump.windowStartedAt,
      windowEndedAt: dump.windowEndedAt,
      eventCount: dump.events.length,
      events: dump.events,
    };

    fs.writeFileSync(path.join(OUT_DIR, "S44-jitter-capture.json"), JSON.stringify(out, null, 2), "utf8");
    fs.writeFileSync(
      path.join(OUT_DIR, "S44-jitter-summary.json"),
      JSON.stringify(
        {
          instruction: "S4-4",
          trailId,
          judgment: dump.judgment,
          ingestChoices,
          eventCount: dump.events.length,
          conditions: out.conditions,
        },
        null,
        2,
      ),
      "utf8",
    );

    expect(dump.judgment.displayFrames, "peer display 프레임").toBeGreaterThan(10);
    expect(dump.judgment.ingestEvents, "RTDB/FS ingest 이벤트").toBeGreaterThan(0);
  });
});
