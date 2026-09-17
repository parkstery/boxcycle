import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { stubMapboxStyle } from "./mapbox-stub";

/**
 * HUD 거리 1줄화 + 표고 그래프 진행률 라벨 — 렌더 검증 하네스 (2026-09-17).
 *
 * 검증 대상(작업 트리에 이미 적용됨, 이 spec 은 로직을 바꾸지 않는다):
 *  - `MapHud.tsx`/`.css`: 상단 HUD 「거리」 셀 2줄 → 1줄(`0.03 / 0.16 km`).
 *  - `MapView.tsx`/`.css`, `mapElevationUi.ts`: 표고 그래프 마커에 `NN%` 라벨.
 *    `.elevation-overlay__progress` 는 `yPct < 20` 이면 `--below` 가 붙어 점 아래로 뒤집힌다.
 *
 * 진입 절차는 `ride-entry.spec.ts`/`touch-targets-44.spec.ts` 의 게스트→입문 코스→주행 시작
 * 헬퍼를 그대로 복사해 쓴다(원본 파일은 수정하지 않는다). Mapbox 는 `mapbox-stub.ts` 로 격리한다.
 *
 * 표고는 Open-Meteo(`apps/web/src/lib/fetchRouteElevations.ts`) 에서 오는데, 실제 표시값은
 * 거기서 끝나지 않고 `useRouteElevationProfile` → `applyRoadElevationModel` 로 거리창 평균/보정을
 * 거친다(도로형 스무딩). 그래도 단조 증가/감소 원본 배열의 양 끝 값(index 0)은 이 스무딩에서
 * 그대로 유지되므로(`outElev[0] = first`), 배열 앞쪽을 최댓값/최솟값으로 만들면 스무딩 후에도
 * 초반 진행률 마커가 여전히 전체 최댓값/최솟값 부근에 찍힌다.
 *
 * 실행: npm run test:e2e:hud-shots -w boxcycle-web (headless, 에뮬레이터 자동 배선)
 */

const PHONE_LANDSCAPE = { width: 690, height: 275 };

/** chief 가 지정한 촬영 저장 위치 — 세션 scratchpad 하위 shots/ */
const SHOTS_DIR =
  "C:/Users/kdrea/AppData/Local/Temp/claude/C--20-HDev-boxcycle/2e5b96fa-d86d-4f15-9fe4-c5294d9318f9/scratchpad/shots";
const MEASURE_PATH = path.join(SHOTS_DIR, "measure.json");

type ScenarioId = "A" | "B";

test.describe("HUD 거리 1줄 + 표고 진행률 라벨 촬영", () => {
  test("시나리오 A — 완만한 오르막(라벨이 점 위)", async ({ page }) => {
    test.setTimeout(150_000);
    await runScenario(page, "A");
  });

  test("시나리오 B — 초반이 경로 최고점(라벨이 점 아래로 뒤집힘)", async ({ page }) => {
    test.setTimeout(150_000);
    await runScenario(page, "B");
  });
});

async function runScenario(page: Page, scenario: ScenarioId) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  // page.goto() 이전에 반드시: Mapbox 스타일 격리 + Open-Meteo 표고 스텁.
  await stubMapboxStyle(page);
  await stubElevation(page, scenario);

  await page.setViewportSize(PHONE_LANDSCAPE);
  await guestStart(page);
  await armRideInput(page);
  await loadIntroCourse(page);

  await page.getByRole("button", { name: "주행 시작" }).click();
  await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

  const capsule = page.locator(".hud-metrics__capsule");
  const overlay = page.locator(".elevation-overlay");
  const progressLabel = page.locator(".elevation-overlay__progress");
  const metaRow = page.locator(".elevation-overlay__meta");

  await expect(capsule).toBeVisible({ timeout: 15_000 });
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  // 표고 로드(스텁 fetch) + 진행률 계산이 끝나야 마커 라벨이 나타난다.
  await expect(progressLabel).toBeVisible({ timeout: 20_000 });
  await expect(metaRow).toBeVisible();

  // ── 촬영 ────────────────────────────────────────────────────────────────
  await page.screenshot({ path: path.join(SHOTS_DIR, `${scenario}-full.png`) });
  await capsule.screenshot({ path: path.join(SHOTS_DIR, `${scenario}-hud.png`) });
  await overlay.screenshot({ path: path.join(SHOTS_DIR, `${scenario}-elev.png`) });

  // ── 계측 ────────────────────────────────────────────────────────────────
  const labelBox = await progressLabel.boundingBox();
  const metaBox = await metaRow.boundingBox();
  const finishFlag = overlay.locator(".elevation-overlay__finish");
  const finishBox = await finishFlag.boundingBox();
  const flagFill = await finishFlag.locator("path").nth(1).getAttribute("fill");
  const capsuleBox = await capsule.boundingBox();
  const labelText = (await progressLabel.textContent())?.trim() ?? "";
  const labelClass = (await progressLabel.getAttribute("class")) ?? "";
  const hasBelowClass = labelClass.includes("elevation-overlay__progress--below");

  const distanceCell = capsule.locator(".hud-metrics__cell--hero");
  const timeCell = capsule.locator('[title="시간"]');
  const distanceText = (await distanceCell.textContent())?.trim() ?? "";
  const distanceBox = await distanceCell.boundingBox();
  const timeBox = await timeCell.boundingBox();

  // ── M0: 축퇴 자가검산 — 0·상수·센티넬로 항상 참이 되는 게이트부터 배제 ──────
  expect(labelBox, "라벨 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(labelBox!.width, "라벨 width").toBeGreaterThan(0);
  expect(labelBox!.height, "라벨 height").toBeGreaterThan(0);

  expect(metaBox, "메타 행 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(metaBox!.width, "메타 width").toBeGreaterThan(0);
  expect(metaBox!.height, "메타 height").toBeGreaterThan(0);

  expect(labelText, `라벨 텍스트가 NN% covered 형태여야 한다: "${labelText}"`).toMatch(
    /^\d{1,3}% covered$/,
  );

  expect(capsuleBox, "캡슐 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(capsuleBox!.width, "캡슐 width").toBeGreaterThan(0);
  expect(capsuleBox!.height, "캡슐 height").toBeGreaterThan(0);

  // ── 본 단언 1 (공통): 라벨과 메타 행이 겹치지 않는다 ─────────────────────
  const aTop = labelBox!.y;
  const aBottom = labelBox!.y + labelBox!.height;
  const aLeft = labelBox!.x;
  const aRight = labelBox!.x + labelBox!.width;
  const bTop = metaBox!.y;
  const bBottom = metaBox!.y + metaBox!.height;
  const bLeft = metaBox!.x;
  const bRight = metaBox!.x + metaBox!.width;
  const overlaps = aBottom > bTop && aTop < bBottom && aRight > bLeft && aLeft < bRight;
  expect(overlaps, "진행률 라벨이 시점/종점 메타 행과 겹치면 안 된다").toBe(false);

  // 종점 깃발 — 깃대 밑동이 종점에 앉는지, 그리고 최고점 종점에서 메타 행을 침범하는지.
  // 축퇴 방어: 박스가 null·0 이면 요소를 못 찾은 것이지 "안 겹침"이 아니다.
  expect(finishBox, "깃발 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(finishBox!.width, "깃발 width").toBeGreaterThan(0);
  expect(finishBox!.height, "깃발 height").toBeGreaterThan(0);
  expect(flagFill, "깃발 천 색은 빨강이어야 한다").toBe("#ef4444");
  const fTop = finishBox!.y;
  const fBottom = finishBox!.y + finishBox!.height;
  const fLeft = finishBox!.x;
  const fRight = finishBox!.x + finishBox!.width;
  const flagOverlapsMeta = fBottom > bTop && fTop < bBottom && fRight > bLeft && fLeft < bRight;

  // ── 본 단언 2: 시나리오 B 는 --below 가 실제로 붙어야 한다 ────────────────
  if (scenario === "B") {
    expect(
      hasBelowClass,
      `시나리오 B 는 최고점 마커라 --below 가 붙어야 한다. yPct 실측을 보려면 measure.json 참고. ` +
        `class="${labelClass}"`,
    ).toBe(true);
  } else {
    // 대조군 — 시나리오 A(초반이 최저점)는 뒤집히지 않아야 두 시나리오가 실제로 구분된다.
    expect(hasBelowClass, "시나리오 A 는 --below 가 붙으면 안 된다").toBe(false);
  }

  // ── 본 단언 3: HUD 거리 셀이 1줄(누적 / 전체 km)이고 (NN%) 를 포함하지 않는다 ──
  expect(
    distanceText,
    `거리 셀 텍스트가 "거리 N / M km" 형태여야 한다: "${distanceText}"`,
  ).toMatch(/^거리\s*[\d.]+\s*\/\s*[\d.]+\s*km$/);
  expect(distanceText, `거리 셀에 (NN%) 가 남아있으면 안 된다: "${distanceText}"`).not.toMatch(
    /\(\d+%\)/,
  );

  // ── 본 단언 4: 거리 셀 높이가 시간 셀과 큰 차이가 없다(1줄 확인) ───────────
  expect(distanceBox, "거리 셀 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(timeBox, "시간 셀 boundingBox 가 null 이면 안 된다").not.toBeNull();
  expect(distanceBox!.height, "거리 셀 height").toBeGreaterThan(0);
  expect(timeBox!.height, "시간 셀 height").toBeGreaterThan(0);
  expect(
    distanceBox!.height,
    `거리 셀이 2줄이면 시간 셀보다 확연히 높다 — 거리=${distanceBox!.height}, 시간=${timeBox!.height}`,
  ).toBeLessThanOrEqual(timeBox!.height * 1.35);

  recordMeasurement(scenario, {
    labelBox,
    metaBox,
    capsuleBox,
    labelText,
    hasBelowClass,
    finishBox,
    flagFill,
    flagOverlapsMeta,
    distanceText,
    distanceBox,
    timeBox,
    overlaps,
  });
}

/** 요청된 좌표 개수(latitude 콤마 분할)와 같은 길이의 합성 표고 배열을 돌려준다. */
async function stubElevation(page: Page, scenario: ScenarioId) {
  await page.route(/^https:\/\/api\.open-meteo\.com\/v1\/elevation/, async (route) => {
    const url = new URL(route.request().url());
    const latParam = url.searchParams.get("latitude") ?? "";
    const count = latParam.length > 0 ? latParam.split(",").length : 2;
    const elevation = buildSyntheticElevations(scenario, count);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ elevation }),
    });
  });
}

function buildSyntheticElevations(scenario: ScenarioId, count: number): number[] {
  const n = Math.max(2, count);
  if (scenario === "A") {
    // 완만한 오르막(단조 증가) — 초반 진행률(낮은 인덱스)이 최저 고도.
    // 마커가 그래프 아래쪽(큰 yPct)에 찍혀 라벨이 기본값대로 점 위에 남는다.
    return Array.from({ length: n }, (_, i) => 30 + i * 2);
  }
  // 초반이 경로 최고점인 내리막(단조 감소) — 마커가 그래프 맨 위쪽(작은 yPct)에 찍힌다.
  // yPct 최소값은 viewBox pad(8)에 의해 8 부근 — 임계 20 미만이라 --below 가 붙어야 한다.
  return Array.from({ length: n }, (_, i) => 250 - i * 3);
}

function recordMeasurement(scenario: ScenarioId, data: unknown) {
  let all: Record<string, unknown> = {};
  if (fs.existsSync(MEASURE_PATH)) {
    try {
      all = JSON.parse(fs.readFileSync(MEASURE_PATH, "utf8"));
    } catch {
      all = {};
    }
  }
  all[scenario] = data;
  fs.writeFileSync(MEASURE_PATH, `${JSON.stringify(all, null, 2)}\n`, "utf8");
}

// ── 아래는 ride-entry.spec.ts / touch-targets-44.spec.ts 의 진입 헬퍼를 그대로 복사한 것.
//    원본 파일은 수정하지 않는다(지시: "헬퍼 함수 자체를 수정하지는 마라 — 필요하면 새 spec 안에 복사").

async function guestStart(page: Page) {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}

/** 주행 입력 준비 — Go 의 사전조건(SENSOR-2 §1.4) */
async function armRideInput(page: Page) {
  await page.getByRole("button", { name: /케이던스 센서/ }).click();
  const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
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
