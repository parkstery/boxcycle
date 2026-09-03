// G-4 2차원 실측 — (줌 완화량 Δzoom × look-at 오프셋) 격자에서 inSafeArea 를 판정한다.
// 클램프만으로 불변식을 못 세우는지, 세우려면 spanM 을 얼마나 넓혀야 하는지를 수치로 정한다.
//   node g4-sweep2d.mjs <label> <baseURL> <outJson>
import { chromium } from "file:///C:/20.HDev/boxcycle-giant/node_modules/playwright/index.mjs";
import fs from "node:fs";

const LABEL = process.argv[2] ?? "f20";
const BASE = process.argv[3] ?? "http://127.0.0.1:5021";
const OUT = process.argv[4] ?? `g4-sweep2d-${LABEL}.json`;
const SOURCE_ID = "boxcycle-rider-prototype-source";
const log = (...a) => console.log(`[${LABEL}]`, ...a);

async function enterRide(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const g = page.locator(".guest-entry");
  const a = page.locator(".auth-gate");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await g.isVisible().catch(() => false)) {
      await g.getByRole("button", { name: "시작", exact: true }).click({ timeout: 10_000 }).catch(() => {});
    } else if (await a.isVisible().catch(() => false)) {
      await a.getByRole("button", { name: "닫기" }).click({ timeout: 10_000 }).catch(() => {});
    } else if (await page.getByRole("button", { name: "Trail 메뉴" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(700);
  }
  await g.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await a.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await page.getByRole("button", { name: "Trail 메뉴" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "입문" }).click({ timeout: 20_000 });
  const items = page.locator("button.oc-modal__item");
  await items.first().waitFor({ state: "visible", timeout: 30_000 });
  await items.first().click();
  const mc = page.locator(".oc-modal__close");
  if (await mc.isVisible().catch(() => false)) await mc.click().catch(() => {});
  await page.locator("button.hud-cadence").click({ timeout: 20_000 });
  await page.getByRole("button", { name: /체험 속도로 (준비|전환)/ }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "센서 설정 닫기" }).click({ timeout: 10_000 }).catch(() => {});
  await page.locator(".cadence-sheet").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  const s = page.getByRole("button", { name: "주행 시작" });
  await s.waitFor({ state: "visible", timeout: 40_000 });
  const dl = Date.now() + 90_000;
  while (Date.now() < dl) {
    if (await s.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(1_000);
  }
  await s.click();
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
    const t = m.transform ?? {};
    return {
      zoom: m.getZoom(),
      pitch: m.getPitch(),
      bearing: m.getBearing(),
      lat: m.getCenter().lat,
      fovRaw: t.fov ?? null,
      cameraToCenterDistance: t.cameraToCenterDistance ?? null,
      modelScale: (() => {
        try {
          const s = m.getPaintProperty("boxcycle-rider-prototype-layer", "model-scale");
          return Array.isArray(s) ? s[0] : s;
        } catch {
          return null;
        }
      })(),
    };
  });
  log("기준:", JSON.stringify(base));

  await setFollow(page, "Free camera");
  await page.waitForTimeout(1_500);

  const dzooms = process.env.G4_DZOOMS
    ? process.env.G4_DZOOMS.split(",").map(Number)
    : (() => {
        const a = [];
        for (let d = 0; d >= -3.01; d -= 0.25) a.push(Math.round(d * 100) / 100);
        return a;
      })();
  const offsets = process.env.G4_OFFSETS
    ? process.env.G4_OFFSETS.split(",").map(Number)
    : (() => {
        const a = [];
        for (let o = 0; o <= 60; o += 2) a.push(o);
        return a;
      })();

  const grid = await page.evaluate(
    async ({ dzooms, offsets, base, sourceId }) => {
      const m = window.__RTW_MAP__;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const riderPos = () => {
        const src = m.getSource(sourceId);
        const models = src?._options?.models ?? src?._models ?? {};
        return models["live-self"]?.position ?? Object.values(models)[0]?.position ?? null;
      };
      const off = (ll, bearingDeg, meters) => {
        const R = 6378137;
        const br = (bearingDeg * Math.PI) / 180;
        return [
          ll[0] + ((meters * Math.sin(br)) / (R * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI),
          ll[1] + ((meters * Math.cos(br)) / R) * (180 / Math.PI),
        ];
      };
      const out = [];
      for (const dz of dzooms) {
        const row = { dzoom: dz, zoom: base.zoom + dz, ok: [], best: null };
        for (const o of offsets) {
          const rider = riderPos();
          if (!rider) continue;
          m.stop();
          m.jumpTo({ center: off(rider, base.bearing, o), zoom: base.zoom + dz, pitch: base.pitch, bearing: base.bearing });
          await frame();
          await frame();
          await frame();
          await frame();
          const d = window.__RTW_RIDER_SCREEN_DIAG__;
          if (d?.inSafeArea) row.ok.push(o);
          if (o === 0) row.atZero = { head: Math.round(d?.headTopPx ?? NaN), wheel: Math.round(d?.wheelBottomPx ?? NaN) };
        }
        if (row.ok.length) {
          const spanM = 40 * Math.pow(2, -dz);
          row.best = { minM: Math.min(...row.ok), maxM: Math.max(...row.ok), spanM };
          row.ratio = { min: Math.min(...row.ok) / spanM, max: Math.max(...row.ok) / spanM };
        }
        out.push(row);
      }
      return out;
    },
    { dzooms, offsets, base, sourceId: SOURCE_ID },
  );

  fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, base, grid }, null, 2));
  for (const r of grid) {
    const px = r.atZero ? `riderPx@0=${r.atZero.wheel - r.atZero.head}` : "";
    log(
      `Δzoom ${String(r.dzoom).padStart(6)}  zoom ${r.zoom.toFixed(3)}  span×${Math.pow(2, -r.dzoom).toFixed(
        2,
      )}  ${px.padEnd(16)}  safe창 ${
        r.best
          ? `${r.best.minM}–${r.best.maxM} m (spanM ${r.best.spanM.toFixed(1)} · 비율 ${r.ratio.max.toFixed(3)})`
          : "없음"
      }`,
    );
  }
  await browser.close();
}

main().catch((e) => {
  console.error(`[${LABEL}] FAILED:`, e.message);
  process.exit(1);
});
