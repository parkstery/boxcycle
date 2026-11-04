/**
 * 11-04 Chief:
 *  ① 「지금 달리는 trail 에서 클릭하면 참여가 가능했었으나 현재는 클릭은 되지만 참여가 안 된다」
 *     — 폰 가로(800×360)에서 오른쪽 Trail 목록 줄 끝 「합류」 단추가 지도 조작(맵 스타일 원)에 덮여
 *       누름이 지도 단추로 갔다. 줄 전체를 누르면 합류하도록 고쳤다.
 *  ② 「trail에 참여한 사용자가 주행을 하지 않고 다시 trail을 빠져나오는 기능이 없다」
 *     — 폰 가로에선 HUD 「Trailhead로」 패널이 숨겨져 창구가 없었다. 메뉴 「현재 Trail N」 줄에 「나가기」.
 *
 * 실앱 + 에뮬레이터(auth·firestore·database·functions): A 가 입문 경로로 주행을 시작해 공개 Trail 을 열고,
 * B(게스트)가 메뉴 → 지금 달리는 Trail → 줄 누르기로 합류, 메뉴 「나가기」로 Trailhead 로 돌아온다.
 */
import { test, expect } from "./open-meteo-stub";
import { guestStart, loadIntroCourse, prepareManualRideInput } from "./rideEntryHelpers";

test.setTimeout(180_000);

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
  await b.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trailhead");
  await expect(menu.getByRole("button", { name: "Trail 나가기", exact: true })).toHaveCount(0);
  await expect(menu.locator(".trail-hub__show-list")).toContainText("1개", { timeout: 30_000 });
  await menu.locator(".trail-hub__show-list").click();

  // 줄 끝 합류 단추는 이 폭에서 지도 조작에 덮인다 — 사람이 보이는 줄(번호·이름 쪽)을 누른다.
  const row = b.locator(".lb-glance__row--trail").first();
  await expect(row).toBeVisible();
  await row.locator(".lb-glance__name").click();
  await expect.poll(async () => new URL(b.url()).searchParams.get("trail"), { timeout: 20_000 }).toBe(trailId);

  await b.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trail");
  await expect(menu.locator(".trail-hub__context")).not.toContainText("Trailhead");
  const leave = menu.getByRole("button", { name: "Trail 나가기", exact: true });
  await expect(leave).toBeVisible();
  await leave.click();
  await expect(menu.locator(".trail-hub__context")).toContainText("Trailhead");
  await expect(leave).toHaveCount(0);
  await expect.poll(async () => new URL(b.url()).searchParams.get("trail")).toBeNull();

  await ctxA.close();
  await ctxB.close();
});
