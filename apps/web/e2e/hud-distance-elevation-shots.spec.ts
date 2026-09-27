import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { stubMapboxStyle } from "./mapbox-stub";

/**
 * HUD 거리 1줄화 + 표고 그래프 진행률 라벨 — 렌더 검증 하네스 (2026-09-17).
 *
 * 검증 대상(작업 트리에 이미 적용됨, 이 spec 은 로직을 바꾸지 않는다):
 *  - `MapHud.tsx`/`.css`: 상단 HUD 「거리」 셀 2줄 → 1줄(`0.03 / 0.16 km`).
 *  - `MapView.tsx`/`.css`, `mapElevationUi.ts`: 표고 그래프 마커에 `NN%` 라벨.
 *
 * (2026-09-24 지시03) 예전엔 `.elevation-overlay__progress` 가 `yPct < 20` 이면 `--below` 가
 * 붙어 점 아래로 뒤집혔다 — 「시점/종점」 메타 행이 그래프 **위**에 있어 라벨이 그 행을
 * 침범했기 때문. 메타 행이 화면 하단 코칭 멘트 줄 높이로 옮겨가며 침범할 자리가 없어져
 * `--below` 를 제거했다(MapView.tsx/.css). 시나리오 B(초반 최고점)는 이제 「뒤집기가
 * 붙는지」가 아니라 「뒤집지 않아도 겹치지 않는지」를 본다.
 *
 * 진입 절차는 `ride-entry.spec.ts`/`touch-targets-44.spec.ts` 의 게스트→입문 코스→주행 시작
 * 헬퍼를 그대로 복사해 쓴다(원본 파일은 수정하지 않는다). Mapbox 는 `mapbox-stub.ts` 로 격리한다.
 *
 * 표고는 Open-Meteo(`apps/web/src/lib/route/fetchRouteElevations.ts`) 에서 오는데, 실제 표시값은
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

  /*
   * 좌상단 고정 계약(2026-09-17 Chief): 주행 중 계기판이 지도 중앙을 가리던 것을
   * 좌상단 첫 줄로 옮기고, RTW 버튼을 그 아래 둘째 줄로 고정했다. 「고정」이란
   * 계기판이 비어 있든(주행 전) 차 있든(주행 중) RTW 버튼의 y 가 그대로라는 뜻 —
   * 매직 오프셋 두 슬롯이 아니라 높이를 예약한 한 슬롯(`.map-hud__tl-metrics`)으로
   * 구현했으므로, 그 계약을 렌더된 박스로 실측해 고정한다.
   */
  test("좌상단 고정 계약 — 계기판 첫 줄, RTW 버튼 y 불변", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });

    await stubMapboxStyle(page);
    await stubElevation(page, "A");

    await page.setViewportSize(PHONE_LANDSCAPE);
    await guestStart(page);
    await armRideInput(page);

    const brand = page.locator(".hud-brand");
    await expect(brand).toBeVisible({ timeout: 15_000 });

    // ── 경로 없는 첫 화면 — 계기판이 아예 없는 유일한 상태 ────────────────
    // 「고정」의 실제 시험대다. 코스를 로드하면 경로 미리보기 계기판이 떠버려
    // 아래 idle 측정도 캡슐이 있는 상태가 된다 — 그러면 높이 예약
    // (`.map-hud__tl-metrics { min-height }`)이 한 번도 시험되지 않는다.
    await expect(page.locator(".hud-metrics__capsule")).toHaveCount(0);
    const noRouteBrandBox = await brand.boundingBox();

    await loadIntroCourse(page);

    // ── 주행 전(idle, 코스 로드 후 — 경로 미리보기 계기판이 뜬다) ─────────
    const idleBrandBox = await brand.boundingBox();
    await page.screenshot({ path: path.join(SHOTS_DIR, "layout-idle.png") });

    // ── 주행 시작 ────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    const capsule = page.locator(".hud-metrics__capsule");
    await expect(capsule).toBeVisible({ timeout: 15_000 });

    const ridingBrandBox = await brand.boundingBox();
    const capsuleBox = await capsule.boundingBox();
    await page.screenshot({ path: path.join(SHOTS_DIR, "layout-riding.png") });

    // ── M0: 축퇴 방어 — boundingBox 가 null 이거나 폭/높이가 0 이면 계측 실패다 ──
    expect(idleBrandBox, "주행 전 RTW 버튼 boundingBox 가 null 이면 안 된다").not.toBeNull();
    expect(idleBrandBox!.width, "주행 전 RTW 버튼 width").toBeGreaterThan(0);
    expect(idleBrandBox!.height, "주행 전 RTW 버튼 height").toBeGreaterThan(0);

    expect(ridingBrandBox, "주행 중 RTW 버튼 boundingBox 가 null 이면 안 된다").not.toBeNull();
    expect(ridingBrandBox!.width, "주행 중 RTW 버튼 width").toBeGreaterThan(0);
    expect(ridingBrandBox!.height, "주행 중 RTW 버튼 height").toBeGreaterThan(0);

    expect(capsuleBox, "주행 중 계기판 캡슐 boundingBox 가 null 이면 안 된다").not.toBeNull();
    expect(capsuleBox!.width, "계기판 캡슐 width").toBeGreaterThan(0);
    expect(capsuleBox!.height, "계기판 캡슐 height").toBeGreaterThan(0);

    expect(noRouteBrandBox, "경로 없는 화면 RTW 버튼 boundingBox 가 null 이면 안 된다").not.toBeNull();
    expect(noRouteBrandBox!.height, "경로 없는 화면 RTW 버튼 height").toBeGreaterThan(0);

    // ── 본 단언 0: 계기판이 아예 없어도 RTW 는 같은 자리다 — 예약된 높이의 존재 이유 ──
    expect(
      Math.abs(noRouteBrandBox!.y - ridingBrandBox!.y),
      `계기판이 없는 화면에서도 RTW y 가 같아야 한다: 경로없음=${noRouteBrandBox!.y}, 주행중=${ridingBrandBox!.y}`,
    ).toBeLessThanOrEqual(1);

    // ── 본 단언 1: RTW 버튼 y 는 주행 시작 전후 고정이다(Chief 「고정」) ────────
    expect(
      Math.abs(ridingBrandBox!.y - idleBrandBox!.y),
      `RTW 버튼 y 가 주행 시작 전후 달라지면 안 된다: idle=${idleBrandBox!.y}, riding=${ridingBrandBox!.y}`,
    ).toBeLessThanOrEqual(1);

    // ── 본 단언 2: 계기판은 화면 좌측(20% 이내)에서 RTW 버튼보다 위에 있다 ──────
    expect(
      capsuleBox!.x,
      `계기판이 화면 좌측(폭 20% 이내)에 있어야 한다: x=${capsuleBox!.x}, viewport=${PHONE_LANDSCAPE.width}`,
    ).toBeLessThan(PHONE_LANDSCAPE.width * 0.2);
    expect(
      capsuleBox!.y,
      `계기판이 RTW 버튼보다 위(더 작은 y)에 있어야 한다: capsule=${capsuleBox!.y}, brand=${ridingBrandBox!.y}`,
    ).toBeLessThan(ridingBrandBox!.y);

    fs.writeFileSync(
      path.join(SHOTS_DIR, "layout-measure.json"),
      `${JSON.stringify(
        {
          viewport: PHONE_LANDSCAPE,
          noRouteBrandBox,
          idleBrandBox,
          ridingBrandBox,
          capsuleBox,
          brandYDelta: Math.abs(ridingBrandBox!.y - idleBrandBox!.y),
          brandYDeltaNoRoute: Math.abs(ridingBrandBox!.y - noRouteBrandBox!.y),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});

  /*
   * 계기는 제자리를 지킨다(2026-09-17 Chief) — 「평균 9.9 → 10.0」 한 자리 차이로
   * 오른쪽 계기가 통째로 밀리고 당겨지던 문제. `tabular-nums` 는 같은 자릿수끼리만
   * 폭을 맞추므로 자릿수가 바뀌면 소용없다 → 셀마다 고정 폭(`--w-*`).
   *
   * 선언(CSS width)을 보면 축퇴다. 주행 중 값이 실제로 바뀌는 동안 렌더된 x 를
   * 연속 표본으로 잡아 **한 번도 안 움직였는지**를 본다. 값이 안 변한 표본만 모으면
   * 「안 움직였다」는 아무것도 증명하지 않으므로, 글자가 실제로 변했다는 것부터 세운다.
   */
  test("계기 고정 폭 — 값이 바뀌어도 셀 x 가 움직이지 않는다", async ({ page }) => {
    test.setTimeout(180_000);
    await stubMapboxStyle(page);
    await stubElevation(page, "A");
    await page.setViewportSize(PHONE_LANDSCAPE);
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".hud-metrics__capsule")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    type Cell = { label: string; x: number; w: number; text: string };
    const samples: Cell[][] = [];
    for (let i = 0; i < 26; i += 1) {
      samples.push(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll(".hud-metrics__cell")).map((el) => {
            const c = el as HTMLElement;
            // getBoundingClientRect 가 아니라 offsetLeft/offsetWidth — **레이아웃** 위치다.
            // 「새 도로」 셀은 값이 오를 때 transform: scale(1.16) 팝이 터진다(도파민 지점).
            // 그건 의도된 연출이고 이웃을 밀지도 않는다(transform 은 레이아웃 밖). 시각
            // 사각형을 재면 그 연출까지 「움직임」으로 잡혀 정작 재려던 밀림과 뒤섞인다.
            return {
              label: c.querySelector(".hud-metrics__label")?.textContent?.trim() ?? "",
              x: c.offsetLeft,
              w: c.offsetWidth,
              text: (c.textContent ?? "").replace(/\s+/g, " ").trim(),
            };
          }),
        ),
      );
      await page.waitForTimeout(500);
    }

    // 모든 표본에 공통으로 존재한 라벨만 비교한다(정복 셀은 주행 중 나타날 수 있다).
    const labelSets = samples.map((s) => new Set(s.map((c) => c.label)));
    const common = [...labelSets[0]].filter((l) => l && labelSets.every((set) => set.has(l)));

    const byLabel = new Map<string, Cell[]>();
    for (const snap of samples) {
      for (const c of snap) {
        if (!common.includes(c.label)) continue;
        byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), c]);
      }
    }

    const report = [...byLabel.entries()].map(([label, cells]) => {
      const xs = [...new Set(cells.map((c) => c.x))];
      const ws = [...new Set(cells.map((c) => c.w))];
      const texts = [...new Set(cells.map((c) => c.text))];
      return { label, distinctX: xs, distinctW: ws, textVariants: texts.length, sample: texts.slice(0, 4) };
    });
    fs.writeFileSync(
      path.join(SHOTS_DIR, "cell-stability.json"),
      `${JSON.stringify({ samples: samples.length, report }, null, 2)}
`,
      "utf8",
    );

    // M0 축퇴 방어 — 셀을 못 찾았거나 값이 한 번도 안 바뀌었으면 「안 움직였다」는 공허하다.
    expect(common.length, `공통 계기 라벨이 너무 적다: ${JSON.stringify(common)}`).toBeGreaterThanOrEqual(4);
    expect(
      report.some((r) => r.textVariants > 1),
      `표본 동안 어떤 계기도 값이 바뀌지 않았다 — 고정 여부를 증명할 수 없다: ${JSON.stringify(report)}`,
    ).toBe(true);

    /*
     * 위 표본은 실제 주행이라 값 변화가 「그날 나온 만큼」만 잡힌다 — 이번엔 느려서
     * Chief 가 겪은 자릿수 변화(`9.9 → 10.0`)가 안 나왔다. 그래서 결정적 시험을 따로 건다:
     * 값 글자를 억지로 길게 바꿔도 **오른쪽 이웃의 레이아웃 x 가 그대로**여야 한다.
     * DOM 을 직접 고친 뒤 같은 evaluate 안에서 동기적으로 재므로 React 재렌더가 끼어들지 않는다.
     */
    const injected = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll(".hud-metrics__cell")) as HTMLElement[];
      const before = cells.map((c) => c.offsetLeft);
      const target = cells.find(
        (c) => c.querySelector(".hud-metrics__label")?.textContent?.trim() === "평균",
      );
      const valueEl = target?.querySelector(".hud-metrics__value") as HTMLElement | undefined;
      if (!valueEl) return null;
      const original = valueEl.textContent ?? "";
      valueEl.textContent = "8888.8888";
      void target!.offsetWidth; // 강제 리플로
      const after = cells.map((c) => c.offsetLeft);
      valueEl.textContent = original;
      return { before, after, original };
    });

    expect(injected, "「평균」 셀을 찾아야 한다").not.toBeNull();
    expect(injected!.before.length, "계기 셀이 없으면 계측 실패").toBeGreaterThanOrEqual(4);
    expect(
      injected!.after,
      `값을 길게 바꾸자 이웃이 밀렸다: before=${JSON.stringify(injected!.before)}, after=${JSON.stringify(injected!.after)}`,
    ).toEqual(injected!.before);

    for (const r of report) {
      expect(
        r.distinctX.length,
        `「${r.label}」 셀의 레이아웃 x 가 움직였다: x=${JSON.stringify(r.distinctX)}, 값=${JSON.stringify(r.sample)}`,
      ).toBe(1);
      expect(
        r.distinctW.length,
        `「${r.label}」 셀 폭이 변했다: w=${JSON.stringify(r.distinctW)}`,
      ).toBe(1);
    }
  });

  /*
   * 「새 도로」 펄스는 내 위치 마커와 **같은 박자·같은 위상**으로 뛴다(2026-09-17 Chief).
   * 종전엔 값이 바뀔 때마다 0.35s 팝을 다시 틀어, 빠를수록 주기가 짧아지고 촐랑거렸다.
   *
   * 선언(CSS duration)만 보면 축퇴다 — 위상까지 맞는지는 렌더된 애니메이션의 `currentTime`
   * 으로만 알 수 있다. 두 요소의 currentTime 을 주기로 나눈 나머지가 같아야 같은 격자다.
   */
  test("새 도로 펄스가 내 위치 마커와 같은 박자·위상으로 뛴다", async ({ page }) => {
    test.setTimeout(180_000);
    await stubMapboxStyle(page);
    await stubElevation(page, "A");
    await page.setViewportSize(PHONE_LANDSCAPE);
    await guestStart(page);
    await armRideInput(page);
    await loadIntroCourse(page);
    await page.getByRole("button", { name: "주행 시작" }).click();
    await expect(page.getByRole("button", { name: "주행 종료" })).toBeVisible({ timeout: 30_000 });

    // 새 도로를 먹기 시작해야 펄스가 켜진다.
    const pulsingCell = page.locator(".hud-metrics__cell--conquest-pulsing");
    await expect(pulsingCell).toBeVisible({ timeout: 90_000 });

    const probe = await page.evaluate(() => {
      const read = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const anims = el.getAnimations();
        const a = anims[0];
        const cs = getComputedStyle(el);
        // `currentTime` 은 «시작 이후 경과»라 음수 delay 가 안 들어간다.
        // 위상은 effect 의 정규화 진행도(progress, 0..1)로 재야 한다.
        const timing = a?.effect?.getComputedTiming();
        return {
          found: true,
          animations: anims.length,
          progress: typeof timing?.progress === "number" ? timing.progress : null,
          delay: cs.animationDelay,
          duration: cs.animationDuration,
          iteration: cs.animationIterationCount,
        };
      };
      return {
        marker: read(".map-view__self-location-pulse"),
        cell: read(".hud-metrics__cell--conquest-pulsing"),
      };
    });

    // M0 축퇴 방어 — 요소나 애니메이션이 없으면 「위상이 같다」는 공허하다.
    expect(probe.marker, "내 위치 마커 펄스를 찾아야 한다").not.toBeNull();
    expect(probe.cell, "새 도로 펄스 셀을 찾아야 한다").not.toBeNull();
    expect(probe.marker!.animations, "마커에 애니메이션이 있어야 한다").toBeGreaterThan(0);
    expect(probe.cell!.animations, "셀에 애니메이션이 있어야 한다").toBeGreaterThan(0);
    expect(probe.marker!.progress, "마커 진행도").not.toBeNull();
    expect(probe.cell!.progress, "셀 진행도").not.toBeNull();

    // 같은 박자 — duration 과 반복이 일치해야 한다.
    expect(probe.cell!.duration, "펄스 주기가 마커와 같아야 한다").toBe(probe.marker!.duration);
    expect(probe.cell!.iteration, "새 도로 펄스는 값 변화가 아니라 무한 반복이어야 한다").toBe(
      "infinite",
    );

    // 같은 위상 — 정규화 진행도가 같아야 한다(0 과 1 은 같은 지점이라 래핑해서 본다).
    const diff = Math.abs(probe.marker!.progress! - probe.cell!.progress!);
    const wrapped = Math.min(diff, 1 - diff);
    expect(
      wrapped,
      `위상이 어긋났다: 마커=${probe.marker!.progress}(delay ${probe.marker!.delay}), 셀=${probe.cell!.progress}(delay ${probe.cell!.delay})`,
    ).toBeLessThan(0.03);
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

  // ── 본 단언 2: --below 는 더 이상 존재하지 않는 클래스다(2026-09-24 지시03) ──
  // 「시점/종점」 메타 행이 코칭 멘트 줄 높이로 내려가면서 뒤집기 자체가 죽은 코드가 돼
  // MapView.tsx/.css 에서 제거됐다. 시나리오 B(초반 최고점, yPct 최소값 근접)에서도
  // 클래스가 안 붙는 것 자체가 회귀 확인이다 — 겹침 여부는 위 「본 단언 1」이 잡는다.
  expect(
    hasBelowClass,
    `--below 클래스는 제거됐다 — 더 붙으면 회귀다. scenario=${scenario}, class="${labelClass}"`,
  ).toBe(false);

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
/*
 * 체험 속도를 올려 시험 시간을 줄인다(`ride-continuation.spec.ts` 와 같은 수법).
 * 부수 효과가 하나 더 있다 — 계기 고정 폭 시험에서 값이 빠르게 변해 자릿수 변화
 * (「9.9 → 10.0」, Chief 가 지적한 바로 그 경우)가 표본 안에 실제로 잡힌다.
 * 입문 코스는 0.41km 라 50km/h 로도 29초가 걸리므로, 13초짜리 표본 구간에는 여유가 있다.
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
