import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { stubMapboxStyle } from "./mapbox-stub";
import { readGuestUid } from "./readGuestUid";

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
 * 주행 폐기 정책(`lib/rideRecordPolicy.ts`): 거리 100m 초과 + 5초 초과라야 결과 시트가 뜬다.
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
 * 길이는 180m — 주행 폐기 임계(100m 초과, `lib/rideRecordPolicy.ts`)에 80m 여유를 두면서
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
  await page.getByRole("button", { name: "Trail 메뉴" }).click();
  await page.getByRole("button", { name: "내 경로 목록" }).click();
  const row = page.getByText(routeName, { exact: false }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await page.getByRole("button", { name: "열기" }).first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 15_000 });
}

/** chief 가 지정한 촬영/계측 저장 위치 — 세션 scratchpad 하위 shots/ */
const SHOTS_DIR =
  "C:/Users/kdrea/AppData/Local/Temp/claude/C--20-HDev-boxcycle/2e5b96fa-d86d-4f15-9fe4-c5294d9318f9/scratchpad/shots";

/** 폐기 정책(100m) 위 여유값 — 이보다 커지면 결과 시트가 뜬다고 확신할 수 있다. */
const DISTANCE_THRESHOLD_KM = 0.11;

/** 제거 대상 문구 2종 — 시트 텍스트에 남아 있으면 회귀다. */
const REMOVED_PHRASES = ["내 도로망에 더해졌어요", "다음 출발점이 저장되었습니다"];

test.describe("센서 설정 시트 레이아웃", () => {
  /*
   * 2026-09-18 Chief 6건: ① 제목과 연결 상태를 한 줄 ② 버튼 이름 「센서 연결」·「센서 없음」
   * ③ 「현재 입력」 줄과 choice-required 안내 제거 ④ SPD / km/h 두 줄
   * ⑤ 숫자 입력의 증감(스피너) 제거 ⑥ 숫자 입력과 「＋」 위치 교체.
   */
  test("제목 한 줄 · 버튼 이름 · 불필요 줄 제거 · SPD 2줄 · 스피너 없음 · ＋/숫자 교체", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    await page.getByRole("button", { name: /케이던스 센서/ }).click();
    const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // ① 제목 한 줄 — 제목과 상태가 같은 요소 안에 있다.
    const title = sheet.locator(".cadence-sheet__title");
    await expect(title).toContainText("케이던스 센서");
    await expect(title.locator(".cadence-sheet__title-status")).toHaveText(/연결됨|연결 안 됨|연결 중|지원 안 됨/);

    // ② 버튼 이름
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
        name: box(q(".ride-speed-kicker__name")),
        unit: box(q(".ride-speed-kicker__unit")),
        number: box(num),
        plus: box(plus),
        range: box(q(".ride-speed-range")),
        panel: box(q(".cadence-sheet__panel")),
        numberAppearance: num ? getComputedStyle(num).appearance : null,
      };
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "sensor-sheet-layout.json"),
      `${JSON.stringify(layout, null, 2)}
`,
      "utf8",
    );

    for (const k of ["name", "unit", "number", "plus"] as const) {
      expect(layout[k], `${k} 를 찾지 못했다`).not.toBeNull();
      expect(layout[k]!.width, `${k} 폭이 0`).toBeGreaterThan(0);
    }

    // ④ SPD 아래에 km/h — 두 줄이다(같은 줄이면 y 가 같다).
    expect(layout.unit!.y, "km/h 가 SPD 아래 줄이어야 한다").toBeGreaterThan(layout.name!.y);

    // ⑤ 스피너 제거 — textfield/none 이면 증감 화살표가 없다.
    expect(["textfield", "none"], `숫자 입력 appearance: ${layout.numberAppearance}`).toContain(
      layout.numberAppearance,
    );

    /*
     * 스피드 바를 종전의 70% 로, 시트 폭도 그만큼(2026-09-18 Chief).
     * 바는 `flex: 1 1 auto` 라 시트에서 뺀 폭이 그대로 바에서 빠진다 —
     * 실측 172.20 → 120.48px(70.0%), 시트 297.00 → 245.28px.
     * 폰 가로 루트 13.5px 기준의 값이라 여유 밴드로 잡는다.
     */
    expect(layout.range, "스피드 바를 찾지 못했다").not.toBeNull();
    expect(layout.panel, "시트 패널을 찾지 못했다").not.toBeNull();
    expect(layout.range!.width, `스피드 바 폭: ${layout.range!.width}`).toBeGreaterThan(112);
    expect(layout.range!.width, `스피드 바 폭: ${layout.range!.width}`).toBeLessThan(129);
    expect(layout.panel!.width, `시트 폭: ${layout.panel!.width}`).toBeLessThan(255);

    // ⑥ ＋ 가 숫자 입력보다 왼쪽
    expect(layout.plus!.x, "＋ 가 숫자 입력 왼쪽이어야 한다").toBeLessThan(layout.number!.x);
  });
});

test.describe("RouteDock 레이아웃", () => {
  /*
   * 2026-09-18 Chief 5건: ① 경로가 잡혔는데 센서 미준비면 SENSOR 칩이 깜빡인다
   * ② 캐럿 폭 60% ③ 칩·주소를 왼쪽 끝까지 ④ Go 는 줄의 오른쪽 끝 ⑤ 삭제(X) 오른쪽 2px.
   *
   * 선언이 아니라 렌더된 상자로 잰다. 특히 ①은 **켜지는 쪽과 꺼지는 쪽을 모두** 본다 —
   * 한쪽만 보면 「항상 켜짐」·「항상 꺼짐」이 통과해 버린다.
   */
  test("센서 안내 깜빡임 · 캐럿 60% · 왼쪽 밀착 · Go 우측 끝 · X 여백", async ({ page }) => {
    test.setTimeout(180_000);
    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    const uid = await readGuestUid(page);
    await seedShortRoute(uid, `dock-layout-${Date.now()}`);
    await page.reload();

    // 센서를 준비하지 **않은 채** 경로만 올린다 — 안내가 필요한 바로 그 상태.
    await loadSavedRouteFromMenu(page, FIXTURE_NAME);
    const chip = page.locator(".route-dock__top .hud-cadence");
    await expect(chip, "dock 에 센서 칩이 있어야 한다").toBeVisible({ timeout: 15_000 });
    await expect(chip, "경로가 잡혔는데 센서 미준비 → 깜빡인다").toHaveClass(
      /hud-cadence--attention/,
    );

    const layout = await page.evaluate(() => {
      const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
      const box = (el: HTMLElement | null) =>
        el
          ? (({ x, y, width, height }) => ({ x, y, width, height }))(el.getBoundingClientRect())
          : null;
      return {
        caret: box(q(".route-dock__caret")),
        chip: box(q(".route-dock__top .hud-cadence")),
        go: box(q(".route-dock__go")),
        top: box(q(".route-dock__top")),
        removeBtn: box(q(".route-dock__stop-remove")),
        stops: box(q(".route-dock__stops")),
      };
    });
    await page.locator(".route-dock-anchor").screenshot({
      path: path.join(SHOTS_DIR, "route-dock-layout.png"),
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "route-dock-layout.json"),
      `${JSON.stringify(layout, null, 2)}
`,
      "utf8",
    );

    // M0 축퇴 방어 — 하나라도 못 찾으면 아래 비교는 공허하다.
    for (const [k, v] of Object.entries(layout)) {
      expect(v, `${k} 를 찾지 못했다`).not.toBeNull();
      expect((v as { width: number }).width, `${k} 폭이 0`).toBeGreaterThan(0);
    }

    // ② 캐럿 폭 = 0.93rem (종전 1.55rem 의 60%). 루트 13.5px 기준 약 12.55px.
    expect(layout.caret!.width, `캐럿 폭: ${layout.caret!.width}`).toBeGreaterThan(11);
    expect(layout.caret!.width, `캐럿 폭: ${layout.caret!.width}`).toBeLessThan(14);

    // ③ 칩이 캐럿 바로 오른쪽 — 왼쪽에 빈 공간이 없다.
    expect(
      layout.chip!.x,
      `캐럿 오른쪽 끝(${layout.caret!.x + layout.caret!.width})과 칩 왼쪽(${layout.chip!.x}) 사이에 빈 공간`,
    ).toBeCloseTo(layout.caret!.x + layout.caret!.width, 0);

    // ④ Go 가 줄의 오른쪽 끝 — 칩 바로 옆이 아니다.
    const rowRight = layout.top!.x + layout.top!.width;
    const goRight = layout.go!.x + layout.go!.width;
    expect(rowRight - goRight, `Go 가 줄 오른쪽 끝에서 멀다: ${rowRight - goRight}px`).toBeLessThan(
      10,
    );
    expect(
      layout.go!.x - (layout.chip!.x + layout.chip!.width),
      "Go 가 SENSOR 바로 옆에 붙어 있다",
    ).toBeGreaterThan(40);

    // ⑤ 삭제(X) 오른쪽 여백 2px
    const gap = layout.stops!.x + layout.stops!.width - (layout.removeBtn!.x + layout.removeBtn!.width);
    expect(gap, `X 버튼 오른쪽 여백: ${gap}px`).toBeGreaterThanOrEqual(1.5);
    expect(gap, `X 버튼 오른쪽 여백: ${gap}px`).toBeLessThanOrEqual(4);

    // ① 꺼지는 쪽 — 센서를 준비하면 안내는 소음이므로 멎어야 한다.
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
    await armRideInput(page);
    await loadSavedRouteFromMenu(page, FIXTURE_NAME);
    await page.getByRole("button", { name: "주행 시작" }).click();

    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet, "도착 자동 종료가 결과 시트를 연다").toBeVisible({ timeout: 120_000 });
    await sheet.getByRole("button", { name: "닫기" }).first().click();
    await expect(sheet).toBeHidden({ timeout: 15_000 });

    const dock = page.locator(".route-dock-anchor");
    const card = page.locator(".next-ride-anchor");
    await expect(dock).toBeVisible({ timeout: 20_000 });
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
    // dock 은 왼쪽에 그대로
    expect(dockWithCard!.x, "dock 은 좌하단").toBeLessThan(PHONE_LANDSCAPE.width / 2);

    /*
     * 자리는 기존 UI 격자에 맞춘다(2026-09-17 Chief) — 「우하단」이라는 방향만으로는
     * 부족하고, 이미 있는 컨트롤과의 관계로 기준선을 잡아야 한다.
     *  · 오른쪽 끝 = 우상단 계정·맵 버튼(.map-hud__tr)의 오른쪽 끝
     *  · 아래 끝   = RouteDock 의 아래 끝
     * CSS 선언이 같은지가 아니라 **렌더된 상자 좌표**가 같은지를 본다.
     */
    const trBox = await page.locator(".map-hud__tr").boundingBox();
    expect(trBox, "우상단 계정·맵 묶음 boundingBox").not.toBeNull();
    expect(trBox!.width, "우상단 묶음 폭").toBeGreaterThan(0);
    const ctrlBox = await page.locator(".mapboxgl-ctrl-top-right").boundingBox();

    expect(
      cardBox!.x + cardBox!.width,
      `카드 오른쪽 끝이 계정·맵 버튼과 같은 선이어야 한다: card=${cardBox!.x + cardBox!.width}, tr=${trBox!.x + trBox!.width}`,
    ).toBeCloseTo(trBox!.x + trBox!.width, 0);
    expect(
      cardBox!.y + cardBox!.height,
      `카드 아래 끝이 RouteDock 아래 끝과 같은 선이어야 한다: card=${cardBox!.y + cardBox!.height}, dock=${dockWithCard!.y + dockWithCard!.height}`,
    ).toBeCloseTo(dockWithCard!.y + dockWithCard!.height, 0);

    /*
     * 정렬을 기준선에 맞추면 폰 가로(세로 275px)에서는 카드 상단이 우측 지도 컨트롤 열까지
     * 올라온다. 상자가 겹치는 것 자체보다 **버튼이 실제로 눌리는가**가 문제이므로 그것을 잰다.
     */
    const ctrlHit = await page.evaluate(() => {
      const group = document.querySelector(".mapboxgl-ctrl-top-right .mapboxgl-ctrl-group");
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
      `카드가 닫히자 dock 이 움직였다: 카드있음 y=${dockWithCard!.y}, 카드없음 y=${dockWithoutCard!.y}`,
    ).toBeCloseTo(dockWithCard!.y, 0);
    expect(dockWithoutCard!.x, "dock x 도 그대로여야 한다").toBeCloseTo(dockWithCard!.x, 0);
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
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

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
    const pairText = ((await pair.textContent()) ?? "").trim();
    expect(pairText, `「N.NN / N.NN」 형식이어야 하고 단위가 붙으면 안 된다: ${pairText}`).toMatch(
      /^\d+\.\d{2}\s*\/\s*\d+\.\d{2}$/,
    );
    const [riddenKm, totalKm] = pairText.split("/").map((v) => Number(v.trim()));
    // 완주했으므로 앞뒤가 같아야 한다 — Chief 예시 「완주 시 0.5 / 0.5」.
    expect(riddenKm, `완주인데 주행거리≠총거리: ${pairText}`).toBeCloseTo(totalKm, 2);
    // 200m 이하 경로로 달렸는지 — 시험 시간 규율 자체를 계약으로 고정한다.
    expect(totalKm, `시험 경로는 200m 이하여야 한다: ${totalKm}km`).toBeLessThanOrEqual(0.2);

    await expect(sheet.locator(".ride-summary__title-unit"), "단위는 헤더에 한 번").toHaveText("km");

    /*
     * 「새 도로」는 한 줄이다 — 라벨이 숫자 **왼쪽**에 앉는다(2026-09-17 Chief).
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
        return {
          flexDirection: cs.flexDirection,
          height: Math.round(r.height),
          labelX: label ? Math.round(label.getBoundingClientRect().x) : null,
          valueX: value ? Math.round(value.getBoundingClientRect().x) : null,
        };
      });
      expect(layout.height, "새 도로 칸 높이가 0 이면 계측 실패").toBeGreaterThan(0);
      expect(layout.flexDirection, "새 도로는 한 줄(가로 배치)이어야 한다").toBe("row");
      if (layout.labelX != null && layout.valueX != null) {
        expect(layout.labelX, "「새 도로」 라벨이 숫자 왼쪽에 있어야 한다").toBeLessThan(
          layout.valueX,
        );
      }
    }
    expect(
      ((await sheet.textContent()) ?? "").includes("오늘"),
      "「오늘」(하루 누적)은 이 화면이 답할 질문이 아니다",
    ).toBe(false);

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
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

/*
 * 체험 속도를 올려 시험 시간을 줄인다 — `ride-continuation.spec.ts` 의
 * `prepareManualRideInput(page, 50)` 과 같은 수법이다. 주행 로직은 동일하고 속도만 바뀐다.
 * 기본 속도(약 5km/h)로 두면 폐기 임계(100m 초과)를 넘기는 데만 80초가 넘게 걸린다 —
 * 짧은 거리를 재는 시험에 그 시간을 쓸 이유가 없다(2026-09-17 Chief).
 */
async function armRideInput(page: Page, speedKmh = 50) {
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

