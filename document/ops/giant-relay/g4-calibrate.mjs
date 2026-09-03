// G-4 비율 실측 — look-at 오프셋을 살아 있는 지도에서 직접 쓸어 inSafeArea 창을 찾는다.
// 앱을 다시 빌드하지 않고 실제 mapbox 투영으로 판정하므로, 순수 근사가 아니라 실측이다.
//   node g4-calibrate.mjs <label> <baseURL> <outJson>
import { chromium } from "file:///C:/20.HDev/boxcycle-giant/node_modules/playwright/index.mjs";
import fs from "node:fs";

const LABEL = process.argv[2] ?? "f1";
const BASE = process.argv[3] ?? "http://127.0.0.1:5020";
const OUT = process.argv[4] ?? `g4-calibrate-${LABEL}.json`;
const SOURCE_ID = "boxcycle-rider-prototype-source";

const log = (...a) => console.log(`[${LABEL}]`, ...a);

async function enterRide(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const guestGate = page.locator(".guest-entry");
  const authGate = page.locator(".auth-gate");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await guestGate.isVisible().catch(() => false)) {
      await guestGate.getByRole("button", { name: "시작", exact: true }).click({ timeout: 10_000 }).catch(() => {});
    } else if (await authGate.isVisible().catch(() => false)) {
      await authGate.getByRole("button", { name: "닫기" }).click({ timeout: 10_000 }).catch(() => {});
    } else if (await page.getByRole("button", { name: "Trail 메뉴" }).isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(700);
  }
  await guestGate.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await authGate.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  await page.getByRole("button", { name: "Trail 메뉴" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "입문" }).click({ timeout: 20_000 });
  const items = page.locator("button.oc-modal__item");
  await items.first().waitFor({ state: "visible", timeout: 30_000 });
  await items.first().click();
  const modalClose = page.locator(".oc-modal__close");
  if (await modalClose.isVisible().catch(() => false)) await modalClose.click().catch(() => {});

  await page.locator("button.hud-cadence").click({ timeout: 20_000 });
  await page.getByRole("button", { name: /체험 속도로 (준비|전환)/ }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "센서 설정 닫기" }).click({ timeout: 10_000 }).catch(() => {});
  await page.locator(".cadence-sheet").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

  const startBtn = page.getByRole("button", { name: "주행 시작" });
  await startBtn.waitFor({ state: "visible", timeout: 40_000 });
  const enableDeadline = Date.now() + 90_000;
  while (Date.now() < enableDeadline) {
    if (await startBtn.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(1_000);
  }
  await startBtn.click();
  await page.getByRole("button", { name: "주행 종료" }).waitFor({ state: "visible", timeout: 40_000 });
  await page.waitForTimeout(4_000);
}

async function setFollow(page, title) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
    await sheet.waitFor({ state: "visible", timeout: 15_000 });
  }
  await sheet.locator(`button[title="${title}"]`).click({ timeout: 10_000 });
  await sheet.getByRole("button", { name: "닫기" }).first().click({ timeout: 10_000 }).catch(() => {});
  await sheet.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await enterRide(page);
  log("running");

  // 3D on → 후방으로 실제 프레이밍(zoom·pitch·bearing)을 확보한 뒤 free 로 고정한다
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  const threeD = sheet.locator('input[type="checkbox"]').first();
  if (!(await threeD.isChecked().catch(() => true))) await threeD.check().catch(() => {});
  await sheet.getByRole("button", { name: "닫기" }).first().click().catch(() => {});
  await sheet.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await setFollow(page, "Rear 30°");
  await page.waitForTimeout(5_000);

  const base = await page.evaluate(() => {
    const m = window.__RTW_MAP__;
    return { zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing() };
  });
  log("rear30 프레이밍:", JSON.stringify(base));

  await setFollow(page, "Free camera");
  await page.waitForTimeout(1_500);

  // 오프셋 전수 — 라이더 위치는 매 회 다시 읽어 이동을 흡수한다
  const offsets = [];
  for (let o = 0; o <= 130; o += 2) offsets.push(o);

  const rows = await page.evaluate(
    async ({ offsets, base, sourceId }) => {
      const m = window.__RTW_MAP__;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const riderPos = () => {
        const src = m.getSource(sourceId);
        const models = src?._options?.models ?? src?._models ?? {};
        return models["live-self"]?.position ?? Object.values(models)[0]?.position ?? null;
      };
      const offsetLngLat = (ll, bearingDeg, meters) => {
        const R = 6378137;
        const br = (bearingDeg * Math.PI) / 180;
        const dN = meters * Math.cos(br);
        const dE = meters * Math.sin(br);
        const lat = ll[1] + (dN / R) * (180 / Math.PI);
        const lng = ll[0] + (dE / (R * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI);
        return [lng, lat];
      };

      const out = [];
      for (const off of offsets) {
        const rider = riderPos();
        if (!rider) continue;
        // 앱과 동일: viewBearing = (offsetBearing+180)%360 = 지도 bearing 방향
        const center = offsetLngLat(rider, base.bearing, off);
        m.stop();
        m.jumpTo({ center, zoom: base.zoom, pitch: base.pitch, bearing: base.bearing });
        await frame();
        await frame();
        await frame();
        await frame();
        const d = window.__RTW_RIDER_SCREEN_DIAG__ ?? null;
        out.push({
          offsetM: off,
          inSafeArea: d?.inSafeArea ?? null,
          headTopPx: d ? Math.round(d.headTopPx) : null,
          wheelBottomPx: d ? Math.round(d.wheelBottomPx) : null,
          leftPx: d ? Math.round(d.leftPx) : null,
          rightPx: d ? Math.round(d.rightPx) : null,
        });
      }
      return out;
    },
    { offsets, base, sourceId: SOURCE_ID },
  );

  const ok = rows.filter((r) => r.inSafeArea === true).map((r) => r.offsetM);
  const result = {
    label: LABEL,
    baseURL: BASE,
    framing: base,
    safeArea: { top: 52, bottom: 120, left: 44, right: 44 },
    rows,
    inSafeAreaOffsets: ok,
    window: ok.length ? { minM: Math.min(...ok), maxM: Math.max(...ok) } : null,
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

  log("inSafeArea=true 오프셋 창:", ok.length ? `${Math.min(...ok)}–${Math.max(...ok)} m` : "없음");
  for (const r of rows) {
    if (r.offsetM % 10 === 0 || r.inSafeArea) {
      log(
        `off ${String(r.offsetM).padStart(3)}m  head ${String(r.headTopPx).padStart(6)}  wheel ${String(
          r.wheelBottomPx,
        ).padStart(6)}  x[${r.leftPx},${r.rightPx}]  safe=${r.inSafeArea}`,
      );
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(`[${LABEL}] FAILED:`, e.message);
  process.exit(1);
});
