#!/usr/bin/env node
/**
 * M4 헤드리스 검증 — dev 서버(5070) + 브라우저 1개(순차 페이지).
 *
 * 실제 앱·실제 지도·실제 스타일 3종(navigation-night-v1·outdoors-v12·
 * satellite-streets-v12)에서 운영 `RideLabelsController` 를 주행 상태로
 * 직접 구동(riding:true, 줌 19.5)해 `names` 모드의 숨김 목록이 장식층만
 * 맞는지 census 한다(filter 호출 0, 복원 불일치 0 기대).
 * 이어서 perflab 패널(`?perflab=1`)이 카메라 1–6·야외·+/− 버튼과 겹치지
 * 않는지 `getBoundingClientRect` 비교로 확인한다(뷰포트 1280×720,
 * 699×273 — 접힘·펼침 둘 다).
 * 운영 컨트롤러 간섭 방지용 `?labels=1` 로 띄운다(운영 측은 항상 표시라
 * 지도를 건드리지 않는다).
 *
 * 사용: 먼저 dev 서버를 5070 에 띄운 뒤
 *   node scripts/map/ride-label-names-headless.mjs [--port 5070]
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(argValue("--port", "5070"));
const OUT = argValue("--out", "../../document/ops/20261016-map-cut/ride-label-names-headless.json");

const STYLES = [
  { name: "outdoors", url: "mapbox://styles/mapbox/outdoors-v12" },
  { name: "satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  { name: "night", url: "mapbox://styles/mapbox/navigation-night-v1" },
];

/** 겹침 확인 대상 — 카메라 1–6·야외·+/−·계정 + TR/TL 행. */
const OVERLAP_SELECTORS = [
  ".hud-quick-camera__btn",
  ".hud-ride-map-controls__style",
  ".hud-ride-map-controls__zoom",
  ".hud-account",
  ".hud-signin-pill",
  ".map-hud__tr",
  ".map-hud__tl",
  ".map-hud__tr-under",
];

async function waitMap(page) {
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
}

function isAppLayer(id) {
  return ["boxcycle-", "route", "live-self", "debug-", "distance-"].some((p) => id.startsWith(p));
}

async function censusNames(page, styleName) {
  return page.evaluate(async ({ styleName }) => {
    const m = window.__RTW_MAP__;
    const mod = await import("/src/lib/map/rideLabels.ts");
    const out = { styleName, zoom: null, mode: "names" };
    try {
      m.jumpTo({ zoom: 19.5, pitch: 80, bearing: 0 });
    } catch {
      /* 카메라 고정 실패여도 계속 */
    }
    await new Promise((r) => setTimeout(r, 1500));
    out.zoom = (() => {
      try {
        return m.getZoom();
      } catch {
        return null;
      }
    })();
    const targetLayers = (m.getStyle()?.layers ?? []).filter(
      (l) =>
        l.type === "symbol" &&
        typeof l.id === "string" &&
        !["boxcycle-", "route", "live-self", "debug-", "distance-"].some((p) => l.id.startsWith(p)),
    );
    const expectedDecorative = targetLayers
      .filter((l) => mod.isDecorativeSymbolLayer({ id: l.id, "source-layer": l["source-layer"] }))
      .map((l) => l.id);
    const snapshot = () => {
      const rows = [];
      for (const l of targetLayers) {
        let visibility = "?";
        try {
          visibility = m.getLayer(l.id)
            ? (m.getLayoutProperty(l.id, "visibility") ?? "visible")
            : "absent";
        } catch {
          visibility = "error";
        }
        let filter = null;
        try {
          filter = typeof m.getFilter === "function" ? (m.getFilter(l.id) ?? null) : null;
        } catch {
          filter = "error";
        }
        rows.push({ id: l.id, visibility, filter });
      }
      return rows;
    };
    const original = snapshot();
    const origById = new Map(original.map((r) => [r.id, r]));
    const c = new mod.RideLabelsController();
    let applyError = null;
    try {
      c.update(m, { riding: true, zoom: m.getZoom(), mode: "names", dist: 1.2, forceShow: false });
    } catch (e) {
      applyError = String(e).slice(0, 200);
    }
    const after = snapshot();
    const summary = c.getLastSummary();
    const hidden = after.filter((r) => r.visibility === "none").map((r) => r.id);
    const hiddenSet = new Set(hidden);
    const expectedSet = new Set(expectedDecorative);
    // 장식이 아닌데 숨겨졌는가(이름 레이어 숨김 금지) / 장식인데 안 숨겨졌는가
    const unexpectedHidden = hidden.filter((id) => !expectedSet.has(id));
    const missedDecorative = expectedDecorative.filter((id) => !hiddenSet.has(id));
    try {
      c.update(m, { riding: false, zoom: m.getZoom(), mode: "names", dist: 1.2, forceShow: false });
    } catch (e) {
      applyError = (applyError ?? "") + "|restore:" + String(e).slice(0, 120);
    }
    const restored = snapshot();
    const mismatches = restored
      .filter((r) => {
        const o = origById.get(r.id);
        if (!o) return true;
        return (
          r.visibility !== o.visibility ||
          JSON.stringify(r.filter ?? null) !== JSON.stringify(o.filter ?? null)
        );
      })
      .map((r) => r.id);
    out.targetCount = summary.targetCount;
    out.expectedDecorative = expectedDecorative;
    out.hidden = hidden;
    out.unexpectedHidden = unexpectedHidden;
    out.missedDecorative = missedDecorative;
    out.filteredCount = summary.filteredIds.length;
    out.filtered = summary.filteredIds;
    out.skipped = summary.skippedIds;
    out.applyError = applyError;
    out.restoreMismatches = mismatches;
    return out;
  }, { styleName });
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function checkPanelOverlap(page, viewportName) {
  return page.evaluate(
    async ({ selectors, viewportName }) => {
      const overlap = (a, b) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const panel = document.querySelector("[data-perflab-panel]");
      if (!panel) return { viewportName, error: "no perflab panel" };
      const out = { viewportName, states: [], cameraButtonsPresent: false };
      const collapseBtn = panel.querySelector(".perf-lab__collapse");
      const isCollapsed = () => panel.classList.contains("perf-lab--collapsed");
      // 접힘 → 펼침 순서로 둘 다 측정 (원래 접힘이면 펼쳤다가 다시 접어 둔다)
      const startedCollapsed = isCollapsed();
      const measure = (label) => {
        const p = rectOf(panel);
        const hits = [];
        let cameraCount = 0;
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            if (el === panel || panel.contains(el)) continue;
            const r = rectOf(el);
            if (r.width === 0 && r.height === 0) continue;
            if (sel === ".hud-quick-camera__btn") cameraCount += 1;
            if (overlap(p, r)) {
              hits.push({ selector: sel, text: (el.textContent ?? "").slice(0, 24), rect: r });
            }
          }
        }
        return { label, collapsed: isCollapsed(), panelRect: p, cameraButtonCount: cameraCount, overlaps: hits };
      };
      out.states.push(measure(startedCollapsed ? "collapsed" : "expanded-as-found"));
      if (collapseBtn && startedCollapsed) {
        collapseBtn.click();
        await new Promise((r) => setTimeout(r, 300));
        out.states.push(measure("expanded"));
        collapseBtn.click();
        await new Promise((r) => setTimeout(r, 300));
      }
      out.cameraButtonsPresent = out.states.some((s) => s.cameraButtonCount > 0);
      out.panelText = (panel.innerText ?? "").split("\n").slice(0, 3);
      return out;
    },
    { selectors: OVERLAP_SELECTORS, viewportName },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const namesResults = [];
  const overlapResults = [];
  try {
    // 1) 데스크톱 1280×720 — names census + 패널 겹침
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await desktop.goto(`http://127.0.0.1:${PORT}/?perflab=1&labels=1`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await waitMap(desktop);
      overlapResults.push(await checkPanelOverlap(desktop, "desktop-1280x720"));
      for (const s of STYLES) {
        try {
          await desktop.evaluate((url) => {
            window.__RTW_MAP__.setStyle(url);
          }, s.url);
          await desktop.waitForFunction(
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
          await new Promise((r) => setTimeout(r, 2000));
          namesResults.push(await censusNames(desktop, s.name));
          console.log(`[m4-headless] style ${s.name} done`);
        } catch (e) {
          namesResults.push({ styleName: s.name, error: String(e).slice(0, 300) });
        }
      }
    } finally {
      await desktop.close();
    }
    // 2) 가로 폰 699×273 — 패널 겹침만 (주행 카메라 버튼은 idle 에 없음, TR 행과 비교)
    const phone = await browser.newPage({ viewport: { width: 699, height: 273 } });
    try {
      await phone.goto(`http://127.0.0.1:${PORT}/?perflab=1&labels=1`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await waitMap(phone);
      overlapResults.push(await checkPanelOverlap(phone, "phone-699x273"));
    } finally {
      await phone.close();
    }
  } finally {
    await browser.close();
  }
  const payload = {
    port: PORT,
    at: new Date().toISOString(),
    names: namesResults,
    overlap: overlapResults,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  for (const r of namesResults) {
    if (r.error) {
      console.log(`${r.styleName}: ERROR ${r.error}`);
      continue;
    }
    console.log(
      `${r.styleName} targets=${r.targetCount} hidden=${r.hidden.length} ` +
        `unexpected=${r.unexpectedHidden.length} missed=${r.missedDecorative.length} ` +
        `filtered=${r.filteredCount} restoreMismatch=${r.restoreMismatches.length}` +
        `${r.applyError ? " APPLY-ERR:" + r.applyError : ""}`,
    );
  }
  for (const o of overlapResults) {
    if (o.error) {
      console.log(`${o.viewportName}: ${o.error}`);
      continue;
    }
    for (const s of o.states) {
      console.log(
        `${o.viewportName} ${s.label}: panel ${Math.round(s.panelRect.x)},${Math.round(s.panelRect.y)} ` +
          `${Math.round(s.panelRect.width)}x${Math.round(s.panelRect.height)} ` +
          `cameraButtons=${s.cameraButtonCount} overlaps=${s.overlaps.length}` +
          (s.overlaps.length > 0 ? " " + JSON.stringify(s.overlaps.map((h) => h.selector)) : ""),
      );
    }
  }
  console.log(`[m4-headless] wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
