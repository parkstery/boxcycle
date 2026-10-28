import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { stubMapboxStyle } from "./mapbox-stub";
import { readGuestUid } from "./readGuestUid";
import { chooseColosseumIfNeeded, guestStart as sharedGuestStart } from "./rideEntryHelpers";

/**
 * 주행 결과 시트 컴팩트화 — 스크롤 없음 실측 (2026-09-17 Chief).
 *
 * 배경: 결과 시트가 11줄로 정보를 흩뿌리고 있었다. 헤더 → 2열 히어로(새 도로 + 오늘,
 * 완주/진행률 배지) → 보조 수치(+저장 상태) → 저장 폼 한 줄, 4행으로 압축했다
 * (`RideSummarySheet.tsx`/`.css`). 이 spec 은 그 결과를 렌더로 실측한다 — 스크롤 없음,
 * 직계 자식 6개 이하, 제거된 CTA·문구가 정말 사라졌는지.
 *
 * 진입 절차(`guestStart`/`armRideInput`/`loadIntroCourse`)는 `account-panel-tidy.spec.ts`
 * 의 헬퍼를 그대로 복사했다(원본 파일은 수정하지 않는다).
 *
 * 주행 폐기 정책(`lib/ride/rideRecordPolicy.ts`): 거리 100m 초과 + 5초 초과라야 결과 시트가 뜬다.
 * 그래서 HUD 거리 셀을 폴링하며 0.11km 를 넘을 때까지 기다린 뒤 종료한다(체험 속도 50km/h 기준 약 10초).
 *
 * 뷰포트는 반드시 가로(690×275) — 세로면 회전 오버레이가 클릭을 가로챈다(앱은 폰 가로 전용).
 *
 * 실행: npm run test:e2e:ride-summary -w boxcycle-web (headless, 에뮬레이터 자동 배선)
 */

const PHONE_LANDSCAPE = { width: 690, height: 275 };

/*
 * 시험 주행은 **200m 이하 경로**로 한다(2026-09-17 Chief) — 시험 시간을 줄이기 위함이다.
 * 퍼블릭(입문) 경로는 가장 짧은 것이 414m 라 조건을 못 맞춘다. 그래서 `ride-continuation.spec.ts`
 * 와 같은 방식으로 **결정적 SavedRoute 를 에뮬레이터에 직접 심는다**.
 *
 * 길이는 180m — 주행 폐기 임계(100m 초과, `lib/ride/rideRecordPolicy.ts`)에 80m 여유를 두면서
 * 체험 속도 상한 50km/h 로 약 13초면 완주한다.
 */
const PROJECT_ID = "boxcycle-dc2df";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const FIXTURE_NAME = "SUMMARY 200m 이하 픽스처";
const FIXTURE_LAT = 37.5;
const FIXTURE_START_LNG = 127.02;
/** 위도 37.5 에서 경도 1° ≈ 88.3km → 0.00051° ≈ 45m. 5점(4구간) ≈ 180m */
const FIXTURE_STEP_LNG = 0.00051;
const FIXTURE_POINTS = 5;

function fixtureCoordinates(): [number, number][] {
  return Array.from({ length: FIXTURE_POINTS }, (_, i): [number, number] => [
    FIXTURE_START_LNG + i * FIXTURE_STEP_LNG,
    FIXTURE_LAT,
  ]);
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const FIXTURE_LENGTH_M = fixtureCoordinates()
  .slice(1)
  .reduce((sum, c, i) => sum + haversineMeters(fixtureCoordinates()[i]!, c), 0);

function doubleArray(v: [number, number]) {
  return { arrayValue: { values: [{ doubleValue: v[0] }, { doubleValue: v[1] }] } };
}

/** `Authorization: Bearer owner` 는 에뮬레이터에서 rules 를 우회하는 표준 방법이다. */
async function seedShortRoute(uid: string, routeId: string): Promise<void> {
  const coords = fixtureCoordinates();
  const nowIso = new Date().toISOString();
  const body = {
    fields: {
      userId: { stringValue: uid },
      name: { stringValue: FIXTURE_NAME },
      profile: { stringValue: "cycling" },
      startLngLat: doubleArray(coords[0]!),
      endLngLat: doubleArray(coords[coords.length - 1]!),
      geometryType: { stringValue: "LineString" },
      geometryCoordsJson: { stringValue: JSON.stringify(coords) },
      distanceMeters: { doubleValue: FIXTURE_LENGTH_M },
      durationSec: { doubleValue: 60 },
      source: { stringValue: "web" },
      createdAt: { timestampValue: nowIso },
      updatedAt: { timestampValue: nowIso },
      completed: { integerValue: "0" },
      completedAt: { nullValue: null },
      expiresAt: { timestampValue: new Date(Date.now() + 86400000).toISOString() },
      lastRideId: { nullValue: null },
      lastProgressRatio: { doubleValue: 0 },
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
  // 10-24 가장자리 탭이 화면 왼쪽을 덮는다 — 1px 접근성 트리거는 클릭 대신 키보드로 연다(calorie-profile-sync 와 같다).
  await page.getByRole("button", { name: "Trail 메뉴" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "경로 선택" }).click();
  const row = page.getByText(routeName, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await page.getByRole("button", { name: "열기", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 15_000 });
}

/** 촬영·계측 산출물 — 저장소 기준 .out/ (gitignore). 세션 임시폴더에 두면 다음 세션에서 사라진다. */
const SHOTS_DIR = process.env.UI_REVALIDATION_EVIDENCE_DIR ?? path.resolve(process.cwd(), ".out/ride-summary");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

/** 폐기 정책(100m) 위 여유값 — 이보다 커지면 결과 시트가 뜬다고 확신할 수 있다. */
const DISTANCE_THRESHOLD_KM = 0.11;

/** 제거 대상 문구 2종 — 시트 텍스트에 남아 있으면 회귀다. */
const REMOVED_PHRASES = ["내 도로망에 더해졌어요", "다음 출발점이 저장되었습니다"];

test.describe("Start·End 탭이 거리 방향 대기를 끝낸다", () => {
  /*
   * 「여기에서 계속」으로 들어오면 거리 기반 자동 End 선택이 켜진 채 시작한다
   * (rideContinuationSetup 이 보장하는 계약). 이때 거리 탐색을 그만두면 **그 세션까지** 끝나야
   * 한다 — 그만두고도 세션이 살아 있으면 사용자의 지도 누름이 계속 「방향 선택」으로 먹혀
   * End 를 직접 찍을 수 없다(2026-09-18 Chief).
   *
   * 10-23~24 묶음5: 「거리」 켜기·끄기와 캐럿 위치 컨트롤은 「Start·End | 거리·방향」 탭으로,
   * 지점 팝업은 길게 누르기로 바뀌었고, 평상시 방향 안내 문구는 감췄다(상태는 data-phase 로 남는다).
   * 그래서 「그만두기」 = Start·End 탭, 대기 표시 = 반경 원으로 잰다. 숨은 상태 줄의 data-phase 는
   * 탭을 바꿔도 "direction" 으로 남으므로(보이지 않는 값) 들어올 때만 본다.
   */
  test("Start·End 탭으로 바꾸면 반경 원이 사라지고 길게 눌러 End 를 고를 수 있다", async ({ page }) => {
    test.setTimeout(240_000);
    await stubMapboxStyle(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await guestStart(page);
    const uid = await readGuestUid(page);
    await seedShortRoute(uid, `distance-off-${Date.now()}`);
    await page.reload();
    await armRideInput(page);
    await loadSavedRouteFromMenu(page, FIXTURE_NAME);
    await page.getByRole("button", { name: "주행 시작" }).click();

    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet).toBeVisible({ timeout: 120_000 });
    await sheet.getByRole("button", { name: "닫기" }).first().click();
    await expect(sheet).toBeHidden({ timeout: 15_000 });

    await page.getByRole("button", { name: "여기에서 계속" }).click();

    const popup = page.locator(".map-view__pick").last();
    await expect(popup, "「여기에서 계속」이 경로 설정을 연다").toBeVisible({ timeout: 30_000 });
    const distanceTab = popup.getByRole("tab", { name: "거리·방향", exact: true });
    const locationTab = popup.getByRole("tab", { name: "출발·도착", exact: true });
    const distanceView = popup.locator(".map-view__pick-auto-route");
    const locationView = popup.locator(".map-view__pick-route-view--location");
    const directionWait = page.locator('.map-view__pick-auto-route-status[data-phase="direction"]');
    await expect(distanceTab, "들어오면 거리·방향 탭이다").toHaveAttribute("aria-selected", "true");
    await expect(distanceView).toBeVisible();
    await expect(locationView, "거리 탐색 중 Start·End 화면은 숨긴다").toBeHidden();
    await expect(directionWait, "들어오면 방향 선택을 기다린다").toHaveCount(1, { timeout: 20_000 });

    /*
     * 목표 거리 반경 원 — Chief 가 실기기에서 본 **바로 그 표시**다.
     * 안내 문구만 보면 문구는 사라지는데 원은 남는 경우를 놓친다(실제로 놓쳤다).
     */
    const ringOnMap = () =>
      page.evaluate(() => {
        const w = window as Window & { __RTW_MAP__?: { getLayer: (id: string) => unknown } };
        return Boolean(w.__RTW_MAP__?.getLayer("distance-target-circle-line"));
      });
    await expect
      .poll(ringOnMap, { timeout: 20_000, message: "거리 탐색이면 반경 원이 그려진다" })
      .toBe(true);

    // ── 여기서 그만둔다 ──────────────────────────────────────────────────
    await locationTab.click();
    await expect(locationTab).toHaveAttribute("aria-selected", "true");
    await expect(locationView).toBeVisible();
    await expect(distanceView).toBeHidden();
    await expect
      .poll(ringOnMap, { timeout: 15_000, message: "탭을 바꾸면 반경 원도 사라져야 한다" })
      .toBe(false);

    // 지도를 길게 누르면 지점 팝업이 뜨고 End 를 고를 수 있어야 한다.
    const canvas = page.locator("canvas.mapboxgl-canvas").first();
    const box = await canvas.boundingBox();
    expect(box, "지도 캔버스를 찾지 못했다").not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.45);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await page.waitForTimeout(800);

    const afterHold = page.locator(".map-view__pick").last();
    await expect(afterHold, "길게 누르면 지점 팝업이 열린다").toBeVisible({ timeout: 20_000 });
    expect(await ringOnMap(), "그만둔 뒤의 누름이 방향 선택으로 먹히면 안 된다").toBe(false);
    const endBtn = afterHold.getByRole("button", { name: "도착 지점으로 설정", exact: true });
    await expect(endBtn, "사용자가 End 를 직접 고를 수 있어야 한다").toBeEnabled({
      timeout: 15_000,
    });

    /*
     * 버튼이 「눌릴 수 있는지」로는 부족하다 — 눌렀을 때 실제로 그 지점이 End 가 되는지가
     * Chief 가 말한 「원하는 위치를 End 로 지정할 수 없다」의 핵심이다.
     */
    await endBtn.click();
    await page.waitForTimeout(1500);
    const diag = await page.evaluate(() => {
      const dockText = (
        document.querySelector(".route-dock__stops")?.textContent ?? ""
      ).replace(/\s+/g, " ").trim();
      const toggle = document.querySelector(
        ".map-view__pick-distance-mode-checkbox",
      ) as HTMLInputElement | null;
      const w = window as Window & { __RTW_MAP__?: { getLayer: (id: string) => unknown } };
      return {
        dockStops: dockText,
        endBadgeCount: document.querySelectorAll(".route-dock__badge--end").length,
        distanceChecked: toggle ? toggle.checked : null,
        ringBack: Boolean(w.__RTW_MAP__?.getLayer("distance-target-circle-line")),
      };
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "distance-off-diag.json"),
      `${JSON.stringify(diag, null, 2)}
`,
      "utf8",
    );

    expect(diag.ringBack, `End 지정 후 반경 원이 되살아났다: ${JSON.stringify(diag)}`).toBe(false);
    expect(
      diag.distanceChecked === true,
      `End 지정 후 거리 탐색이 다시 켜졌다: ${JSON.stringify(diag)}`,
    ).toBe(false);
    expect(
      diag.endBadgeCount,
      `End 가 주소 카드에 들어오지 않았다: ${JSON.stringify(diag)}`,
    ).toBeGreaterThan(0);
  });
});

test.describe("센서 설정 시트 레이아웃", () => {
  /*
   * 2026-09-18 Chief 6건 중 지금도 유효한 것: ② 버튼 이름 「센서 연결」·「센서 없음」
   * ③ 「현재 입력」 줄과 choice-required 안내 제거 ⑤ 숫자 입력의 증감(스피너) 제거 ⑥ 「＋」 가 숫자 입력 왼쪽.
   *
   * 바뀐 것(10-25 Claude Code, 감리 지시76): ① 제목 한 줄 상태·④ SPD/km/h 두 줄·버튼 22px·
   * 시트 255px·스피드 바 70% 는 Chief 승인 묶음4 시안12(두 칸 시트, 상태는 왼쪽 hero)로 대체됐다 —
   * 패널 경계·글자는 `ui-redesign-batch4.spec.ts` 가 잠근다. 기본 입력은 2026-09-28 Chief 「센서 없음」이라
   * 제목은 「체험 속도」, 상태는 hero 의 「센서 없이 달리기」다.
   */
  test("기본 체험 속도 제목·hero 상태 · 버튼 이름 · 불필요 줄 제거 · 스피너 없음 · ＋/숫자 교체", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    const expand = page.getByRole("button", { name: "경로 패널 펼치기" });
    if (await expand.isVisible().catch(() => false)) await expand.click();
    await page.getByRole("button", { name: /케이던스 센서/ }).click();
    const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // ① 기본 「센서 없음」 — 제목은 체험 속도, 상태는 hero 한 줄.
    await expect(sheet.locator(".cadence-sheet__title")).toHaveText("체험 속도");
    await expect(sheet.locator(".cadence-sheet__status")).toHaveText("센서 없이 달리기");

    // ② 버튼 이름(「센서 연결」 은 BLE 지원 브라우저에서만 나온다 — 묶음4 시험이 따로 본다)
    await expect(sheet.getByRole("button", { name: "센서 없음" })).toBeVisible();

    // ③ 제거된 두 줄
    const text = (await sheet.textContent()) ?? "";
    expect(text.includes("현재 입력"), "「현재 입력」 줄은 제거됐다").toBe(false);
    expect(
      text.includes("센서를 연결해 페달을 확인하거나"),
      "choice-required 안내는 버튼이 대신한다",
    ).toBe(false);

    await sheet.screenshot({ path: path.join(SHOTS_DIR, "sensor-sheet.png") });

    const layout = await page.evaluate(() => {
      const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
      const box = (el: HTMLElement | null) =>
        el
          ? (({ x, y, width, height }) => ({ x, y, width, height }))(el.getBoundingClientRect())
          : null;
      const num = q(".ride-speed-number");
      const steps = Array.from(document.querySelectorAll(".ride-speed-step")) as HTMLElement[];
      const plus = steps.find((b) => (b.textContent ?? "").includes("+")) ?? null;
      return {
        number: box(num),
        plus: box(plus),
        range: box(q(".ride-speed-range")),
        numberAppearance: num ? getComputedStyle(num).appearance : null,
        btnHeights: Array.from(document.querySelectorAll(".cadence-sheet__btn")).map(
          (b) => (b as HTMLElement).getBoundingClientRect().height,
        ),
      };
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "sensor-sheet-layout.json"),
      `${JSON.stringify(layout, null, 2)}
`,
      "utf8",
    );

    for (const k of ["number", "plus", "range"] as const) {
      expect(layout[k], `${k} 를 찾지 못했다`).not.toBeNull();
      expect(layout[k]!.width, `${k} 폭이 0`).toBeGreaterThan(0);
    }

    // 두 선택 버튼은 같은 높이다(묶음4 시안12).
    expect(layout.btnHeights.length, "센서 버튼을 찾지 못했다").toBeGreaterThanOrEqual(2);
    expect(new Set(layout.btnHeights).size, `버튼 높이: ${layout.btnHeights.join(",")}`).toBe(1);

    // ⑤ 스피너 제거 — textfield/none 이면 증감 화살표가 없다.
    expect(["textfield", "none"], `숫자 입력 appearance: ${layout.numberAppearance}`).toContain(
      layout.numberAppearance,
    );

    // ⑥ ＋ 가 숫자 입력보다 왼쪽
    expect(layout.plus!.x, "＋ 가 숫자 입력 왼쪽이어야 한다").toBeLessThan(layout.number!.x);
  });
});

test.describe("RouteDock 센서 안내", () => {
  /*
   * 2026-09-18 Chief: 경로가 잡혔는데 센서 미준비면 센서 칩이 깜빡인다.
   * 같은 날 정한 캐럿 60%·Go 오른쪽 끝·X 여백 같은 자리·크기는 10-24 Chief 고정12
   * (센서·접기가 카드 맨 위 한 줄, ✕ 오른쪽 끝)로 바뀌었고 `e2e/ui-800x360.spec.ts` 「Chief 고정12」가 잠근다.
   * 여기서는 깜빡임만 본다 — **켜지는 쪽과 꺼지는 쪽을 모두** 본다.
   * 한쪽만 보면 「항상 켜짐」·「항상 꺼짐」이 통과해 버린다.
   */
  test("센서 미준비면 깜빡이고 준비하면 멎는다", async ({ page }) => {
    test.setTimeout(180_000);
    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    const uid = await readGuestUid(page);
    await seedShortRoute(uid, `dock-layout-${Date.now()}`);
    await page.reload();

    await loadSavedRouteFromMenu(page, FIXTURE_NAME);
    const chip = page.locator(".route-dock__head .hud-cadence");
    await expect(chip, "주소 카드 맨 위 줄에 센서 칩이 있어야 한다").toBeVisible({ timeout: 15_000 });
    // 2026-09-28 Chief: 기본 입력은 「센서 없음」(체험 속도) — 경로만 올려도 시작할 수 있으므로 깜빡이지 않는다.
    await expect(chip, "기본(센서 없음)은 준비 완료 → 깜빡이지 않는다").not.toHaveClass(
      /hud-cadence--attention/,
    );
    // 센서 모드인데 센서가 준비되지 않은 상태(연결 끊김 등) — 안내가 필요한 바로 그 상태.
    // 단절은 manual 로 자동 복귀하지 않으므로 실제로 생기는 상태다. DEV 훅으로 모드만 바꾼다.
    await page.evaluate(() =>
      (window as unknown as { __rtwSetRideInputMode?: (m: string) => void }).__rtwSetRideInputMode?.("cadence"),
    );
    await expect(chip, "경로가 잡혔는데 센서 미준비 → 깜빡인다").toHaveClass(
      /hud-cadence--attention/,
    );
    await page.locator(".route-dock-anchor").screenshot({
      path: path.join(SHOTS_DIR, "route-dock-sensor-attention.png"),
    });

    // 꺼지는 쪽 — 센서를 준비하면 안내는 소음이므로 멎어야 한다.
    await armRideInput(page);
    await expect(chip, "센서 준비 후에는 깜빡임이 멎는다").not.toHaveClass(
      /hud-cadence--attention/,
      { timeout: 15_000 },
    );
  });
});

test.describe("다음 주행 카드 자리", () => {
  /*
   * 카드가 들고 나도 **RouteDock 이 움직이면 안 된다**(2026-09-17 Chief).
   * 종전엔 둘 다 좌하단 스택에 있었고 스택이 하단 기준이라, 카드가 뜨면 dock 이 위로
   * 밀리고 닫으면 내려왔다. 카드를 우하단으로 빼서 자리를 갈랐다.
   *
   * 선언(CSS right/left)만 보면 축퇴다 — 카드를 실제로 띄웠다 닫으며 dock 의 렌더 좌표가
   * 그대로인지 잰다.
   */
  test("카드가 들고 나도 RouteDock 이 움직이지 않는다 · 카드는 우하단", async ({ page }) => {
    test.setTimeout(240_000);
    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    const uid = await readGuestUid(page);
    await seedShortRoute(uid, `next-ride-pos-${Date.now()}`);
    await page.reload();
    // 새로고침 뒤 「어디에서 시작할까요?」 카드가 늦게 떠 길게 누르기를 가린다 — 먼저 닫는다.
    await chooseColosseumIfNeeded(page, true);
    await armRideInput(page);
    await loadSavedRouteFromMenu(page, FIXTURE_NAME);
    await chooseColosseumIfNeeded(page, false);

    /*
     * 주행이 시작되면 경로 설정 표면이 닫혀야 한다(2026-09-18 Chief).
     * 닫힌 채로 시작해서 「없다」를 확인하면 아무것도 증명하지 못한다 — **먼저 열어 둔다**.
     */
    const pickSurfaces = page.locator(".map-view__pick-dock-panel, .map-view__pick-popup");
    const canvas = page.locator("canvas.mapboxgl-canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox, "지도 캔버스를 찾지 못했다").not.toBeNull();
    // 10-23 묶음5부터 지점 팝업은 길게 눌러 연다(짧은 탭은 지도 조작).
    await page.mouse.move(canvasBox!.x + canvasBox!.width * 0.55, canvasBox!.y + canvasBox!.height * 0.4);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await expect(pickSurfaces.last(), "주행 전에는 지점 팝업이 열린다").toBeVisible({
      timeout: 20_000,
    });

    // 묶음5: 폰 가로에서는 팝업이 주소 카드의 주행 제어를 덮는다 — 사용자가 누르는 팝업의 주행 시작으로 시작한다.
    await pickSurfaces.last().getByRole("button", { name: "주행 시작" }).click();
    await expect(
      pickSurfaces,
      "주행이 시작되면 경로 설정 팝업이 닫혀야 한다",
    ).toHaveCount(0, { timeout: 20_000 });

    /*
     * 주행 중 라이더는 화면 「위 6 : 아래 4」 자리에 앉는다(2026-09-18 Chief) —
     * 지나온 길보다 앞길을 길게 보여 준다. 렌더된 마커의 화면 y 로 잰다.
     */
    await page.waitForTimeout(2500);
    const riderPos = await page.evaluate(() => {
      const el = document.querySelector(".map-view__self-location-host") as HTMLElement | null;
      const mapEl = document.querySelector(".map-view") as HTMLElement | null;
      if (!el || !mapEl) return null;
      const r = el.getBoundingClientRect();
      const m = mapEl.getBoundingClientRect();
      if (!(r.height > 0) || !(m.height > 0)) return null;
      return { ratio: (r.y + r.height / 2 - m.y) / m.height, riderH: r.height, mapH: m.height };
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "rider-screen-pos.json"),
      `${JSON.stringify(riderPos, null, 2)}
`,
      "utf8",
    );
    expect(riderPos, "라이더 마커를 찾지 못했다").not.toBeNull();
    expect(riderPos!.mapH, "지도 높이가 0 이면 계측 실패").toBeGreaterThan(0);
    /*
     * 정확한 0.6 은 순수 계약(`ride-camera-framing-contract.test.ts`)이 수식으로 잡는다.
     * 여기서는 **실제 렌더에서 중앙 아래로 내려갔는지**를 밴드로 본다 — 이 시험 환경은
     * `.map-view` 의 `min-height: 320px` 가 뷰포트(275px)보다 커서 요소 기준 비율이
     * 화면 비율과 정확히 같지 않고, 주행 중 카메라 스무딩도 섞인다.
     * 종전 값은 0.484(중앙)였다 — 회귀하면 이 하한에 걸린다.
     */
    expect(
      riderPos!.ratio,
      `라이더가 화면 중앙보다 아래로 내려와야 한다: ${JSON.stringify(riderPos)}`,
    ).toBeGreaterThan(0.55);
    expect(
      riderPos!.ratio,
      `라이더가 너무 내려가 앞길이 좁아졌다: ${JSON.stringify(riderPos)}`,
    ).toBeLessThan(0.78);

    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet, "도착 자동 종료가 결과 시트를 연다").toBeVisible({ timeout: 120_000 });
    await sheet.getByRole("button", { name: "닫기" }).first().click();
    await expect(sheet).toBeHidden({ timeout: 15_000 });

    /*
     * 묶음3(10-23~25): 종료 뒤 경로가 비면 주소 카드(RouteDock)는 빠지고, 센서만 든 주행 제어 줄이
     * 우하단 시계 위에 남는다. 다음 주행 카드는 그 줄 **위**에 앉는다(RideControlBar.css --with-next).
     * 그래서 「움직이면 안 되는 것」은 이제 그 센서 칩이다.
     */
    const card = page.locator(".next-ride-anchor");
    const barDiag = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".ride-control-anchor, .ride-control-bar, .ride-control-bar .hud-cadence")).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { cls: (el as HTMLElement).className, x: r.x, y: r.y, w: r.width, h: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
      }),
    );
    fs.writeFileSync(path.join(SHOTS_DIR, "next-ride-bar-diag.json"), `${JSON.stringify(barDiag, null, 2)}
`, "utf8");
    const dock = page.locator(".route-dock__led-toggle");
    await expect(dock, `센서 LED가 보여야 한다: ${JSON.stringify(barDiag)}`).toBeVisible({ timeout: 20_000 });
    await expect(card, "종료 후 idle 에서 「다음 주행」 카드가 뜬다").toBeVisible({
      timeout: 20_000,
    });

    const dockWithCard = await dock.boundingBox();
    const cardBox = await card.boundingBox();

    // 축퇴 방어 — 상자를 못 찾았으면 「안 움직였다」는 공허하다.
    expect(dockWithCard, "dock boundingBox").not.toBeNull();
    expect(dockWithCard!.height, "dock 높이").toBeGreaterThan(0);
    expect(cardBox, "카드 boundingBox").not.toBeNull();
    expect(cardBox!.width, "카드 폭").toBeGreaterThan(0);

    // 카드는 화면 오른쪽 절반에 있다
    expect(
      cardBox!.x,
      `카드가 우하단에 있어야 한다: x=${cardBox!.x}, viewport=${PHONE_LANDSCAPE.width}`,
    ).toBeGreaterThan(PHONE_LANDSCAPE.width / 2);
    // 카드는 센서 줄 위에 있다 — 덮지 않는다.
    expect(
      cardBox!.y + cardBox!.height,
      `카드가 센서 칩을 덮는다: cardBottom=${cardBox!.y + cardBox!.height}, chipTop=${dockWithCard!.y}`,
    ).toBeLessThanOrEqual(dockWithCard!.y + 1);

    /*
     * 자리는 기존 UI 격자에 맞춘다 — 「우하단」이라는 방향만으로는 부족하고,
     * 이미 있는 컨트롤과의 관계로 기준선을 잡아야 한다.
     *  · 오른쪽 끝 = 우상단 계정·맵 버튼(.map-hud__tr)의 오른쪽 끝
     *  · 아래 끝   = 시계(.hud-clock) 위 ≥8px (지시 12 · Chief 2026-10-06)
     *    종전 「RouteDock 아래 끝과 같은 선」은 카드가 시계를 덮어 Chief 가 거부.
     * CSS 선언이 같은지가 아니라 **렌더된 상자 좌표**가 같은지를 본다.
     */
    const trBox = await page.locator(".map-hud__tr").boundingBox();
    expect(trBox, "우상단 계정·맵 묶음 boundingBox").not.toBeNull();
    expect(trBox!.width, "우상단 묶음 폭").toBeGreaterThan(0);
    // 10-06 이후 지도 컨트롤은 Mapbox 기본 묶음이 아니라 앱의 「맵 제어」 묶음(스타일·＋·−)이다.
    const ctrlBox = await page.getByRole("group", { name: "맵 제어" }).boundingBox();
    const clockBox = await page.locator(".hud-clock").boundingBox();
    expect(clockBox, "시계 boundingBox").not.toBeNull();
    expect(clockBox!.height, "시계 높이").toBeGreaterThan(0);

    expect(
      cardBox!.x + cardBox!.width,
      `카드 오른쪽 끝이 계정·맵 버튼과 같은 선이어야 한다: card=${cardBox!.x + cardBox!.width}, tr=${trBox!.x + trBox!.width}`,
    ).toBeCloseTo(trBox!.x + trBox!.width, 0);
    expect(
      cardBox!.y + cardBox!.height,
      `카드 아래 끝이 시계 위 끝보다 8px 이상 위여야 한다: cardBottom=${cardBox!.y + cardBox!.height}, clockTop=${clockBox!.y}`,
    ).toBeLessThan(clockBox!.y - 8);

    /*
     * 정렬을 기준선에 맞추면 폰 가로(세로 275px)에서는 카드 상단이 우측 지도 컨트롤 열까지
     * 올라온다. 상자가 겹치는 것 자체보다 **버튼이 실제로 눌리는가**가 문제이므로 그것을 잰다.
     */
    const ctrlHit = await page.evaluate(() => {
      const group = document.querySelector('[role="group"][aria-label="맵 제어"]');
      if (!group) return null;
      const btns = Array.from(group.querySelectorAll("button")) as HTMLElement[];
      return btns.map((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          label: b.className,
          reachable: hit ? b === hit || b.contains(hit) : false,
        };
      });
    });
    expect(ctrlHit, "지도 컨트롤 버튼을 찾아야 한다").not.toBeNull();
    expect(ctrlHit!.length, "컨트롤 버튼이 0개면 계측 실패").toBeGreaterThan(0);
    const blocked = ctrlHit!.filter((b) => !b.reachable).map((b) => b.label);
    expect(blocked, `카드가 지도 컨트롤 버튼을 막는다: ${blocked.join(", ")}`).toEqual([]);

    await page.screenshot({ path: path.join(SHOTS_DIR, "next-ride-card-right.png") });

    // 카드를 닫는다 — 이때 dock 이 내려오면(=움직이면) 그게 Chief 가 지적한 현상이다.
    await page.getByRole("button", { name: "다음 주행 숨기기" }).click();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
    const dockWithoutCard = await dock.boundingBox();
    expect(dockWithoutCard, "카드 닫은 뒤 dock boundingBox").not.toBeNull();

    fs.writeFileSync(
      path.join(SHOTS_DIR, "next-ride-card-position.json"),
      `${JSON.stringify({ dockWithCard, cardBox, dockWithoutCard, trBox, ctrlBox }, null, 2)}
`,
      "utf8",
    );

    expect(
      dockWithoutCard!.y,
      `카드가 닫히자 센서 칩이 움직였다: 카드있음 y=${dockWithCard!.y}, 카드없음 y=${dockWithoutCard!.y}`,
    ).toBeCloseTo(dockWithCard!.y, 0);
    expect(dockWithoutCard!.x, "센서 칩 x 도 그대로여야 한다").toBeCloseTo(dockWithCard!.x, 0);
  });
});

test.describe("주행 결과 시트 컴팩트화", () => {
  test("스크롤 없음 · 6줄 이하 · 끝점 CTA 제거 · 설명문 제거", async ({ page }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });

    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    // 200m 이하 경로를 심고 그것으로 달린다(Chief) — 완주까지 약 13초.
    const uid = await readGuestUid(page);
    await seedShortRoute(uid, `summary-compact-${Date.now()}`);
    await page.reload();
    await armRideInput(page);
    await loadSavedRouteFromMenu(page, FIXTURE_NAME);

    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeEnabled({ timeout: 30_000 });

    /*
     * 끝까지 달려 **완주 상태**의 시트를 본다 — 「완주」 배지는 완주해야만 뜨므로
     * 부분 주행만 재면 새 표면의 절반을 시험하지 않는 셈이다.
     * 도착하면 자동 종료가 결과 시트를 열어 주므로 「주행 종료」를 누르지 않는다.
     */
    await expect
      .poll(() => readCumulativeKm(page), {
        message: "HUD 누적 거리가 0.11km 를 넘어야 결과 시트가 뜬다(폐기 정책: 100m 초과)",
        timeout: 120_000,
        intervals: [500],
      })
      .toBeGreaterThan(DISTANCE_THRESHOLD_KM);

    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet, "도착 자동 종료가 결과 시트를 연다").toBeVisible({ timeout: 120_000 });
    // 「완주」·「도착」 배지는 제거됐다(2026-09-17 Chief) — 되살아나면 잡는다.
    // 완주의 증거는 아래 「주행거리 = 총거리」다.
    await expect(sheet.locator(".ride-summary__heroes-badge--done")).toHaveCount(0);
    expect(((await sheet.textContent()) ?? "").includes("도착"), "「도착」 배지 제거").toBe(false);

    /*
     * 「이번 주행」 세 값 — 주행거리 / 총거리 / 새 도로(2026-09-17 Chief).
     * 단위 km 는 헤더가 한 번만 말하고 숫자에는 붙지 않는다. 「오늘」(하루 누적)은 빠졌다.
     */
    const pair = sheet.getByLabel("주행 거리 / 경로 전체거리");
    await expect(pair, "주행거리 / 총거리 쌍이 있어야 한다").toBeVisible();
    // 2026-10-08 — 큰 숫자 「0.17 / 0.18」 칸이 진행 블록(「0.18km 완주」·막대)으로 바뀌었다.
    // 숫자 계약은 화면 문구가 아니라 data-* 로 읽는다.
    const riddenKm = Number(await pair.getAttribute("data-ridden-km"));
    const totalKm = Number(await pair.getAttribute("data-total-km"));
    const pairText = `${riddenKm} / ${totalKm}`;
    expect(totalKm, `총거리를 읽지 못했다: ${pairText}`).toBeGreaterThan(0);
    await expect(pair, "완주 블록은 「완주」를 말한다").toContainText("완주");
    // 완주했으므로 앞뒤가 같아야 한다 — Chief 예시 「완주 시 0.5 / 0.5」.
    expect(riddenKm, `완주인데 주행거리≠총거리: ${pairText}`).toBeCloseTo(totalKm, 2);
    // 200m 이하 경로로 달렸는지 — 시험 시간 규율 자체를 계약으로 고정한다.
    expect(totalKm, `시험 경로는 200m 이하여야 한다: ${totalKm}km`).toBeLessThanOrEqual(0.2);

    await expect(sheet.locator(".ride-summary__title-unit"), "단위는 헤더에 한 번").toHaveText("km");

    /*
     * 「새 도로」는 **타이틀 줄**이다 — 라벨이 숫자 **바로 위**, 칸은 주행/전체 **오른쪽**
     * (2026-10-06 Chief, 종전 2026-09-17 「라벨이 숫자 왼쪽 한 줄」을 대체).
     * 에뮬레이터에서 conquest 는 Cloud Function 이 늦게 채워 촬영 시점엔 「확인 중…」일 수
     * 있다. 그래서 눈이 아니라 **배치 자체**를 잰다 — 값이 오든 안 오든 참이어야 하는 성질이다.
     */
    const conquestBox = sheet.locator(".ride-summary__conquest-hero");
    if ((await conquestBox.count()) > 0) {
      const layout = await conquestBox.evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const label = el.querySelector(".ride-summary__conquest-label");
        const value = el.querySelector(".ride-summary__conquest-value");
        const pair = el.parentElement?.querySelector(".ride-summary__progress");
        return {
          flexDirection: cs.flexDirection,
          height: Math.round(r.height),
          boxX: Math.round(r.x),
          pairX: pair ? Math.round(pair.getBoundingClientRect().x) : null,
          labelBottom: label ? Math.round(label.getBoundingClientRect().bottom) : null,
          valueTop: value ? Math.round(value.getBoundingClientRect().top) : null,
        };
      });
      expect(layout.height, "새 도로 칸 높이가 0 이면 계측 실패").toBeGreaterThan(0);
      expect(layout.flexDirection, "새 도로는 라벨 위·값 아래(세로 배치)").toBe("column");
      if (layout.labelBottom != null && layout.valueTop != null) {
        expect(layout.labelBottom, "「새 도로」 라벨이 숫자 위에 있어야 한다").toBeLessThanOrEqual(
          layout.valueTop,
        );
      }
      if (layout.pairX != null) {
        expect(layout.boxX, "새 도로 칸은 주행/전체 칸 오른쪽").toBeGreaterThan(layout.pairX);
      }
    }
    /*
     * 스토리 줄(2026-10-07 Chief) — 숫자 위에 사람에게 건네는 한 줄. 종전 「오늘(하루 누적)은
     * 이 화면이 답할 질문이 아니다」(2026-09-17)를 뒤집는다: 오늘 몇 번째·합계가 칭찬의 근거다.
     * 완주했으므로 헤드라인은 완주를 말한다.
     */
    await expect(sheet.locator(".ride-summary__story-headline"), "스토리 헤드라인").toContainText("완주");

    await page.screenshot({ path: path.join(SHOTS_DIR, "summary-compact.png") });
    // 시트만 크롭 — 뷰포트 축소 없이 4행 전체가 실제로 그려졌는지 육안 확인용(보조 산출물).
    await sheet.screenshot({ path: path.join(SHOTS_DIR, "summary-compact-sheet.png") });

    const measured = await sheet.evaluate((el) => {
      const children = Array.from(el.children) as HTMLElement[];
      const visibleChildren = children.filter((c) => c.getBoundingClientRect().height > 0);
      const rect = el.getBoundingClientRect();
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        childCount: children.length,
        visibleChildCount: visibleChildren.length,
        childTags: visibleChildren.map((c) => `${c.tagName}.${c.className}`),
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        sheetBox: { top: rect.top, bottom: rect.bottom, height: rect.height },
      };
    });

    const extendButtonCount = await sheet
      .getByRole("button", { name: /끝점에서 새 경로|지금 새 경로 연결/ })
      .count();

    const missingPhrases = REMOVED_PHRASES.filter((p) => measured.text.includes(p));

    fs.writeFileSync(
      path.join(SHOTS_DIR, "summary-compact.json"),
      `${JSON.stringify(
        {
          viewport: PHONE_LANDSCAPE,
          scrollHeight: measured.scrollHeight,
          clientHeight: measured.clientHeight,
          sheetBox: measured.sheetBox,
          visibleChildCount: measured.visibleChildCount,
          childTags: measured.childTags,
          extendButtonCount,
          removedPhrasesStillPresent: missingPhrases,
          sheetText: measured.text,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    // ── M0: 축퇴 방어 — 0 이거나 못 찾았으면 "스크롤 없음"이 아니라 계측 실패다 ──
    expect(measured.scrollHeight, "sheet scrollHeight 가 0 이면 계측 실패").toBeGreaterThan(0);
    expect(measured.clientHeight, "sheet clientHeight 가 0 이면 계측 실패").toBeGreaterThan(0);
    expect(measured.visibleChildCount, "직계 자식이 0 이면 계측 실패").toBeGreaterThan(0);

    // ── 본 단언 1: 스크롤 없음 — scrollHeight == clientHeight ──────────────
    expect(
      measured.scrollHeight,
      `시트가 스크롤된다: scrollHeight=${measured.scrollHeight}, clientHeight=${measured.clientHeight}`,
    ).toBe(measured.clientHeight);

    // ── 본 단언 1b: 시트 전체가 뷰포트 안에 들어온다(내부뿐 아니라 화면상으로도 안 잘림) ──
    expect(
      measured.sheetBox.top,
      `시트 상단이 뷰포트 위로 잘린다: ${JSON.stringify(measured.sheetBox)}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      measured.sheetBox.bottom,
      `시트 하단이 뷰포트(${PHONE_LANDSCAPE.height}px) 아래로 잘린다: ${JSON.stringify(measured.sheetBox)}`,
    ).toBeLessThanOrEqual(PHONE_LANDSCAPE.height);

    // ── 본 단언 2: 줄 수 6 이하 ─────────────────────────────────────────────
    expect(
      measured.visibleChildCount,
      `시트 직계 자식(줄)이 6개를 넘는다: ${JSON.stringify(measured.childTags)}`,
    ).toBeLessThanOrEqual(6);

    // ── 본 단언 3: 「끝점에서 새 경로」/「지금 새 경로 연결」 버튼 0개 ────────
    expect(extendButtonCount, "끝점에서 새 경로 CTA 가 남아 있으면 안 된다").toBe(0);

    // ── 본 단언 4: 제거한 설명문 2종이 시트 텍스트에 없다 ─────────────────
    expect(
      missingPhrases,
      `제거했어야 할 문구가 남아 있다: ${JSON.stringify(missingPhrases)}`,
    ).toEqual([]);
  });
});

/** HUD 누적 거리 셀에서 선두 숫자(현재까지 달린 km)를 읽는다. */
async function readCumulativeKm(page: Page): Promise<number> {
  const value = page.locator(".hud-metrics__cell--w-distance .hud-metrics__value").first();
  const text = (await value.textContent().catch(() => null)) ?? "";
  const match = text.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : NaN;
}

// ── 아래는 account-panel-tidy.spec.ts 의 진입 헬퍼를 그대로 복사한 것.
//    원본 파일은 수정하지 않는다.

async function guestStart(page: Page) {
  await sharedGuestStart(page);
}

/*
 * 체험 속도를 올려 시험 시간을 줄인다 — `ride-continuation.spec.ts` 의
 * `prepareManualRideInput(page, 50)` 과 같은 수법이다. 주행 로직은 동일하고 속도만 바뀐다.
 * 기본 속도(약 5km/h)로 두면 폐기 임계(100m 초과)를 넘기는 데만 80초가 넘게 걸린다 —
 * 짧은 거리를 재는 시험에 그 시간을 쓸 이유가 없다(2026-09-17 Chief).
 */
async function armRideInput(page: Page, speedKmh = 50) {
  const expand = page.getByRole("button", { name: "경로 패널 펼치기" });
  if (await expand.isVisible().catch(() => false)) await expand.click();
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

