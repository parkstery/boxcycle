import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";
import {
  isCadenceChipVisibleInRouteDock,
  isRouteDockStageVisible,
} from "../../src/components/route-dock/routeDockVisibility.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(HERE, "../../src");

const DOCK_STAGES: RideUiStage[] = [
  "idle",
  "setup",
  "ready-to-start",
  "riding",
  "paused",
];
const HIDDEN_STAGES: RideUiStage[] = ["gate", "gate-nickname", "summary"];

describe("6A-R2 cadence chip visibility invariant", () => {
  it("10-combo: dock stages x expanded keep chip visible in RouteDock", () => {
    for (const stage of DOCK_STAGES) {
      for (const expanded of [true, false]) {
        assert.equal(
          isCadenceChipVisibleInRouteDock(stage, expanded),
          true,
          `${stage} expanded=${expanded}`,
        );
        assert.equal(isRouteDockStageVisible(stage), true, stage);
      }
    }
  });

  it("gate|gate-nickname|summary: dock and chip both absent", () => {
    for (const stage of HIDDEN_STAGES) {
      assert.equal(isRouteDockStageVisible(stage), false, stage);
      assert.equal(isCadenceChipVisibleInRouteDock(stage, true), false, stage);
      assert.equal(isCadenceChipVisibleInRouteDock(stage, false), false, stage);
    }
  });
});

describe("6A-R2 source placement contracts", () => {
  it("RouteDock renders CadenceHudChip in topbar outside hidden={!expanded} panel", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/route-dock/RouteDock.tsx"), "utf8");
    const topbarIdx = src.indexOf("route-dock__topbar");
    const panelHiddenIdx = src.indexOf("hidden={!expanded}");
    assert.ok(topbarIdx > 0, "topbar missing");
    assert.ok(panelHiddenIdx > 0, "panel hidden missing");
    assert.ok(topbarIdx < panelHiddenIdx, "chip topbar must appear before panel hidden attribute");
    assert.ok(src.includes("<CadenceHudChip"), "CadenceHudChip JSX missing");
    assert.ok(src.includes("onOpen={cadence.onOpen}"), "sheet open path must stay cadence.onOpen");
    assert.equal(src.includes("route-dock__sensor-rail"), false, "sensor-rail must be removed");
    assert.ok(
      src.includes("useState(() => visible && stops.length > 0)"),
      "idle default collapsed; expand when stops present on mount",
    );
  });

  it("MapHud never renders sensor chip at any stage", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/maphud/MapHud.tsx"), "utf8");
    assert.equal(src.includes("CadenceHudChip"), false, "CadenceHudChip must be gone from MapHud");
    assert.equal(src.includes("showCadenceChip"), false, "showCadenceChip must be gone");
    assert.equal(
      src.includes("resolveCadenceChipSurface"),
      false,
      "resolveCadenceChipSurface must be gone",
    );
    assert.equal(/^\s*cadence\s*:/m.test(src), false, "cadence prop must be removed from MapHud");
    assert.ok(src.includes("map-hud__tr"));
    assert.ok(src.includes("hud-account") || src.includes("showAccount"));
    assert.ok(src.includes("onOpenMapView") || src.includes("hud-bc-trigger"));
  });

  it("resolveCadenceChipSurface deleted; no MapHud fallback", () => {
    const vis = readFileSync(
      resolve(WEB_SRC, "components/route-dock/routeDockVisibility.ts"),
      "utf8",
    );
    assert.equal(vis.includes("resolveCadenceChipSurface"), false);
    assert.equal(vis.includes("map-hud-tr"), false);
    const idx = readFileSync(resolve(WEB_SRC, "components/route-dock/index.ts"), "utf8");
    assert.equal(idx.includes("resolveCadenceChipSurface"), false);
  });

  it("App wires cadenceHud into RouteDock only (not MapHud)", () => {
    const src = readFileSync(resolve(WEB_SRC, "App.tsx"), "utf8");
    assert.ok(src.includes("cadence={cadenceHud}"));
    assert.equal(src.includes("cadence: cadenceHud"), false);
  });

  it("CadenceHudChip still exposes aria-expanded and onOpen click", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/maphud/CadenceHudChip.tsx"), "utf8");
    assert.ok(/aria-label=\{view\.ariaLabel\}/.test(src));
    assert.ok(/aria-expanded=\{open\}/.test(src));
    assert.ok(/onClick=\{onOpen\}/.test(src));
  });

  it("RouteDock.css shell is column with topbar (no sensor-rail)", () => {
    const css = readFileSync(resolve(WEB_SRC, "components/route-dock/RouteDock.css"), "utf8");
    assert.ok(/\.route-dock__shell\s*\{[\s\S]*?flex-direction:\s*column/.test(css));
    assert.ok(css.includes(".route-dock__topbar"));
    assert.equal(css.includes("route-dock__sensor-rail"), false);
  });
});
