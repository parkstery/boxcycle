#!/usr/bin/env node
/**
 * M3 헤드리스 검증 — dev 서버(5070) + 브라우저 1개(순차 페이지).
 *
 * 실제 앱·실제 지도·실제 스타일 3종(navigation-night-v1·outdoors-v12·
 * satellite-streets-v12)에서 운영 `RideLabelsController` 를 주행 상태로
 * 직접 구동(riding:true, 줌 19.5)해 모드별 숨김/유지 레이어 수와
 * `distance-from-center` 적용 여부를 census 한다.
 * 운영 컨트롤러 간섭 방지용 `?labels=1` 로 띄운다(운영 측은 항상 표시라
 * 지도를 건드리지 않는다). 화면·fps 비교는 Supervisor 가 배포 후 실제 GPU 로.
 *
 * 사용: 먼저 dev 서버를 5070 에 띄운 뒤
 *   node scripts/map/ride-label-mode-headless.mjs [--port 5070]
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(argValue("--port", "5070"));
const OUT = argValue("--out", "../../document/ops/20261016-map-cut/ride-label-mode-headless.json");

const STYLES = [
  { name: "outdoors", url: "mapbox://styles/mapbox/outdoors-v12" },
  { name: "satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  { name: "night", url: "mapbox://styles/mapbox/navigation-night-v1" },
];
const MODES = ["both", "near", "major", "all", "none"];

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

async function censusModes(page, styleName) {
  return page.evaluate(
    async ({ modes, styleName }) => {
      const m = window.__RTW_MAP__;
      const mod = await import("/src/lib/map/rideLabels.ts");
      const out = { styleName, zoom: null, modes: {} };
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
      const snapshot = () => {
        const layers = m.getStyle()?.layers ?? [];
        const rows = [];
        for (const l of layers) {
          if (l.type !== "symbol" || !l.id || typeof l.id !== "string") continue;
          if (
            ["boxcycle-", "route", "live-self", "debug-", "distance-"].some((p) =>
              l.id.startsWith(p),
            )
          ) {
            continue;
          }
          let visibility = "?";
          try {
            visibility = m.getLayer(l.id)
              ? (m.getLayoutProperty(l.id, "visibility") ?? "visible")
              : "absent";
          } catch {
            visibility = "error";
          }
          let filter = null;
          let filterError = false;
          try {
            filter = typeof m.getFilter === "function" ? (m.getFilter(l.id) ?? null) : null;
          } catch {
            filterError = true;
          }
          rows.push({ id: l.id, visibility, filter, filterError });
        }
        return rows;
      };
      const original = snapshot();
      const origById = new Map(original.map((r) => [r.id, r]));
      for (const mode of modes) {
        const c = new mod.RideLabelsController();
        let applyError = null;
        try {
          c.update(m, { riding: true, zoom: m.getZoom(), mode, dist: 1.2, forceShow: false });
        } catch (e) {
          applyError = String(e).slice(0, 200);
        }
        const after = snapshot();
        const summary = c.getLastSummary();
        const hidden = after.filter((r) => r.visibility === "none").map((r) => r.id);
        const withDistance = after
          .filter((r) => JSON.stringify(r.filter ?? null).includes("distance-from-center"))
          .map((r) => r.id);
        const withTighten = after
          .filter((r) => {
            const cur = JSON.stringify(r.filter ?? null);
            return (
              cur.includes('"filterrank"],2') ||
              cur.includes('"motorway","trunk","primary","secondary"')
            );
          })
          .map((r) => r.id);
        // 복원 후 원본과 같은지
        try {
          c.update(m, { riding: false, zoom: m.getZoom(), mode, dist: 1.2, forceShow: false });
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
        out.modes[mode] = {
          targetCount: summary.targetCount,
          hiddenCount: hidden.length,
          hidden,
          filteredCount: summary.filteredIds.length,
          filtered: summary.filteredIds,
          skipped: summary.skippedIds,
          withDistanceCount: withDistance.length,
          withTighten: withTighten,
          applyError,
          restoreMismatches: mismatches,
        };
      }
      return out;
    },
    { modes: MODES, styleName },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let panel = "";
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?perflab=1&labels=1`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await waitMap(page);
      try {
        await page.goto(
          `http://127.0.0.1:${PORT}/?perflab=1&labels=1&labelmode=near&labeldist=2`,
          { waitUntil: "domcontentloaded", timeout: 60_000 },
        );
        await waitMap(page);
        panel = await page.locator("[data-perflab-panel]").innerText({ timeout: 10_000 });
      } catch (e) {
        panel = `(panel unreadable: ${String(e).slice(0, 120)})`;
      }
      for (const s of STYLES) {
        try {
          await page.evaluate((url) => {
            window.__RTW_MAP__.setStyle(url);
          }, s.url);
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
          await new Promise((r) => setTimeout(r, 2000));
          results.push(await censusModes(page, s.name));
          console.log(`[m3-headless] style ${s.name} done`);
        } catch (e) {
          results.push({ styleName: s.name, error: String(e).slice(0, 300) });
        }
      }
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const payload = { port: PORT, at: new Date().toISOString(), panelFirstLine: panel.split("\n").slice(0, 3), results };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  for (const r of results) {
    if (r.error) {
      console.log(`${r.styleName}: ERROR ${r.error}`);
      continue;
    }
    console.log(`--- ${r.styleName} (zoom ${r.zoom?.toFixed?.(2) ?? "?"}) ---`);
    for (const mode of MODES) {
      const mm = r.modes[mode];
      console.log(
        `${mode.padEnd(6)} targets=${mm.targetCount} hidden=${mm.hiddenCount} filtered=${mm.filteredCount} skipped=${mm.skipped.length} withDistance=${mm.withDistanceCount} restoreMismatch=${mm.restoreMismatches.length}${mm.applyError ? " APPLY-ERR:" + mm.applyError : ""}`,
      );
    }
  }
  console.log(`[m3-headless] wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
