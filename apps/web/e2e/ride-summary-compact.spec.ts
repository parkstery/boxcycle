import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { stubMapboxStyle } from "./mapbox-stub";

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

/** chief 가 지정한 촬영/계측 저장 위치 — 세션 scratchpad 하위 shots/ */
const SHOTS_DIR =
  "C:/Users/kdrea/AppData/Local/Temp/claude/C--20-HDev-boxcycle/2e5b96fa-d86d-4f15-9fe4-c5294d9318f9/scratchpad/shots";

/** 폐기 정책(100m) 위 여유값 — 이보다 커지면 결과 시트가 뜬다고 확신할 수 있다. */
const DISTANCE_THRESHOLD_KM = 0.11;

/** 제거 대상 문구 2종 — 시트 텍스트에 남아 있으면 회귀다. */
const REMOVED_PHRASES = ["내 도로망에 더해졌어요", "다음 출발점이 저장되었습니다"];

test.describe("주행 결과 시트 컴팩트화", () => {
  test("스크롤 없음 · 6줄 이하 · 끝점 CTA 제거 · 설명문 제거", async ({ page }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });

    await stubMapboxStyle(page);
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);

    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    /*
     * 끝까지 달려 **완주 상태**의 시트를 본다 — 컴팩트 재설계에서 「경로를 완주했습니다」
     * 문단이 「완주」 배지로 바뀌었고, 그 배지는 완주해야만 뜬다. 부분 주행만 재면
     * 새 표면의 절반을 시험하지 않는 셈이다.
     *
     * 입문 코스는 414m(가장 짧은 퍼블릭 경로)이고 체험 속도 상한이 50km/h
     * (`SESSION_SPEED_MAX_KMH`)라 약 30초면 닿는다 — 도착하면 자동 종료가 결과 시트를
     * 열어 주므로 「주행 종료」를 누르지 않는다. 폐기 임계(100m 초과)도 자연히 넘는다.
     */
    await expect
      .poll(() => readCumulativeKm(page), {
        message: "HUD 누적 거리가 0.11km 를 넘어야 결과 시트가 뜬다(폐기 정책: 100m 초과)",
        timeout: 150_000,
        intervals: [1000],
      })
      .toBeGreaterThan(DISTANCE_THRESHOLD_KM);

    const sheet = page.getByRole("dialog", { name: "주행 결과" });
    await expect(sheet, "도착 자동 종료가 결과 시트를 연다").toBeVisible({ timeout: 120_000 });
    // 완주 배지 — 「경로를 완주했습니다」 문단을 대신하는 새 표면.
    await expect(sheet.locator(".ride-summary__heroes-badge--done")).toHaveText("완주");

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
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
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
  await items.first().click();
  await expect(page.getByRole("button", { name: "주행 시작" })).toBeVisible({ timeout: 20_000 });
}
