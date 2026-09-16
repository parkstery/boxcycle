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
 * 실행: npm run test:e2e:menu-a -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/menu-declutter-a");

const PHONE_LANDSCAPE = { width: 690, height: 275 };

/** A단계 이전 실측(main2 6b0f910) — 회귀 판정의 기준선 */
const BEFORE = { chromeH: 214, savedScrollerClientH: 117 };

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

    // ── 내 경로 목록에 돌아간 높이 ──────────────────────────────────────
    await page.getByRole("button", { name: "내 경로 목록" }).click();
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() => {
      const scroller = Array.from(document.querySelectorAll(".menu-panel *")).find((n) => {
        const e = n as HTMLElement;
        return e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 20;
      }) as HTMLElement | undefined;
      const list = document.querySelector(".saved-routes") as HTMLElement | null;
      return {
        scroller: scroller
          ? { cls: scroller.className, clientH: scroller.clientHeight, scrollH: scroller.scrollHeight }
          : null,
        listH: list ? Math.round(list.getBoundingClientRect().height) : null,
      };
    });
    await panel.screenshot({ path: path.join(OUT_DIR, "02-saved.png") });

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
