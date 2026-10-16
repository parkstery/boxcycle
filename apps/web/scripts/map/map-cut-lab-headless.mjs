#!/usr/bin/env node
/**
 * M1 헤드리스 비교 — dev 서버(5070) + 브라우저 1개(순차 페이지).
 *
 * 같은 스타일·줌 22·pitch 80(QC2 83.5 근방) 고정, `?perflab=1` + `?mapcut=` 변형별로
 * 10 s 강제 리페인트 구간의 지도 `_render` JS 평균·rAF 프레임 평균을 잰다.
 * 헤드리스 GPU 는 실기기와 다르므로 JS 시간 위주로 해석한다.
 * 실주행(running·경로·카메라2 추적) 상태가 아니라 idle 지도 근사이며,
 * 경로·정복 레이어는 mapcut 이 건드리지 않으므로(보존) 베이스맵 델타 귀속은 유지된다.
 *
 * 사용: node scripts/map/map-cut-lab-headless.mjs [--port 5070] [--out <json>]
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const VARIANTS = [
  { name: "none", mapcut: "" },
  { name: "terrain", mapcut: "terrain" },
  { name: "buildings", mapcut: "buildings" },
  { name: "labels", mapcut: "labels" },
  { name: "poi", mapcut: "poi" },
  { name: "sky", mapcut: "sky" },
  { name: "minimap", mapcut: "minimap" },
  { name: "roads", mapcut: "roads" },
  { name: "all", mapcut: "terrain,buildings,labels,poi,sky,minimap,roads" },
];

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(argValue("--port", "5070"));
const OUT = argValue("--out", "document/ops/20261016-map-cut/map-cut-headless.json");
const MEASURE_MS = 10_000;

async function censusAndMeasure(page) {
  return page.evaluate(async (measureMs) => {
    const m = window.__RTW_MAP__;
    if (!m) return { error: "no-map" };
    try {
      m.jumpTo({ zoom: 22, pitch: 80, bearing: 0 });
    } catch {
      /* 카메라 고정 실패여도 계측은 계속 */
    }
    await new Promise((r) => setTimeout(r, 2000));
    let layers = [];
    try {
      layers = (m.getStyle()?.layers ?? []).map((l) => ({ id: l.id, type: l.type }));
    } catch {
      layers = [];
    }
    const byType = {};
    for (const l of layers) byType[l.type ?? "?"] = (byType[l.type ?? "?"] ?? 0) + 1;
    let terrain = "unknown";
    try {
      terrain = m.getTerrain() ? "on" : "off";
    } catch {
      terrain = "error";
    }
    let fog = "unknown";
    try {
      fog = m.getFog() ? "on" : "off";
    } catch {
      fog = "n/a";
    }
    const minimapDom = document.querySelectorAll(".route-minimap").length;
    const mapCanvases = document.querySelectorAll("canvas.mapboxgl-canvas").length;
    const visibilityOf = (ids) => {
      const out = {};
      for (const id of ids) {
        try {
          out[id] = m.getLayer(id) ? m.getLayoutProperty(id, "visibility") ?? "visible" : "absent";
        } catch {
          out[id] = "error";
        }
      }
      return out;
    };
    // 측정: _render 외곽 래핑 + 매 프레임 triggerRepaint
    const render = { n: 0, sum: 0 };
    try {
      const orig = m._render.bind(m);
      m._render = (t) => {
        const s = performance.now();
        try {
          return orig(t);
        } finally {
          const d = performance.now() - s;
          if (Number.isFinite(d) && d >= 0) {
            render.n += 1;
            render.sum += d;
          }
        }
      };
    } catch {
      /* 래핑 실패 — 프레임만 잰다 */
    }
    const frames = await new Promise((resolve) => {
      const dts = [];
      let last = 0;
      const t0 = performance.now();
      const step = (t) => {
        if (last > 0) dts.push(t - last);
        last = t;
        try {
          m.triggerRepaint();
        } catch {
          /* noop */
        }
        if (performance.now() - t0 < measureMs) requestAnimationFrame(step);
        else resolve(dts);
      };
      requestAnimationFrame(step);
    });
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      styleLayerCount: layers.length,
      byType,
      terrain,
      fog,
      minimapDom,
      mapCanvases,
      visibilityOf,
      renderSamples: render.n,
      renderMeanMs: render.n ? render.sum / render.n : null,
      frameSamples: frames.length,
      frameMeanMs: mean(frames),
    };
  }, MEASURE_MS);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const v of VARIANTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const url =
        `http://127.0.0.1:${PORT}/?perflab=1` + (v.mapcut ? `&mapcut=${encodeURIComponent(v.mapcut)}` : "");
      const started = Date.now();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForFunction(() => Boolean(window.__RTW_MAP__), null, { timeout: 60_000 });
        await page.waitForFunction(
          () => {
            try {
              return (window.__RTW_MAP__.getStyle()?.layers ?? []).length > 10;
            } catch {
              return false;
            }
          },
          null,
          { timeout: 60_000 },
        );
        const measured = await censusAndMeasure(page);
        // 숨김 검증용: 분류 대상 id 의 visibility 를 본 페이지에서 읽는다
        let check = {};
        if (!measured.error) {
          check = await page.evaluate(() => {
            const m = window.__RTW_MAP__;
            const ids = (m.getStyle()?.layers ?? []).map((l) => l.id);
            const out = {};
            for (const id of ids) {
              try {
                out[id] = m.getLayoutProperty(id, "visibility") ?? "visible";
              } catch {
                out[id] = "error";
              }
            }
            return out;
          });
        }
        let panel = "";
        try {
          panel = await page.locator("[data-perflab-panel]").innerText({ timeout: 5_000 });
        } catch {
          panel = "(panel unreadable)";
        }
        results.push({ variant: v.name, mapcut: v.mapcut, sec: (Date.now() - started) / 1000, measured, check, panel: panel.slice(0, 200) });
      } catch (err) {
        results.push({ variant: v.name, mapcut: v.mapcut, error: String(err).slice(0, 500) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const payload = { port: PORT, measureMs: MEASURE_MS, at: new Date().toISOString(), results };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  for (const r of results) {
    const m = r.measured ?? {};
    console.log(
      `${(r.variant ?? "?").padEnd(9)} layers=${m.styleLayerCount ?? "?"} terrain=${m.terrain ?? "?"} fog=${m.fog ?? "?"} minimapDom=${m.minimapDom ?? "?"} canvases=${m.mapCanvases ?? "?"} renderMean=${m.renderMeanMs?.toFixed?.(2) ?? "?"}ms(n=${m.renderSamples ?? "?"}) frameMean=${m.frameMeanMs?.toFixed?.(2) ?? "?"}ms(n=${m.frameSamples ?? "?"})${r.error ? " ERROR:" + r.error.slice(0, 120) : ""}`,
    );
  }
  console.log(`[map-cut-lab] wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
