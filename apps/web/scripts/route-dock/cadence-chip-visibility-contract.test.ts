import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";
import {
  isCadenceChipVisibleInRouteDock,
  isRouteDockStageVisible,
  resolveCadenceChipSurface,
} from "../../src/components/route-dock/routeDockVisibility.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(HERE, "../../src");

const DOCK_STAGES: RideUiStage[] = ["setup", "ready-to-start", "riding", "paused"];
const OTHER_STAGES: RideUiStage[] = [
  "gate",
  "gate-nickname",
  "idle",
  "summary",
];

describe("6A cadence chip visibility invariant", () => {
  it("8-combo: dock stages x expanded keep chip visible in RouteDock", () => {
    for (const stage of DOCK_STAGES) {
      for (const expanded of [true, false]) {
        assert.equal(
          isCadenceChipVisibleInRouteDock(stage, expanded),
          true,
          `${stage} expanded=${expanded}`,
        );
        assert.equal(resolveCadenceChipSurface(stage), "route-dock", stage);
        assert.equal(isRouteDockStageVisible(stage), true, stage);
      }
    }
  });

  it("non-dock stages use MapHud TR fallback surface", () => {
    for (const stage of OTHER_STAGES) {
      assert.equal(resolveCadenceChipSurface(stage), "map-hud-tr", stage);
      assert.equal(isCadenceChipVisibleInRouteDock(stage, true), false, stage);
      assert.equal(isRouteDockStageVisible(stage), false, stage);
    }
  });
});

describe("6A source placement contracts", () => {
  it("RouteDock renders CadenceHudChip outside hidden={!expanded} panel", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/route-dock/RouteDock.tsx"), "utf8");
    const sensorIdx = src.indexOf("route-dock__sensor-rail");
    const panelHiddenIdx = src.indexOf('hidden={!expanded}');
    assert.ok(sensorIdx > 0, "sensor-rail missing");
    assert.ok(panelHiddenIdx > 0, "panel hidden missing");
    assert.ok(sensorIdx < panelHiddenIdx, "chip must appear before panel hidden attribute");
    assert.ok(src.includes("<CadenceHudChip"), "CadenceHudChip JSX missing");
    assert.ok(src.includes("onOpen={cadence.onOpen}"), "sheet open path must stay cadence.onOpen");
  });

  it("map-hud__tr no longer hosts the primary CadenceHudChip unconditionally", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/maphud/MapHud.tsx"), "utf8");
    assert.ok(src.includes('resolveCadenceChipSurface(stage) === "map-hud-tr"'));
    assert.ok(src.includes("map-hud__tr"));
    // Account / map triggers remain
    assert.ok(src.includes("hud-account") || src.includes("showAccount"));
    assert.ok(src.includes("onOpenMapView") || src.includes("hud-bc-trigger"));
  });

  it("App wires cadenceHud into RouteDock", () => {
    const src = readFileSync(resolve(WEB_SRC, "App.tsx"), "utf8");
    assert.ok(src.includes("cadence={cadenceHud}"));
  });

  it("CadenceHudChip still exposes aria-expanded and onOpen click", () => {
    const src = readFileSync(resolve(WEB_SRC, "components/maphud/CadenceHudChip.tsx"), "utf8");
    assert.ok(/aria-label=\{view\.ariaLabel\}/.test(src));
    assert.ok(/aria-expanded=\{open\}/.test(src));
    assert.ok(/onClick=\{onOpen\}/.test(src));
  });
});