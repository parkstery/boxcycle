import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * MENU 정리 A단계 계약 (2026-09-16 Chief).
 *
 * 폰 가로에서 MENU 패널은 275px 뿐인데, 계측해 보니 **크롬이 214px(78%)** 을 먹고
 * 「내 경로」 목록에는 61px 만 남았다(스크롤러 clientH 117 / scrollH 221).
 * 그 중 51px 은 조작이 하나도 없는 순수 라벨 두 줄이었다.
 *
 * A단계가 없앤 것:
 *   - 섹션 라벨 2줄(TRAIL · 경로)
 *   - 탭 계층(공식경로 / 내 경로)  → 경로 출처 칩 한 줄로 흡수
 *   - 「이벤트」(준비 중 한 줄만 그리던 빈 껍데기)
 *   - 「공식」 키커, 하단 「경로로」(상단 닫기와 중복)
 *
 * B단계: 「내 경로」를 공식 코스와 같은 급의 **별도 모달**로 옮겼다.
 *
 * 실행: npm run test:e2e:menu-a -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/menu-declutter-a");

const PHONE_LANDSCAPE = { width: 690, height: 275 };

/** A단계 이전 실측(main2 6b0f910) — 회귀 판정의 기준선 */
const BEFORE = { chromeH: 214, savedScrollerClientH: 117, savedListAreaH: 61 };

test.describe("MENU 정리 A단계", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:menu-a");

  test("라벨·탭·이벤트가 없고, 목록에 돌아간 높이가 실측된다", async ({ page }) => {
    test.setTimeout(150_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto("/");
    await guestStart(page);

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    const panel = page.locator(".menu-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);

    // ── 사라져야 할 것들 ────────────────────────────────────────────────
    expect(await page.locator(".menu-panel__section").count(), "섹션 라벨 줄").toBe(0);
    expect(await panel.getByRole("tab").count(), "MENU 안의 탭 계층").toBe(0);
    expect(await page.locator(".ride-panel__tabs").count(), "탭 행").toBe(0);
    await expect(panel.getByRole("button", { name: "이벤트" }), "이벤트 칩").toHaveCount(0);
    expect(await page.locator(".ride-panel__kicker").count(), "「공식」 키커").toBe(0);

    // ── 남아야 할 것들 — 출처 칩 한 줄 ──────────────────────────────────
    const sources = page.locator(".ride-panel__official-segments");
    await expect(sources).toBeVisible();
    for (const name of ["입문", "퍼블릭", "내 경로 목록"]) {
      await expect(
        sources.getByRole("button", { name, exact: name === "입문" }),
        `출처 칩 ${name}`,
      ).toHaveCount(1);
    }
    // 세 칩이 한 줄에 — 줄바꿈되면 회수한 높이를 도로 까먹는다
    const chipTops = await sources
      .locator("button")
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(chipTops).size, `출처 칩이 한 줄이어야 한다 (top=${chipTops})`).toBe(1);

    // ── 높이 배분 실측 ──────────────────────────────────────────────────
    const rows = await page.evaluate(() => {
      const h = (s: string) => {
        const el = document.querySelector(s);
        return el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null;
      };
      return {
        panel: h(".menu-panel"),
        head: h(".menu-panel__head"),
        body: h(".menu-panel__body"),
        trailHub: h(".trail-hub"),
        ridePanel: h(".ride-panel"),
        sourceRow: h(".ride-panel__official"),
      };
    });
    await panel.screenshot({ path: path.join(OUT_DIR, "01-menu.png") });

    /*
     * ── B단계: 「내 경로」는 MENU 안이 아니라 **별도 모달**에서 열린다 ──────
     * 종전에는 좁은 사이드 패널 안 탭이라 목록 가용 높이가 61px 뿐이었다.
     * 공식 코스와 같은 껍데기(oc-modal)를 쓰므로 「경로 고르는 자리」로 함께 읽힌다.
     */
    await page.getByRole("button", { name: "내 경로 목록" }).click();
    const savedDialog = page.getByRole("dialog", { name: "내 경로" });
    await expect(savedDialog, "내 경로 모달").toBeVisible({ timeout: 20_000 });
    expect(
      await page.locator(".menu-panel .saved-routes").count(),
      "목록이 MENU 패널 안에 남아 있으면 안 된다(모달로 이전)",
    ).toBe(0);
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => {
      const dlg = document.querySelector(".oc-modal") as HTMLElement | null;
      const body = document.querySelector(".oc-modal__body") as HTMLElement | null;
      const list = document.querySelector(".saved-routes") as HTMLElement | null;
      const head = document.querySelector(".oc-modal__head") as HTMLElement | null;
      /*
       * 현재 높이는 계정에 경로가 몇 개냐에 따라 달라진다(에뮬레이터 게스트는 0개라 작게 나온다).
       * 「자리가 넓어졌다」를 증명하려면 **쓸 수 있는 최대 높이**를 봐야 한다.
       */
      const maxDialogH = dlg ? parseFloat(getComputedStyle(dlg).maxHeight) : null;
      return {
        dialogH: dlg ? Math.round(dlg.getBoundingClientRect().height) : null,
        bodyH: body ? Math.round(body.getBoundingClientRect().height) : null,
        listH: list ? Math.round(list.getBoundingClientRect().height) : null,
        maxDialogH: maxDialogH != null ? Math.round(maxDialogH) : null,
        headH: head ? Math.round(head.getBoundingClientRect().height) : null,
        maxBodyH:
          maxDialogH != null && head
            ? Math.round(maxDialogH - head.getBoundingClientRect().height)
            : null,
      };
    });
    await page.screenshot({ path: path.join(OUT_DIR, "02-saved-modal.png") });

    /*
     * 목록이 쓸 수 있는 높이가 종전 인패널(61px)보다 확실히 커야 한다.
     * 모달 본문 높이로 잰다 — 목록 자체 높이는 경로가 적으면 작게 나와(축퇴)
     * 「자리가 넓어졌다」를 증명하지 못한다.
     */
    expect(
      saved.maxBodyH ?? 0,
      "목록이 쓸 수 있는 최대 높이가 종전 인패널(61px)의 2배는 돼야 한다",
    ).toBeGreaterThan(BEFORE.savedListAreaH * 2);

    /*
     * 내 경로 정렬 — 종전 기본값(최근순) 유지.
     * 경로가 0개면 컨트롤 자체가 안 나온다(제품 동작) — 에뮬레이터 게스트가 그렇다.
     * 있을 때만 값을 보고, 없으면 기록만 남긴다. 기본값 자체는 단위 계약이 잡는다
     * (`route-list-sort-contract.test.ts`).
     */
    const savedSort = savedDialog.getByRole("combobox", { name: "정렬 기준" });
    const savedSortable = (await savedSort.count()) > 0;
    if (savedSortable) {
      await expect(savedSort, "내 경로 기본 정렬은 최근순").toHaveValue("recent");
    }

    // 닫으면 MENU 로 돌아온다
    await savedDialog.getByRole("button", { name: "닫기" }).click();
    await expect(savedDialog).toBeHidden({ timeout: 10_000 });
    await expect(panel).toBeVisible();

    /*
     * ── 정렬을 입문·퍼블릭에도 (2026-09-16 Chief) ─────────────────────────
     * 같은 컨트롤·기본값 「최근순」. 입문 허브는 등록 시각이 없어 최근순이 원래 순서로
     * 물러나므로 Basic 1·2·3 의 의도된 난이도 순서가 그대로 지켜진다 —
     * 「최근순으로 두면 입문이 섞이지 않을까」를 실제로 확인하는 것이 아래 왕복이다.
     */
    await page.getByRole("button", { name: "입문", exact: true }).click();
    const introDialog = page.getByRole("dialog", { name: "입문 경로" });
    await expect(introDialog).toBeVisible({ timeout: 20_000 });
    const introTitles = () =>
      introDialog.locator(".oc-modal__item-title, .oc-modal__item strong, li").allInnerTexts();
    const introBefore = await introTitles();
    const introSort = introDialog.getByRole("combobox", { name: "정렬 기준" });
    const introSortable = (await introSort.count()) > 0;
    if (introSortable) {
      await expect(introSort, "입문 기본 정렬은 최근순").toHaveValue("recent");
      // 최근순이 기본인데도 입문은 원래(카탈로그) 순서여야 한다 — 시각이 없으니 물러난다
      expect(await introTitles(), "입문은 최근순에서도 카탈로그 순서").toEqual(introBefore);
      await introSort.selectOption("name");
      await page.waitForTimeout(250);
      await introSort.selectOption("recent");
      await page.waitForTimeout(250);
      expect(await introTitles(), "최근순으로 되돌리면 원래 순서").toEqual(introBefore);
    }
    await page.screenshot({ path: path.join(OUT_DIR, "03-intro-sort.png") });
    await introDialog.getByRole("button", { name: "닫기" }).click();
    await expect(introDialog).toBeHidden({ timeout: 10_000 });

    fs.writeFileSync(
      path.join(OUT_DIR, "sort.json"),
      `${JSON.stringify(
        { savedSortable, introSortable, introCount: introBefore.length },
        null,
        2,
      )}
`,
      "utf8",
    );

    const chromeH =
      (rows.head ?? 0) + (rows.trailHub ?? 0) + (rows.sourceRow ?? 0);
    fs.writeFileSync(
      path.join(OUT_DIR, "measurements.json"),
      `${JSON.stringify({ viewport: PHONE_LANDSCAPE, before: BEFORE, rows, chromeH, saved }, null, 2)}\n`,
      "utf8",
    );

    // 크롬이 종전보다 줄었다 — 이 작업의 목적
    expect(chromeH, "MENU 크롬 높이가 종전(214px)보다 줄어야 한다").toBeLessThan(BEFORE.chromeH);
  });
});

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}
