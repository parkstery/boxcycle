// G-5 margin 실측 — pitch 별로 「라이더가 안전영역에 들어가는 최소 span 배율」을 잰다.
//
// 판정은 최종 코드 경로를 그대로 재현한다: span = margin × 전고 로 zoom 을 만들고,
// look-at 오프셋은 G-4 클램프(min(pelvis/tanDep, span × 0.65))를 적용해 카메라를 놓는다.
// 즉 여기서 나온 margin 을 `RIDER_HEIGHT_SPAN_MARGIN` 에 넣으면 그대로 재현된다.
//   node g5-margin-sweep.mjs <label> <baseURL> <outJson>
import { chromium } from "file:///C:/20.HDev/boxcycle-giant/node_modules/playwright/index.mjs";
import fs from "node:fs";

const LABEL = process.argv[2] ?? "f20";
const BASE = process.argv[3] ?? "http://127.0.0.1:5021";
const OUT = process.argv[4] ?? `g5-margin-${LABEL}.json`;
const SOURCE_ID = "boxcycle-rider-prototype-source";
const LAYER_ID = "boxcycle-rider-prototype-layer";

/** rig 파생값 — 하드코딩이 아니라 riderRig.geometry.mjs 에서 읽어 온다 */
const rig = await import("file:///C:/20.HDev/boxcycle-giant/apps/web/src/lib/riderPrototype/riderRig.geometry.mjs");
const HEAD_Y = rig.HEAD_C[1];
const PELVIS_Y = rig.PELVIS_ROOT[1];

const PITCHES = process.env.G5_PITCHES ? process.env.G5_PITCHES.split(",").map(Number) : [0, 30, 45, 60, 70, 80];
const MARGINS = (() => {
  if (process.env.G5_MARGINS) return process.env.G5_MARGINS.split(",").map(Number);
  const a = [];
  for (let m = 0.2; m <= 6.001; m += 0.1) a.push(Math.round(m * 100) / 100);
  return a;
})();
const LOOKAT_RATIO = 0.65;
const SAFE = { top: 52, bottom: 120, left: 44, right: 44 };

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

  // 3D 를 켠 뒤 free 로 고정한다 — follow tick 이 카메라를 되돌리면 안 된다
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  const threeD = sheet.locator('input[type="checkbox"]').first();
  if (!(await threeD.isChecked().catch(() => true))) await threeD.check().catch(() => {});
  await sheet.getByRole("button", { name: "닫기" }).first().click().catch(() => {});
  await sheet.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await setFollow(page, "Rear 30°");
  await page.waitForTimeout(5_000);
  const bearing = await page.evaluate(() => window.__RTW_MAP__.getBearing());
  await setFollow(page, "Free camera");
  await page.waitForTimeout(1_500);

  const modelScale = await page.evaluate((id) => {
    const s = window.__RTW_MAP__.getPaintProperty(id, "model-scale");
    return Array.isArray(s) ? s[0] : s;
  }, LAYER_ID);
  const displayHeightM = HEAD_Y * modelScale;
  const lookAtHeightM = PELVIS_Y * modelScale;
  log(`model-scale ${modelScale} · 전고 ${displayHeightM.toFixed(2)}m · 골반 ${lookAtHeightM.toFixed(2)}m`);

  const rows = await page.evaluate(
    async (args) => {
      const { pitches, margins, bearing, displayHeightM, lookAtHeightM, ratio, safe, sourceId } = args;
      const m = window.__RTW_MAP__;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const riderPos = () => {
        const src = m.getSource(sourceId);
        const models = src?._options?.models ?? src?._models ?? {};
        return models["live-self"]?.position ?? Object.values(models)[0]?.position ?? null;
      };
      const offsetLL = (ll, brg, meters) => {
        const R = 6378137;
        const br = (brg * Math.PI) / 180;
        return [
          ll[0] + ((meters * Math.sin(br)) / (R * Math.cos((ll[1] * Math.PI) / 180))) * (180 / Math.PI),
          ll[1] + ((meters * Math.cos(br)) / R) * (180 / Math.PI),
        ];
      };
      const safeH = 900 - safe.top - safe.bottom;

      const out = [];
      for (const pitch of pitches) {
        const depression = ((90 - pitch) * Math.PI) / 180;
        const tanDep = Math.tan(Math.max(0.017, depression));
        for (const margin of margins) {
          const rider = riderPos();
          if (!rider) continue;
          const spanM = margin * displayHeightM;
          const lookAt = Math.min(lookAtHeightM / tanDep, spanM * ratio);
          // 앱과 동일한 zoom 산식
          const targetMpp = spanM / safeH;
          const mppAtZ0 = 156543.03392 * Math.cos((rider[1] * Math.PI) / 180);
          const zoom = Math.log2(mppAtZ0 / Math.max(1e-9, targetMpp)) - (pitch / 90) * 0.6;
          m.stop();
          m.jumpTo({ center: offsetLL(rider, bearing, lookAt), zoom, pitch, bearing });
          await frame();
          await frame();
          await frame();
          await frame();
          const d = window.__RTW_RIDER_SCREEN_DIAG__;
          out.push({
            pitch,
            margin,
            spanM,
            lookAtM: lookAt,
            zoomWanted: zoom,
            zoomActual: m.getZoom(),
            inSafeArea: d?.inSafeArea ?? null,
            riderPx: d ? Math.round(d.wheelBottomPx - d.headTopPx) : null,
            headTopPx: d ? Math.round(d.headTopPx) : null,
            wheelBottomPx: d ? Math.round(d.wheelBottomPx) : null,
            widthPx: d ? Math.round(d.rightPx - d.leftPx) : null,
          });
        }
      }
      return out;
    },
    {
      pitches: PITCHES,
      margins: MARGINS,
      bearing,
      displayHeightM,
      lookAtHeightM,
      ratio: LOOKAT_RATIO,
      safe: SAFE,
      sourceId: SOURCE_ID,
    },
  );

  // pitch 별 최소 통과 margin — zoom 이 clamp 된 표본은 신뢰할 수 없어 제외한다
  const perPitch = [];
  for (const pitch of PITCHES) {
    const rs = rows.filter((r) => r.pitch === pitch && Math.abs(r.zoomWanted - r.zoomActual) < 0.01);
    const ok = rs.filter((r) => r.inSafeArea === true);
    // 최소값 하나가 아니라 「여기부터 끝까지 계속 참」인 지점을 찾는다(들쭉날쭉 방지)
    let stable = null;
    for (let i = 0; i < rs.length; i++) {
      if (rs.slice(i).every((r) => r.inSafeArea === true)) {
        stable = rs[i].margin;
        break;
      }
    }
    perPitch.push({
      pitch,
      minOkMargin: ok.length ? Math.min(...ok.map((r) => r.margin)) : null,
      stableFromMargin: stable,
      clampedSamples: rows.filter((r) => r.pitch === pitch).length - rs.length,
    });
  }

  fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, modelScale, displayHeightM, lookAtHeightM, perPitch, rows }, null, 2));
  log("pitch 별 최소 통과 margin:");
  for (const p of perPitch) {
    log(
      `  pitch ${String(p.pitch).padStart(2)}°  최초통과 ${String(p.minOkMargin).padStart(5)}  ` +
        `이후계속참 ${String(p.stableFromMargin).padStart(5)}  (zoom clamp 제외 ${p.clampedSamples}건)`,
    );
  }
  await browser.close();
}

main().catch((e) => {
  console.error(`[${LABEL}] FAILED:`, e.message);
  process.exit(1);
});
