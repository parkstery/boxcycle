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
  await sheet.getByRole("button", { name: "체험 속도로 준비" }).click();
  const speedInput = sheet.getByRole("spinbutton", { name: "속도 km/h" });
  if (await speedInput.count()) {
    await speedInput.fill(String(speedKmh));
    await speedInput.blur();
  }
  await sheet.getByRole("button", { name: "센서 설정 닫기" }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
}

