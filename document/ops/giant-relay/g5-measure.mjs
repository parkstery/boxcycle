// G-5(개정) 화면 계측 — follow 모드·카메라 거리 전수로 inSafeArea·줌·라이더 화면좌표를 잰다.
// G-3 의 g3-measure.mjs 진입 시퀀스를 그대로 쓰고, 판정 항목에 inSafeArea 를 더했다.
//   node g4-measure.mjs <phase> <baseURL> <outDir>
import { chromium } from "file:///C:/20.HDev/boxcycle-giant/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const PHASE = process.argv[2] ?? "before";
const BASE = process.argv[3] ?? "http://127.0.0.1:5020";
const OUT_DIR = process.argv[4] ?? ".";
const SOURCE_ID = "boxcycle-rider-prototype-source";

/** 슬라이더를 비율로 훑는다(하한·25·50·75·상한) — 절대 거리는 배율마다 다르다 */
const SLIDER_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
/** 절대 거리로 훑고 싶을 때(회귀 비교용) — 예: G5_DISTANCES="10,20,40" */
const ABS_DISTANCES = process.env.G5_DISTANCES
  ? process.env.G5_DISTANCES.split(",").map(Number)
  : null;
/** follow 모드 전수 — pitch 80 계열이 look-at 오프셋에 취약하다 */
const FOLLOW_MODES = [
  { title: "Rear 30°", key: "rear30" },
  { title: "Front 30°", key: "front30" },
  { title: "Left side", key: "leftFlat" },
  { title: "North up", key: "north" },
  { title: "Top-down (overhead)", key: "topDown" },
];

const log = (...a) => console.log(`[${PHASE}]`, ...a);

async function enterRide(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const guestGate = page.locator(".guest-entry");
  const authGate = page.locator(".auth-gate");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await guestGate.isVisible().catch(() => false)) {
      await guestGate
        .getByRole("button", { name: "시작", exact: true })
        .click({ timeout: 10_000 })
        .catch(() => {});
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

  // 센서 없이 시작하려면 「체험 속도로 준비」를 명시적으로 골라야 한다
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
  log("running");
}

async function openSheet(page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (await sheet.isVisible().catch(() => false)) return sheet;
  await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  return sheet;
}

async function closeSheet(page) {
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  if (!(await sheet.isVisible().catch(() => false))) return;
  await sheet.getByRole("button", { name: "닫기" }).first().click({ timeout: 10_000 }).catch(() => {});
  await sheet.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
}

/** 화면 계측 한 건 — 카메라·라이더 좌표·안전영역 판정 */
async function sample(page) {
  return page.evaluate((sourceId) => {
    const m = window.__RTW_MAP__;
    const c = m?.getCenter?.();
    const el = m?.getContainer?.();
    const src = m?.getSource?.(sourceId);
    const models = src?._options?.models ?? src?._models ?? {};
    const self = models["live-self"]?.position ?? Object.values(models)[0]?.position ?? null;

    let offsetM = null;
    let screen = null;
    if (self && c) {
      const R = 6378137;
      const x = (((self[0] - c.lng) * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * R;
      const y = (((self[1] - c.lat) * Math.PI) / 180) * R;
      offsetM = Math.round(Math.hypot(x, y) * 100) / 100;
      const pt = m.project([self[0], self[1]]);
      const finite = Number.isFinite(pt.x) && Number.isFinite(pt.y) && Math.abs(pt.x) < 1e6;
      screen = finite ? { x: Math.round(pt.x), y: Math.round(pt.y) } : null;
    }

    const d = window.__RTW_RIDER_SCREEN_DIAG__ ?? null;
    const scale = (() => {
      try {
        return m?.getPaintProperty?.("boxcycle-rider-prototype-layer", "model-scale") ?? null;
      } catch {
        return null;
      }
    })();

    return {
      zoom: m?.getZoom?.() ?? null,
      pitch: m?.getPitch?.() ?? null,
      bearing: m?.getBearing?.() ?? null,
      center: c ? [c.lng, c.lat] : null,
      viewport: { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 },
      modelScale: Array.isArray(scale) ? scale[0] : scale,
      riderOffsetM: offsetM,
      riderScreen: screen,
      diag: d
        ? {
            inSafeArea: d.inSafeArea,
            headTopPx: Math.round(d.headTopPx),
            wheelBottomPx: Math.round(d.wheelBottomPx),
            leftPx: Math.round(d.leftPx),
            rightPx: Math.round(d.rightPx),
            viewportW: d.viewportW,
            viewportH: d.viewportH,
          }
        : null,
      nametag: (() => {
        const e = document.querySelector(".map-view__rider-nametag");
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { fontSize: getComputedStyle(e).fontSize, w: Math.round(r.width * 10) / 10 };
      })(),
    };
  }, SOURCE_ID);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "shots"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await enterRide(page);

  const results = { phase: PHASE, baseURL: BASE, followModes: [], distances: [] };

  // 3D 뷰 on
  let sheet = await openSheet(page);
  const threeD = sheet.locator('input[type="checkbox"]').first();
  if (!(await threeD.isChecked().catch(() => true))) await threeD.check().catch(() => {});
  await closeSheet(page);

  // A. follow 모드 전수 (거리 기본 40m)
  for (const mode of FOLLOW_MODES) {
    sheet = await openSheet(page);
    await sheet.locator(`button[title="${mode.title}"]`).click({ timeout: 10_000 });
    await closeSheet(page);
    await page.waitForTimeout(5_000);
    const s = await sample(page);
    results.followModes.push({ mode: mode.key, ...s });
    log(
      `mode ${mode.key.padEnd(9)} zoom ${String(s.zoom?.toFixed(3)).padStart(7)} pitch ${String(
        Math.round(s.pitch),
      ).padStart(3)} offset ${String(s.riderOffsetM).padStart(7)}m inSafeArea=${s.diag?.inSafeArea}`,
    );
    await page.screenshot({ path: path.join(OUT_DIR, "shots", `g5-${PHASE}-${mode.key}.png`) });
  }

  // B. 슬라이더 전 구간 (후방 고정) — min/max 를 페이지에서 읽어 비율로 훑는다
  sheet = await openSheet(page);
  await sheet.locator('button[title="Rear 30°"]').click({ timeout: 10_000 });
  const bounds = await sheet.getByRole("slider", { name: /거리 / }).evaluate((el) => ({
    min: Number(el.min),
    max: Number(el.max),
    step: Number(el.step),
  }));
  results.sliderBounds = bounds;
  log(`슬라이더 범위 ${bounds.min}–${bounds.max} m · 눈금 ${bounds.step} m`);
  await closeSheet(page);

  const points = ABS_DISTANCES
    ? ABS_DISTANCES.map((d) => ({ frac: null, d }))
    : SLIDER_FRACTIONS.map((frac) => ({ frac, d: bounds.min + (bounds.max - bounds.min) * frac }));
  for (const { frac, d } of points) {
    sheet = await openSheet(page);
    await sheet.getByRole("slider", { name: /거리 / }).fill(String(d));
    await closeSheet(page);
    await page.waitForTimeout(5_000);
    const s = await sample(page);
    results.distances.push({ sliderFraction: frac, distanceM: d, ...s });
    const dg = s.diag;
    const occupancy = dg ? (dg.wheelBottomPx - dg.headTopPx) / dg.viewportH : null;
    log(
      `${frac == null ? "거리".padStart(3) : String(Math.round(frac * 100)).padStart(3) + "%"} (${d.toFixed(1)}m)  zoom ${String(
        s.zoom?.toFixed(3),
      ).padStart(7)}  라이더세로 ${String(dg ? dg.wheelBottomPx - dg.headTopPx : "?").padStart(5)}px ` +
        `(${occupancy != null ? (occupancy * 100).toFixed(1) : "?"}%)  inSafeArea=${dg?.inSafeArea}`,
    );
    await page.screenshot({
      path: path.join(OUT_DIR, "shots", `g5-${PHASE}-${frac == null ? "d" + d : "slider" + Math.round(frac * 100)}.png`),
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, `g5r-metrics-${PHASE}.json`), JSON.stringify(results, null, 2));
  await browser.close();
  log("done");
}

main().catch((e) => {
  console.error(`[${PHASE}] FAILED:`, e.message);
  process.exit(1);
});
