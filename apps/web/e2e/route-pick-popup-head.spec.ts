import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 지도 지점 팝업 첫 행 계약 — 주소 + 잔여 토큰이 **한 행**에 온다(2026-09-16 Chief).
 *
 * 토큰 줄이 별도 행이면 자기 상자·테두리·위아래 여백까지 한 줄을 통째로 먹어
 * 팝업이 그만큼 길어진다. 행 하나를 회수하는 것이 목적이므로 「같은 행에 있다」와
 * 「팝업이 더 커지지 않는다」를 함께 못 박는다.
 *
 * ⚠ 폰 가로(275px)에서는 팝업이 `max-height: min(70vh, 26rem)` 로 **잘려 스크롤**된다 —
 * 거기서 높이를 비교하면 둘 다 70vh 라 항상 같다(축퇴). 높이는 잘리지 않는
 * 데스크톱 뷰포트에서 잰다.
 *
 * 실행: npm run test:e2e:pick-popup -w boxcycle-web
 */
const LIVE = process.env.RIDE_VERIFY_LIVE === "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/pick-popup-head");

/** 종전 배치(토큰이 자기 행·자기 상자)를 같은 페이지에서 복원해 기준선으로 쓴다 */
const LEGACY_LAYOUT_CSS = `
  /* containment 도 함께 푼다 — 종전에는 주소가 팝업 폭을 정했다 */
  .map-view__pick-address { contain: none; }
  .map-view__pick-address > .map-view__pick-token {
    display: block;
    margin: 0.2rem 0 0;
    padding: 0.28rem 0.38rem;
    border-radius: 0.45rem;
  }
  .map-view__pick-address > .map-view__pick-token .map-view__pick-token-line {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
  }
`;

type Box = { x: number; y: number; width: number; height: number };

test.describe("지도 지점 팝업 — 첫 행", () => {
  test.skip(!LIVE, "Firebase 에뮬레이터 필요 — npm run test:e2e:pick-popup");

  for (const vp of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "phone-landscape", width: 690, height: 275 },
  ]) {
    test(`${vp.name} — 잔여 토큰이 주소와 같은 행에 오고, 팝업이 커지지 않는다`, async ({
      page,
    }) => {
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
      // 잔여 토큰 줄은 출발 핀이 찍힌 뒤에만 나온다(`syncTokenUi`: hidden = !pins.start)
      await pick.getByRole("button", { name: "Set start" }).click();
      const address = pick.locator(".map-view__pick-address");
      const token = pick.locator('[data-testid="route-token-popup-feedback"]');
      await expect(address).toBeVisible();
      await expect(token, "잔여 토큰 줄").toBeVisible({ timeout: 20_000 });

      const a = await box(address);
      const t = await box(token);
      const popupNew = await box(pick);

      /*
       * 정말 「주소 줄 안」인가.
       * 배지가 주소 요소의 자식이 된 뒤로는 `주소 박스와 겹친다`가 항상 참이라 쓸모없다(축퇴).
       * 주소 **글자의 마지막 줄** 상자를 직접 꺼내 그 오른쪽에 붙었는지 본다.
       */
      const lineGeometry = await page.evaluate(() => {
        const span = document.querySelector(".map-view__pick-address-text");
        const tok = document.querySelector('[data-testid="route-token-popup-feedback"]');
        if (!span || !tok) return null;
        const rects = Array.from(span.getClientRects());
        const last = rects[rects.length - 1];
        const t = tok.getBoundingClientRect();
        const overlap = Math.min(last.bottom, t.bottom) - Math.max(last.top, t.top);
        return {
          addressLineCount: rects.length,
          lastLine: { x: last.x, y: last.y, right: last.right, bottom: last.bottom },
          token: { x: t.x, y: t.y, right: t.right, bottom: t.bottom },
          sameLineAsLastAddressLine: overlap > 0,
          startsAfterText: t.x >= last.right - 1,
          /** 주소 글자 흐름의 뒤 — 같은 줄 오른쪽이거나, 그 줄 아래 */
          inFlowAfterText: overlap > 0 || t.top >= last.bottom - 1,
        };
      });

      const legacy = await page.addStyleTag({ content: LEGACY_LAYOUT_CSS });
      await page.waitForTimeout(200);
      const popupLegacy = await box(pick);
      await legacy.evaluate((node: Element) => node.remove());
      await page.waitForTimeout(200);

      const clamped = popupNew.height >= vp.height * 0.7 - 1;
      fs.writeFileSync(
        path.join(OUT_DIR, `measurements-${vp.name}.json`),
        `${JSON.stringify(
          {
            viewport: vp,
            address: a,
            token: t,
            tokenText: (await token.innerText()).trim(),
            popupNew,
            popupLegacy,
            areaNew: Math.round(popupNew.width * popupNew.height),
            areaLegacy: Math.round(popupLegacy.width * popupLegacy.height),
            heightClampedBy70vh: clamped,
            lineGeometry,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await pick.screenshot({ path: path.join(OUT_DIR, `pick-popup-${vp.name}.png`) });

      // 1) 첫 행 안에 있다 — DOM 소속
      expect(
        await token.evaluate((el) => Boolean(el.closest(".map-view__pick-address"))),
        "토큰은 주소와 같은 첫 행(map-view__pick-address) 안이어야 한다",
      ).toBe(true);

      /*
       * 2) 배지가 주소 글자 **흐름 뒤**에 붙었다.
       * 짧은 주소면 마지막 줄 오른쪽에 그대로 앉고(= 행을 하나도 안 먹는다),
       * 「… 0개 · 경로 토큰 부족」처럼 길면 다음 줄로 접힌다 — 그래도 자기 상자·테두리·
       * 위아래 여백이 없어 종전보다 작다(§3 면적 게이트가 그걸 지킨다).
       * 못 박을 것은 「배지가 주소 **위로** 올라가지 않는다」 = 별도 선행 행이 아니다.
       */
      expect(lineGeometry, "주소 글자 span 과 토큰 배지가 있어야 한다").not.toBeNull();
      expect(
        lineGeometry!.inFlowAfterText,
        "배지는 주소 마지막 줄 오른쪽이거나 그 아래여야 한다(주소 위 별도 행 금지)",
      ).toBe(true);

      /*
       * 3) 지도를 더 가리지 않는다 — 폭과 면적 둘 다.
       *
       * 높이만 보면 속는다: 폰 가로에서 팝업은 `max-height: min(70vh, 26rem)` 로 잘려
       * 어느 배치든 높이가 192.5 로 같다(축퇴). 폭이 실제로 움직이는 축이다.
       */
      expect(popupNew.width, "새 배치가 종전보다 넓으면 안 된다").toBeLessThanOrEqual(
        popupLegacy.width,
      );
      expect(
        popupNew.width * popupNew.height,
        "새 배치가 지도를 더 가리면 안 된다(면적)",
      ).toBeLessThanOrEqual(popupLegacy.width * popupLegacy.height);
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
