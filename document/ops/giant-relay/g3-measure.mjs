// G-3 화면 확인 — 줌·model-scale·네임태그·접지 스크린샷.
// phase(before|after) 와 baseURL·출력경로를 인자로 받는다.
import { chromium } from "file:///C:/20.HDev/boxcycle-giant/node_modules/playwright/index.mjs";
import fs from "node:fs";

const PHASE = process.argv[2] ?? "before";
const BASE = process.argv[3] ?? "http://127.0.0.1:5020";
const OUT_PNG = process.argv[4];
const OUT_JSON = process.argv[5];
const LAYER_ID = process.env.G3_LAYER_ID ?? "rider-glb-model";

const log = (...a) => console.log(`[${PHASE}]`, ...a);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") log("console.error:", m.text().slice(0, 200));
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // 0) 진입 게이트 — 인증(auth-gate)·시작(guest-entry) 이 사라질 때까지
  const guestGate = page.locator(".guest-entry");
  const authGate = page.locator(".auth-gate");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await guestGate.isVisible().catch(() => false)) {
      await guestGate
        .getByRole("button", { name: "시작", exact: true })
        .click({ timeout: 10_000 })
        .catch(() => {});
      log("guest-entry 시작 클릭");
    } else if (await authGate.isVisible().catch(() => false)) {
      await authGate.getByRole("button", { name: "닫기" }).click({ timeout: 10_000 }).catch(() => {});
      log("auth-gate 닫기");
    } else if (await page.getByRole("button", { name: "Trail 메뉴" }).isVisible().catch(() => false)) {
      log("게이트 통과");
      break;
    }
    await page.waitForTimeout(700);
  }
  await guestGate.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await authGate.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

  // 1) 입문 코스 선택
  await page.getByRole("button", { name: "Trail 메뉴" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "입문" }).click({ timeout: 20_000 });
  const items = page.locator("button.oc-modal__item");
  await items.first().waitFor({ state: "visible", timeout: 30_000 });
  log("입문 코스", await items.count(), "개");
  await items.first().click();

  // 1b) 모달 닫기 — 열려 있으면 Go 를 가린다
  const modalClose = page.locator(".oc-modal__close");
  if (await modalClose.isVisible().catch(() => false)) {
    await modalClose.click().catch(() => {});
    log("코스 모달 닫음");
  }

  // 1c) 주행 입력 준비 — 센서 없이 시작하려면 「체험 속도로 준비」를 명시적으로 골라야 한다
  await page.locator("button.hud-cadence").click({ timeout: 20_000 });
  const manualBtn = page.getByRole("button", { name: /체험 속도로 (준비|전환)/ });
  await manualBtn.click({ timeout: 15_000 });
  log("체험 속도로 준비 선택");
  await page.getByRole("button", { name: "센서 설정 닫기" }).click({ timeout: 10_000 }).catch(() => {});
  await page.locator(".cadence-sheet").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

  // 2) 주행 시작 — 경로 로드가 끝나야 enabled 가 된다
  const startBtn = page.getByRole("button", { name: "주행 시작" });
  await startBtn.waitFor({ state: "visible", timeout: 40_000 });
  const enableDeadline = Date.now() + 90_000;
  let enabled = false;
  while (Date.now() < enableDeadline) {
    enabled = await startBtn.isEnabled().catch(() => false);
    if (enabled) break;
    await page.waitForTimeout(1_000);
  }
  log("주행 시작 enabled =", enabled);
  if (!enabled) {
    await page.screenshot({ path: OUT_PNG ? OUT_PNG.replace(/\.png$/, "-stuck.png") : "stuck.png" });
    const dock = await page.evaluate(() => document.querySelector(".route-dock")?.textContent?.slice(0, 300) ?? null);
    log("route-dock:", dock);
    throw new Error("주행 시작 버튼이 활성화되지 않음");
  }

  const readCam = () =>
    page.evaluate(() => {
      const m = window.__RTW_MAP__;
      const c = m?.getCenter?.();
      const el = m?.getContainer?.();
      return {
        zoom: m?.getZoom?.() ?? null,
        pitch: m?.getPitch?.() ?? null,
        bearing: m?.getBearing?.() ?? null,
        center: c ? [c.lng, c.lat] : null,
        viewport: { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 },
      };
    });

  const camBeforeStart = await readCam();
  await startBtn.click();
  await page
    .getByRole("button", { name: "주행 종료" })
    .waitFor({ state: "visible", timeout: 40_000 });
  log("running");

  // 3) 카메라 스냅이 안정될 때까지
  await page.waitForTimeout(6_000);
  const camRunning = await readCam();

  if (OUT_PNG) await page.screenshot({ path: OUT_PNG.replace(/\.png$/, "-flat.png") });

  // 3b) 후방 추적(rear30) + 3D — 이 모드라야 computeRideFollowFraming 이 실제로 돈다.
  //     북향은 distanceM=0 이라 fallbackZoom 을 돌려주므로 줌 비교가 축퇴값이 된다.
  await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
  const sheet = page.getByRole("dialog", { name: "맵 뷰" });
  await sheet.waitFor({ state: "visible", timeout: 15_000 });
  const threeD = sheet.locator('input[type="checkbox"]').first();
  if (!(await threeD.isChecked().catch(() => true))) {
    await threeD.check().catch(() => {});
    log("3D 뷰 켬");
  }
  await sheet.locator('button[title="Rear 30°"]').click({ timeout: 10_000 });
  log("후방(rear30) 선택");
  const distanceReadout = await sheet
    .locator(".map-view-sheet__zoom-readout")
    .first()
    .textContent()
    .catch(() => null);
  await sheet.getByRole("button", { name: "닫기" }).first().click({ timeout: 10_000 }).catch(() => {});
  await sheet.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(6_000);
  const camRear = await readCam();
  log("rear30 camera:", JSON.stringify(camRear));
  if (OUT_PNG) await page.screenshot({ path: OUT_PNG }); // §4.2 본 게이트 장면

  // 4) GLB 레이어 model-scale
  const model = await page.evaluate(() => {
    const m = window.__RTW_MAP__;
    if (!m?.getStyle) return { layers: [], scale: null, layerId: null };
    const layers = (m.getStyle()?.layers ?? [])
      .filter((l) => l.type === "model" || /rider|glb/i.test(l.id))
      .map((l) => ({ id: l.id, type: l.type }));
    for (const l of layers) {
      try {
        const s = m.getPaintProperty(l.id, "model-scale");
        if (s != null) return { layers, scale: s, layerId: l.id };
      } catch { /* 모델 레이어가 아니면 무시 */ }
    }
    return { layers, scale: null, layerId: null };
  });

  // 4b) 라이더 실제 위치 vs 카메라 center — look-at 오프셋 실측
  const riderGeo = await page.evaluate((sourceId) => {
    const m = window.__RTW_MAP__;
    const src = m?.getSource?.(sourceId);
    const models = src?._options?.models ?? src?._models ?? {};
    const out = {};
    for (const [k, v] of Object.entries(models)) out[k] = v?.position ?? null;
    const self = out["live-self"] ?? Object.values(out)[0] ?? null;
    const c = m?.getCenter?.();
    let offsetM = null;
    let screen = null;
    if (self && c) {
      const R = 6378137;
      const dLat = ((self[1] - c.lat) * Math.PI) / 180;
      const dLng = ((self[0] - c.lng) * Math.PI) / 180;
      const x = dLng * Math.cos((c.lat * Math.PI) / 180) * R;
      const y = dLat * R;
      offsetM = Math.round(Math.hypot(x, y) * 100) / 100;
      const pt = m.project([self[0], self[1]]);
      screen = { x: Math.round(pt.x), y: Math.round(pt.y) };
    }
    return { models: out, self, center: c ? [c.lng, c.lat] : null, offsetM, screen };
  }, "boxcycle-rider-prototype-source");
  log("rider offset from camera center:", riderGeo.offsetM, "m · screen", JSON.stringify(riderGeo.screen));

  // 5) 네임태그 실측 크기 (별도 DOM 마커 — model-scale 을 읽지 않아야 한다)
  const nametag = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".map-view__rider-nametag")];
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return {
        cls: e.className,
        text: (e.textContent ?? "").slice(0, 20),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        x: Math.round(r.left),
        y: Math.round(r.top),
        fontSize: cs.fontSize,
        display: cs.display,
      };
    });
  });

  // 6) 접지 판정 — follow 프레이밍을 빼고 카메라를 라이더에 직접 고정한다.
  //    (rear30 에서는 라이더가 화면 밖이라 접지를 눈으로 볼 수 없다)
  const scaleNum = Array.isArray(model.scale) ? model.scale[0] : 1;
  const groundZoom = 20.6 - Math.log2(Math.max(1, scaleNum / 1.15)); // 배율만큼 화각을 넓힌다
  await page.getByRole("button", { name: "맵 뷰 설정" }).click({ timeout: 20_000 });
  const sheet2 = page.getByRole("dialog", { name: "맵 뷰" });
  await sheet2.waitFor({ state: "visible", timeout: 15_000 });
  await sheet2.locator('button[title="Free camera"]').click({ timeout: 10_000 });
  await sheet2.getByRole("button", { name: "닫기" }).first().click({ timeout: 10_000 }).catch(() => {});
  await sheet2.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await page.evaluate(
    ({ self, zoom }) => {
      const m = window.__RTW_MAP__;
      m?.stop?.();
      m?.jumpTo?.({ center: self, zoom, pitch: 70, bearing: 0 });
    },
    { self: riderGeo.self, zoom: groundZoom },
  );
  await page.waitForTimeout(4_000);
  log("접지 뷰 zoom", groundZoom.toFixed(2));
  if (OUT_PNG) await page.screenshot({ path: OUT_PNG.replace(/\.png$/, "-ground.png") });

  const result = { phase: PHASE, camBeforeStart, camRunning, camRear, distanceReadout, groundZoom, model, riderGeo, nametag };
  log(JSON.stringify(result, null, 2));
  if (OUT_JSON) fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(`[${PHASE}] FAILED:`, e.message);
  process.exit(1);
});
