/**
 * 11-04 Chief:
 *  ① 「지금 달리는 trail 에서 클릭하면 참여가 가능했었으나 현재는 클릭은 되지만 참여가 안 된다」
 *     — 폰 가로(800×360)에서 오른쪽 Trail 목록 줄 끝 「합류」 단추가 지도 조작(맵 스타일 원)에 덮여
 *       누름이 지도 단추로 갔다. 줄 전체를 누르면 합류하도록 고쳤다.
 *  ② 「trail에 참여한 사용자가 주행을 하지 않고 다시 trail을 빠져나오는 기능이 없다」
 *     — 폰 가로에선 HUD 「Trailhead로」 패널이 숨겨져 창구가 없었다. 메뉴 「현재 Trail N」 줄에 「나가기」.
 *  ③ 「나왔지만 여전히 주행 가능 상태…경로를 해제해야 한다」 — 나가기는 합류가 불러온 경로·입문 허브도 해제한다.
 *
 * 실앱 + 에뮬레이터(auth·firestore·database·functions): A 가 입문 경로로 주행을 시작해 공개 Trail 을 열고,
 * B(게스트)가 메뉴 → 지금 달리는 Trail → 줄 누르기로 합류, 메뉴 「나가기」로 Trailhead 로 돌아온다.
 */
import { test, expect } from "./open-meteo-stub";
import { guestStart, loadIntroCourse, prepareManualRideInput, setSpeedKmh } from "./rideEntryHelpers";

test.setTimeout(240_000);

/** 저장하지 않은 경로(입문 등) 결과 창은 「닫기」 대신 「저장 안 함」 으로 닫는다(기존 동작). */
async function closeSummary(sheet: import("@playwright/test").Locator) {
  const skip = sheet.getByRole("button", { name: "저장 안 함", exact: true });
  // 저장 줄은 시트가 뜬 뒤 잠시 후 나타나며 그때 「닫기」 가 사라진다 — 먼저 기다린다.
  const adhoc = await skip.waitFor({ state: "visible", timeout: 4_000 }).then(() => true).catch(() => false);
  if (adhoc) await skip.click();
  else await sheet.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(sheet).toBeHidden();
}

/** 주행 중 5초 뒤 버튼이 숨는다 — 지도 빈 곳을 눌러 다시 보이게 한다. */
async function revealControls(page: import("@playwright/test").Page, name: string) {
  // 기존 진입 흐름: 주행 기록이 없는 게스트에게 「어디에서 시작할까요?」 가 늦게 뜰 수 있다 — 뜨면 기본 위치로 닫는다.
  // 주행 중이면 5초 뒤 버튼이 숨는다 — 지도 빈 곳을 눌러 다시 보이게 한다.
  const entry = page.getByRole("dialog", { name: "어디에서 시작할까요?" });
  const btn = page.getByRole("button", { name, exact: true }).first();
  const started = Date.now();
  const until = started + 15_000;
  let tapped = false;
  while (Date.now() < until) {
    if (await entry.isVisible().catch(() => false)) {
      await entry.getByRole("button", { name: /기본 위치/ }).click().catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }
    if (await btn.isVisible().catch(() => false)) return btn;
    if (!tapped && Date.now() - started > 2_000) {
      await page.mouse.click(400, 200);
      tapped = true;
    }
    await page.waitForTimeout(300);
  }
  await expect(btn).toBeVisible();
  return btn;
}


test("메뉴 → 지금 달리는 Trail → 줄을 눌러 합류, 메뉴 「나가기」로 Trailhead", async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const a = await ctxA.newPage();
  await a.goto("/");
  await guestStart(a);
  await prepareManualRideInput(a);
  await loadIntroCourse(a, { pick: "shortest" });
  const start = a.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible();
  await start.click();
  await expect.poll(async () => new URL(a.url()).searchParams.get("trail"), { timeout: 30_000 }).not.toBeNull();
  const trailId = new URL(a.url()).searchParams.get("trail")!;

  const ctxB = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const b = await ctxB.newPage();
  await b.goto("/");
  await guestStart(b);
  const menu = b.locator("#menu-panel");
  await (await revealControls(b, "메뉴 열기")).click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trailhead");
  await expect(menu.getByRole("button", { name: "Trail 나가기", exact: true })).toHaveCount(0);
  await expect(menu.locator(".trail-hub__show-list")).toContainText("1개", { timeout: 30_000 });
  await menu.locator(".trail-hub__show-list").click();

  // 줄 끝 합류 단추는 이 폭에서 지도 조작에 덮인다 — 사람이 보이는 줄(번호·이름 쪽)을 누른다.
  const row = b.locator(".lb-glance__row--trail").first();
  await expect(row).toBeVisible();
  await row.locator(".lb-glance__name").click();
  await expect.poll(async () => new URL(b.url()).searchParams.get("trail"), { timeout: 20_000 }).toBe(trailId);

  // 합류하면 그 Trail 의 경로가 잡혀 바로 달릴 수 있다.
  const startB = b.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" });
  await expect(startB).toHaveCount(1, { timeout: 20_000 });

  await (await revealControls(b, "메뉴 열기")).click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trail");
  await expect(menu.locator(".trail-hub__context")).not.toContainText("Trailhead");
  const leave = menu.getByRole("button", { name: "Trail 나가기", exact: true });
  await expect(leave).toBeVisible();
  await leave.click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trailhead");
  await expect(leave).toHaveCount(0);
  // 경로도 해제 — 주행 시작 단추·「선택: Basic N」 줄이 없다.
  await expect(menu.locator(".ride-panel__official-active")).toHaveCount(0);
  await expect(startB).toHaveCount(0);
  await expect.poll(async () => new URL(b.url()).searchParams.get("trail")).toBeNull();

  await ctxA.close();
  await ctxB.close();
});

/* ── 2026-11-05 Chief 시안 ②④⑤ — 주행 종료 ≠ Trail 나가기 ────────────────────────── */

async function startIntroRide(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/");
  await guestStart(page);
  await prepareManualRideInput(page);
  await loadIntroCourse(page, { pick: "shortest" });
  const start = page.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible();
  await start.click();
  await expect.poll(async () => new URL(page.url()).searchParams.get("trail"), { timeout: 30_000 }).not.toBeNull();
  // 결과 창은 100 m·5초를 넘게 달려야 뜬다(MIN_MEANINGFUL_RIDE_*) — 50 km/h 로 22초(가속 포함 약 150 m, 0.41 km 코스 도착 전).
  await setSpeedKmh(page, 50);
  await page.waitForTimeout(22_000);
  return new URL(page.url()).searchParams.get("trail")!;
}

test("주행 종료 후 같은 Trail 대기 — 다시 시작하면 같은 Trail, 결과 창 「Trail 나가기」", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const a = await ctx.newPage();
  const trailId = await startIntroRide(a);
  const sheet = a.getByRole("dialog", { name: "주행 결과" });

  await (await revealControls(a, "주행 종료")).click();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await expect(sheet.locator(".ride-summary__trail-stay")).toContainText("남아 있어요");
  await closeSummary(sheet);
  expect(new URL(a.url()).searchParams.get("trail"), "종료해도 Trail 유지").toBe(trailId);

  const menu = a.locator("#menu-panel");
  await (await revealControls(a, "메뉴 열기")).click();
  await expect(menu.locator(".trail-hub__status")).toHaveText("대기");
  await expect(menu.getByRole("button", { name: "Trail 나가기", exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "메뉴 닫기", exact: true }).first().click();

  // 경로가 남아 바로 다시 달릴 수 있고, 새 Trail 을 만들지 않는다.
  const start = a.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible();
  await start.click();
  // 같은 Trail 에서 달린 적이 있으니 이어서/처음부터를 묻는다(시안 ③).
  await a.getByRole("dialog", { name: /Trail \d{3}/ }).getByRole("button", { name: /km부터 이어 달리기$/ }).click();
  await expect(a.getByRole("button", { name: "주행 종료" }).first()).toHaveCount(1, { timeout: 20_000 });
  expect(new URL(a.url()).searchParams.get("trail"), "다시 시작해도 같은 Trail").toBe(trailId);
  await setSpeedKmh(a, 50);
  // 이어 달리기라 남은 거리가 짧다 — 도착하면 결과 창이 저절로 뜬다(그럼 「주행 종료」 를 누르지 않는다).
  // 이번 구간도 100 m 를 넘겨야 결과 창이 뜬다 — 20초(도착하면 그 전에 뜬다).
  await a.waitForTimeout(20_000);
  if (!(await sheet.isVisible().catch(() => false))) await (await revealControls(a, "주행 종료")).click();
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await sheet.getByRole("button", { name: "Trail 나가기", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(async () => new URL(a.url()).searchParams.get("trail")).toBeNull();
  await expect(start).toHaveCount(0);
  await ctx.close();
});

test("주행 중 메뉴 「나가기」 → 확인 → 종료하고 나가기", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const a = await ctx.newPage();
  const trailId = await startIntroRide(a);
  const menu = a.locator("#menu-panel");

  await (await revealControls(a, "메뉴 열기")).click();
  await expect(menu.locator(".trail-hub__status")).toHaveText("주행 중");
  await menu.getByRole("button", { name: "Trail 나가기", exact: true }).click();
  const confirm = a.getByRole("alertdialog", { name: /주행을 끝내고/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 달리기" }).click();
  await expect(confirm).toHaveCount(0);
  expect(new URL(a.url()).searchParams.get("trail")).toBe(trailId);

  await menu.getByRole("button", { name: "Trail 나가기", exact: true }).click();
  await a.getByRole("alertdialog", { name: /주행을 끝내고/ }).getByRole("button", { name: "종료하고 나가기" }).click();
  const sheet = a.getByRole("dialog", { name: "주행 결과" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await expect(sheet.locator(".ride-summary__trail-stay")).toHaveCount(0);
  await expect.poll(async () => new URL(a.url()).searchParams.get("trail")).toBeNull();
  await closeSummary(sheet);
  await expect(a.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" })).toHaveCount(0);
  await ctx.close();
});

/* ── 2026-11-05 Chief 시안 ①③ — 최근 내가 달린 Trail(10분)·이어 달리기 ─────────────────── */

test("나간 Trail 은 「최근 내가 달린 Trail」 에 남고, 다시 들어가 시작하면 이어서/처음부터를 묻는다", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const a = await ctx.newPage();
  const trailId = await startIntroRide(a);
  const sheet = a.getByRole("dialog", { name: "주행 결과" });
  await (await revealControls(a, "주행 종료")).click();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.getByRole("button", { name: "Trail 나가기", exact: true }).click();
  await expect.poll(async () => new URL(a.url()).searchParams.get("trail")).toBeNull();

  const menu = a.locator("#menu-panel");
  await (await revealControls(a, "메뉴 열기")).click();
  await expect(menu.locator(".trail-hub__recent-count")).toContainText("최근 1");
  await menu.locator(".trail-hub__show-list").click();
  const rejoin = a.getByRole("button", { name: /다시 들어가기$/ });
  await expect(rejoin).toBeVisible();
  await expect(a.locator(".lb-glance__recent-left")).toContainText(/(10|9)분 남음/);
  // 줄 끝 단추는 이 폭에서 지도 조작에 덮인다 — 줄 전체가 다시 들어가기다.
  await a.locator(".lb-glance__row--recent .lb-glance__name").first().click();
  await expect.poll(async () => new URL(a.url()).searchParams.get("trail"), { timeout: 20_000 }).toBe(trailId);

  const start = a.getByRole("group", { name: "주행 제어" }).getByRole("button", { name: "주행 시작" });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  const choice = a.getByRole("dialog", { name: /Trail \d{3}/ });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole("button", { name: /km부터 이어 달리기$/ })).toBeVisible();
  await choice.getByRole("button", { name: /km부터 이어 달리기$/ }).click();
  await expect(choice).toHaveCount(0);
  await expect(a.getByRole("button", { name: "주행 종료" }).first()).toHaveCount(1, { timeout: 20_000 });
  expect(new URL(a.url()).searchParams.get("trail")).toBe(trailId);
  await ctx.close();
});

/* ── 2026-11-05 Chief 시안 ⑦ — Trail 찾기 ─────────────────────────────────────────── */

test("「Trail 찾기」 — 거리 구간으로 거르고, 줄의 합류로 들어간다", async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const a = await ctxA.newPage();
  const trailId = await startIntroRide(a);

  const ctxB = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const b = await ctxB.newPage();
  await b.goto("/");
  await guestStart(b);
  const menu = b.locator("#menu-panel");
  await (await revealControls(b, "메뉴 열기")).click();
  // 같은 에뮬레이터에서 앞 시험이 남긴 Trail 이 있을 수 있다 — 1개 이상
  await expect(menu.locator(".trail-hub__show-list")).toContainText(/[1-9]\d*개/, { timeout: 30_000 });
  await menu.locator(".trail-hub__show-list").click();
  await b.getByRole("button", { name: "Trail 찾기 ›" }).click();
  const finder = b.getByRole("dialog", { name: "Trail 찾기" });
  await expect(finder).toBeVisible();
  // 게스트는 대표 국가가 없어 세계부터(F1)
  await expect(finder.getByRole("button", { name: /범위 바꾸기 — 지금 세계/ })).toBeVisible();
  const list = finder.getByRole("list", { name: "Trail 목록" });
  await expect(list.getByRole("listitem").first()).toBeVisible({ timeout: 20_000 });
  // 같은 경로(입문 코스) Trail 이 여럿이면 한 줄로 묶인다(F2) — 펼쳐서 Trail 별 합류를 본다.
  const expand = list.getByRole("button", { name: "펼치기 ▾" }).first();
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
    await expect(list.getByRole("button", { name: "접기 ▴" }).first()).toBeVisible();
  }
  await expect(list.getByRole("button", { name: /— 합류$/ }).first()).toBeVisible();

  await finder.getByRole("group", { name: "거리" }).getByRole("button", { name: "40+" }).click();
  await expect(list).toContainText("조건에 맞는 Trail 이 없어요");
  await finder.getByRole("group", { name: "거리" }).getByRole("button", { name: "전체" }).click();

  await list.getByRole("button", { name: /— 합류$/ }).first().click();
  await expect(finder).toHaveCount(0);
  await expect.poll(async () => new URL(b.url()).searchParams.get("trail"), { timeout: 20_000 }).not.toBeNull();
  void trailId;
  await ctxA.close();
  await ctxB.close();
});
