import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readGuestUid } from "./readGuestUid";

/**
 * 주행 중 이정표(주행 스토리 M2, 2026-10-08) + 이어달리기 UI 정리.
 *   1) 경로 절반을 지나면 미니맵 위쪽에 「절반 왔어요.」 띠가 잠깐 뜬다
 *   2) 남은 거리 구간(2km 경로는 마지막 25%)에 들면 종점 깃발이 펄럭인다
 *   3) 저장 → 다음 주행 카드에 「이어달리기 종료」가 없다(우상단 X 로 충분)
 *   4) 이어 달리기로 불러오면 RouteDock 의 「이어달리기 종료」가 선택지 옆 사각 버튼이다
 *
 * 실행(apps/web): node scripts/e2e/run-with-functions-emulator.mjs "npx playwright test minimap-milestone-shots --workers=1 --retries=0"
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/minimap-milestone");

test.describe("주행 중 이정표", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요");

  test("절반 띠 · 깃발 펄럭임 · 이어달리기 종료 버튼 자리", async ({ page }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.setViewportSize({ width: 740, height: 300 });
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page, 50);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 30_000 });

    // 1) 절반 띠
    const band = page.locator(".route-minimap__milestone");
    await expect(band).toBeVisible({ timeout: 150_000 });
    await expect(band).toHaveText("절반 왔어요.");
    await page.waitForTimeout(400); // 띠가 내려온 뒤
    const mm = (await page.locator(".route-minimap").boundingBox())!;
    await zoomShot(page, { x: mm.x - 4, y: mm.y - 4, width: mm.width + 8, height: mm.height + 8 }, "01-halfway-band.png");
    await page.screenshot({ path: path.join(OUT_DIR, "01-halfway-740x300.png") });
    await expect(band, "띠는 잠깐 보였다 사라진다").toBeHidden({ timeout: 8_000 });

    // 2) 깃발 펄럭임
    const goal = page.locator(".route-minimap__goal");
    await expect(goal).toHaveClass(/route-minimap__goal--waving/, { timeout: 120_000 });
    await zoomShot(page, { x: mm.x - 4, y: mm.y - 4, width: mm.width + 8, height: mm.height + 8 }, "02-flag-waving.png");

    // 3) 끝나기 전에 멈춘다 → 다음 주행 카드에 「이어달리기 종료」가 없다
    await page.getByRole("button", { name: "주행 종료" }).click();
    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await sheet.getByRole("button", { name: "저장 안 함" }).click();
    const card = page.locator(".next-ride-anchor");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByRole("button", { name: "이어달리기 종료" }), "카드엔 종료 버튼이 없다").toHaveCount(0);
    await card.screenshot({ path: path.join(OUT_DIR, "03-next-ride-card.png") });

    // 4) 진행 중(40%) 저장 경로를 심고 불러오면 RouteDock 에 이어달리기 선택지 + 옆 사각 종료 버튼
    const guestUid = await readGuestUid(page);
    await seedInProgressRoute(guestUid, `milestone-resume-${Date.now()}`);
    await page.reload();
    await loadSavedRouteFromMenu(page, RESUME_FIXTURE_NAME);
    const abandon = page.locator(".route-dock__abandon-resume");
    await expect(abandon).toBeVisible({ timeout: 30_000 });
    const geo = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const opts = r(".route-dock__resume-options");
      const btn = r(".route-dock__abandon-resume");
      return { opts: { x: opts.x, y: opts.y, w: opts.width, h: opts.height }, btn: { x: btn.x, y: btn.y, w: btn.width, h: btn.height } };
    });
    console.log(`[milestone] resume geometry ${JSON.stringify(geo)}`);
    expect(geo.btn.x, "버튼은 선택지 오른쪽").toBeGreaterThanOrEqual(geo.opts.x + geo.opts.w - 1);
    expect(geo.btn.y, "버튼은 선택지와 같은 줄(아래 줄을 따로 먹지 않는다)").toBeLessThan(geo.opts.y + geo.opts.h);
    const dock = (await page.locator(".route-dock__panel").boundingBox())!;
    await zoomShot(page, { x: dock.x - 4, y: dock.y - 4, width: dock.width + 8, height: Math.min(dock.height + 8, 300 - dock.y + 4) }, "04-route-dock-resume.png");
    await page.screenshot({ path: path.join(OUT_DIR, "04-route-dock-740x300.png") });

    expect(pageErrors, "잡히지 않은 페이지 에러").toEqual([]);
  });
});

const RESUME_FIXTURE_NAME = "이정표 시험 진행 중 경로";
const PROJECT_ID = "boxcycle-dc2df";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** 40% 까지 달린 저장 경로 — 불러오면 RouteDock 이 「N%부터 이어달리기 / 처음부터」를 묻는다 */
async function seedInProgressRoute(uid: string, routeId: string): Promise<void> {
  const coords: [number, number][] = Array.from({ length: 5 }, (_, i) => [127.02 + i * 0.002, 37.5]);
  const pair = (v: [number, number]) => ({ arrayValue: { values: [{ doubleValue: v[0] }, { doubleValue: v[1] }] } });
  const nowIso = new Date().toISOString();
  const body = {
    fields: {
      userId: { stringValue: uid },
      name: { stringValue: RESUME_FIXTURE_NAME },
      profile: { stringValue: "cycling" },
      startLngLat: pair(coords[0]!),
      endLngLat: pair(coords[coords.length - 1]!),
      geometryType: { stringValue: "LineString" },
      geometryCoordsJson: { stringValue: JSON.stringify(coords) },
      distanceMeters: { doubleValue: 706 },
      durationSec: { doubleValue: 180 },
      source: { stringValue: "web" },
      createdAt: { timestampValue: nowIso },
      updatedAt: { timestampValue: nowIso },
      completed: { integerValue: "0" },
      completedAt: { nullValue: null },
      expiresAt: { timestampValue: new Date(Date.now() + 86400000).toISOString() },
      lastRideId: { nullValue: null },
      lastProgressRatio: { doubleValue: 0.4 },
    },
  };
  const res = await fetch(`${DOCS_URL}/savedRoutes?documentId=${routeId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`SavedRoute seed 실패: ${res.status} ${await res.text()}`);
}

async function loadSavedRouteFromMenu(page: Page, routeName: string) {
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "내 경로 목록" }).click();
  const row = page.getByText(routeName, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  // 진행 중 경로는 툴바 버튼이 「열기」가 아니라 「이어 달리기」다
  await page.getByRole("toolbar", { name: "선택한 경로 작업" }).getByRole("button", { name: /이어 달리기|열기/ }).first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 15_000 });
}

async function zoomShot(page: Page, clip: { x: number; y: number; width: number; height: number }, name: string) {
  const c = { x: Math.max(0, clip.x), y: Math.max(0, clip.y), width: clip.width, height: clip.height };
  const crop = await page.screenshot({ clip: c });
  const zoom = await page.context().newPage();
  const zw = Math.ceil(c.width * 3);
  const zh = Math.ceil(c.height * 3);
  await zoom.setViewportSize({ width: zw, height: zh });
  await zoom.setContent(
    `<body style="margin:0"><img src="data:image/png;base64,${crop.toString("base64")}" style="width:${zw}px;height:${zh}px;image-rendering:pixelated"></body>`,
  );
  await zoom.screenshot({ path: path.join(OUT_DIR, name) });
  await zoom.close();
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

async function armRideInput(page: Page, speedKmh: number) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "센서 없음" }).click();
  const speedInput = sheet.getByRole("spinbutton", { name: "속도 km/h" });
  if (await speedInput.count()) {
    await speedInput.fill(String(speedKmh));
    await speedInput.blur();
  }
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
  await items.nth(Math.max(0, (await items.count()) - 1)).click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}
