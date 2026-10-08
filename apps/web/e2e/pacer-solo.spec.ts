import { expect, test, type Page, type Request } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureRiding, guestStart, loadIntroCourse, setSpeedKmh } from "./rideEntryHelpers";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.out/pacer");

type PacerDiag = {
  enabled: boolean;
  visible: boolean;
  count: number;
  gaps: number[];
  companionDelayMs: number;
};

function isTrackedTraffic(url: string): boolean {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes(":8080") ||
    url.includes("firebasedatabase") ||
    url.includes(":9000")
  );
}

async function readDiag(page: Page): Promise<PacerDiag> {
  return page.evaluate(() => {
    const fn = (
      window as unknown as {
        __rtwPacerDiag?: () => PacerDiag;
      }
    ).__rtwPacerDiag;
    if (!fn) throw new Error("__rtwPacerDiag missing");
    return fn();
  });
}

async function readZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const named = (window as unknown as { __RTW_MAP__?: { getZoom?: () => number } }).__RTW_MAP__;
    if (named && typeof named.getZoom === "function") return named.getZoom();
    const canvas = document.querySelector(".mapboxgl-canvas") as
      | { _map?: { getZoom?: () => number } }
      | null;
    const z = canvas?._map?.getZoom?.();
    return typeof z === "number" ? z : Number.NaN;
  });
}

async function ensureZoomAtLeast(page: Page, minZoom: number): Promise<number> {
  let zoom = await readZoom(page);
  for (let i = 0; zoom < minZoom && i < 14; i += 1) {
    const button = page.getByRole("button", { name: "줌 확대" });
    if (await button.isDisabled().catch(() => true)) break;
    await button.click();
    await page.waitForTimeout(250);
    zoom = await readZoom(page);
  }
  return zoom;
}

function gapSign(gap: number): number {
  if (gap > 0.4) return 1;
  if (gap < -0.4) return -1;
  return 0;
}

test.describe("페이서 혼자 주행", () => {
  test("표시·토글·추월·트래픽", async ({ page }) => {
    test.setTimeout(480_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });

    let traffic = 0;
    let counting = false;
    let breakdown = new Map<string, number>();
    const onRequest = (req: Request) => {
      if (!counting) return;
      if (!isTrackedTraffic(req.url())) return;
      traffic += 1;
      const u = new URL(req.url());
      const key = `${req.method()} ${u.host}${u.pathname.replace(/\/documents\/.*/, "/documents/…")}`;
      breakdown.set(key, (breakdown.get(key) ?? 0) + 1);
    };
    const dumpBreakdown = (label: string) => {
      const rows = [...breakdown.entries()].sort((a, b) => b[1] - a[1]);
      console.log(`PACER_TRAFFIC_BREAKDOWN ${label} ${JSON.stringify(rows)}`);
      breakdown = new Map();
    };
    page.on("request", onRequest);

    await page.goto("/");
    await guestStart(page);
    await loadIntroCourse(page, { pick: "longest" });
    await ensureRiding(page);
    await setSpeedKmh(page, 25);

    await expect
      .poll(async () => (await readDiag(page)).count, { timeout: 20_000 })
      .toBe(2);

    const zoom = await ensureZoomAtLeast(page, 17);
    expect(zoom, `zoom ${zoom}`).toBeGreaterThanOrEqual(17);

    const signs = [0, 0];
    const shots: string[] = [];
    let sawAhead = false;
    let sawBehind = false;
    const watchStart = Date.now();
    let checkedAt20 = false;

    while (Date.now() - watchStart < 90_000 && shots.length < 6) {
      const diag = await readDiag(page);
      const elapsed = Date.now() - watchStart;
      if (!checkedAt20 && elapsed >= 20_000) {
        checkedAt20 = true;
        expect(diag.visible).toBe(true);
        expect(diag.count).toBe(2);
        expect(diag.companionDelayMs).toBe(0);
        for (const gap of diag.gaps) expect(Math.abs(gap)).toBeLessThanOrEqual(20);
        // 주행 중 동행 블록은 activeRide 에서 숨는다(기존 MapHud). 페이서가 그 블록을
        // 열거나 「다른 라이더」로 바꾸면 안 된다.
        await expect(page.locator(".hud-ride-presence")).toHaveCount(0);
        await expect(page.getByText(/다른 라이더가|지금 [2-9]명/)).toHaveCount(0);
        const hud = await page.evaluate(() => {
          const fn = (window as unknown as { __rtwHudDiag?: () => {
            coursePeerNamesLength: number;
            coursePeerHud: { id: string }[];
          } }).__rtwHudDiag;
          if (!fn) return null;
          const snap = fn();
          return {
            names: snap.coursePeerNamesLength,
            ids: snap.coursePeerHud.map((p) => p.id),
          };
        });
        expect(hud, "window.__rtwHudDiag").not.toBeNull();
        expect(hud!.names).toBe(0);
        expect(hud!.ids.some((id) => id.startsWith("pacer"))).toBe(false);
        const tags = page.locator(".map-view__rider-nametag--pacer");
        await expect(tags).toHaveCount(2);
        await page.screenshot({ path: path.join(OUT_DIR, "solo-running.png") });
      }
      if (diag.count === 2 && diag.gaps.length === 2) {
        for (let i = 0; i < 2; i += 1) {
          const next = gapSign(diag.gaps[i] ?? 0);
          const prev = signs[i] ?? 0;
          if (prev !== 0 && next !== 0 && next !== prev && shots.length < 6) {
            const dir = next > 0 ? "ahead" : "behind";
            if (dir === "ahead") sawAhead = true;
            else sawBehind = true;
            const name = `overtake-${shots.length + 1}-${dir}.png`;
            await page.screenshot({ path: path.join(OUT_DIR, name) });
            shots.push(name);
          }
          if (next !== 0) signs[i] = next;
        }
      }
      await page.waitForTimeout(200);
    }

    expect(checkedAt20, "20초 시점 확인").toBe(true);
    expect(shots.length, `overtake shots ${shots.join(",")}`).toBeGreaterThanOrEqual(3);
    expect(sawAhead, "페이서가 앞으로 가는 장면").toBe(true);
    expect(sawBehind, "페이서가 뒤로 가는 장면").toBe(true);

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "주행 설정" }).click();
    const sheet = page.getByRole("dialog", { name: "주행 설정" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("checkbox", { name: "페이서" }).uncheck();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await readDiag(page)).count, { timeout: 5_000 }).toBe(0);
    await page.screenshot({ path: path.join(OUT_DIR, "off.png") });

    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "주행 설정" }).click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("checkbox", { name: "페이서" }).check();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    // 다시 켜면 차례 등장(5초·10초)을 다시 거친다
    await expect.poll(async () => (await readDiag(page)).count, { timeout: 15_000 }).toBe(2);

    // 순서 효과를 빼려고 끔 → 켬 순서로 잰다(직전 시트 조작 직후 구간이 「켬」에만 몰리지 않게).
    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "주행 설정" }).click();
    await sheet.getByRole("checkbox", { name: "페이서" }).uncheck();
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await readDiag(page)).count, { timeout: 5_000 }).toBe(0);
    await page.waitForTimeout(5_000);
    counting = true;
    traffic = 0;
    breakdown = new Map();
    await page.waitForTimeout(60_000);
    const offCount = traffic;
    dumpBreakdown("off");
    counting = false;
    await page.getByRole("button", { name: "Trail 메뉴" }).click();
    await page.getByRole("button", { name: "주행 설정" }).click();
    await sheet.getByRole("checkbox", { name: "페이서" }).check();
    await page.keyboard.press("Escape");
    // 다시 켜면 차례 등장(5초·10초)을 다시 거친다
    await expect.poll(async () => (await readDiag(page)).count, { timeout: 15_000 }).toBe(2);
    await page.waitForTimeout(5_000);
    counting = true;
    traffic = 0;
    breakdown = new Map();
    await page.waitForTimeout(60_000);
    const onCount = traffic;
    dumpBreakdown("on");
    counting = false;
    const ratio = offCount === 0 ? (onCount === 0 ? 1 : Infinity) : onCount / offCount;
    console.log(`PACER_TRAFFIC on=${onCount} off=${offCount} ratio=${ratio}`);
    expect(Math.abs(onCount - offCount) / Math.max(onCount, offCount, 1)).toBeLessThanOrEqual(0.1);

    page.off("request", onRequest);
  });
});
