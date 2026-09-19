import { test, expect, type Page, type Locator } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 지도 지점 팝업 제목 행 계약 (2026-09-16 Chief).
 *
 *   첫 줄  「경로 생성」 (핀 찍으면 「경로 생성 잔여 토큰 N개」)
 *   둘째 줄 주소
 *
 * 목적은 두 가지다:
 *   1. 긴 주소가 첫 줄에서 닫기 ✕ 를 덮던 것을 막는다 — 짧은 제목이 그 자리를 대신한다.
 *   2. 팝업에 제목 구실을 하는 행을 준다.
 *
 * 실행: npm run test:e2e:pick-title -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/pick-popup-title");

type Box = { x: number; y: number; width: number; height: number };

test.describe("지도 지점 팝업 — 제목 행", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:pick-title");

  for (const vp of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "phone-landscape", width: 690, height: 275 },
  ]) {
    test(`${vp.name} — 제목이 첫 줄, 주소는 둘째 줄, ✕ 안 가림`, async ({ page }) => {
      test.setTimeout(150_000);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await guestStart(page);

      const map = page.locator(".mapboxgl-canvas").first();
      await expect(map).toBeVisible({ timeout: 30_000 });
      await map.click({ position: { x: Math.round(vp.width * 0.6), y: Math.round(vp.height / 2) } });

      const pick = page.locator(".map-view__pick").last();
      await expect(pick, "지점 팝업").toBeVisible({ timeout: 20_000 });

      const title = pick.locator('[data-testid="route-token-popup-feedback"]');
      const titleLine = pick.getByTestId("route-token-holding");
      const address = pick.locator(".map-view__pick-address");

      // ── 핀 찍기 전: 제목만 선다 ─────────────────────────────────────────
      await expect(title, "제목 행은 핀 전에도 보인다").toBeVisible({ timeout: 20_000 });
      await expect(titleLine, "핀 전 제목은 「경로 생성」").toHaveText("경로 생성");
      const titleBefore = await box(title);
      const addressBefore = await box(address);
      expect(titleBefore.y, "제목이 주소보다 위").toBeLessThan(addressBefore.y);
      await pick.screenshot({ path: path.join(OUT_DIR, `01-${vp.name}-before-pin.png`) });

      // ── 핀 찍은 뒤: 제목 + 잔액 ─────────────────────────────────────────
      await pick.getByRole("button", { name: "Set start" }).click();
      await expect(titleLine, "핀 후 제목에 잔액이 붙는다").toHaveText(
        /^경로 생성 잔여 토큰 \d+개/,
        { timeout: 20_000 },
      );
      const titleAfter = await box(title);
      const addressAfter = await box(address);
      expect(titleAfter.y, "제목이 주소보다 위(핀 후에도)").toBeLessThan(addressAfter.y);

      /*
       * ✕ 를 아무것도 덮지 않는다.
       * 이 배치의 애초 목적이므로 **겹침 면적 0** 을 직접 잰다 —
       * 「제목이 짧으니 괜찮겠지」는 계측이 아니다.
       */
      // 닫기 버튼은 `.map-view__pick`(내용) 이 아니라 그 바깥 패널이 소유한다
      const close = page
        .locator(".map-view__pick-dock-close, .mapboxgl-popup-close-button")
        .last();
      await expect(close, "닫기 ✕").toBeVisible({ timeout: 10_000 });
      const closeBox = await box(close);
      /*
       * 겹침은 **글자 상자**로 잰다. 제목 행 컨테이너는 폭을 다 쓰고 오른쪽 여백으로만
       * ✕ 자리를 비우므로, 컨테이너 상자로 재면 여백을 쓰고도 「겹친다」고 나온다(오판).
       */
      const titleTextBox = await box(titleLine);
      for (const [name, b] of [
        ["제목 글자", titleTextBox],
        ["주소", addressAfter],
      ] as const) {
        const ox = Math.min(b.x + b.width, closeBox.x + closeBox.width) - Math.max(b.x, closeBox.x);
        const oy =
          Math.min(b.y + b.height, closeBox.y + closeBox.height) - Math.max(b.y, closeBox.y);
        expect(Math.max(0, ox) * Math.max(0, oy), `${name} 가 닫기 ✕ 를 덮으면 안 된다`).toBe(0);
      }

      fs.writeFileSync(
        path.join(OUT_DIR, `measurements-${vp.name}.json`),
        `${JSON.stringify(
          {
            viewport: vp,
            titleTextBeforePin: "경로 생성",
            titleTextAfterPin: (await titleLine.innerText()).trim(),
            titleBefore,
            addressBefore,
            titleAfter,
            titleTextBox,
            addressAfter,
            close: closeBox,
            popup: await box(pick),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await pick.screenshot({ path: path.join(OUT_DIR, `02-${vp.name}-after-pin.png`) });
    });
  }
});

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("boundingBox 없음 — 요소가 화면에 없다");
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(b.x), y: r(b.y), width: r(b.width), height: r(b.height) };
}

async function guestStart(page: Page) {
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden({ timeout: 30_000 });
}
