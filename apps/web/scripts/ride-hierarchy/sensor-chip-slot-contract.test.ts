import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";
import { sensorChipSlot } from "../../src/lib/sensorChipSlot.ts";
import { isRouteDockVisible } from "../../src/lib/routeDockUiPolicy.ts";

/**
 * UI-DECLUTTER-SENSOR-6A — 센서 칩은 **정확히 한 곳**에 있고, 사라지지 않는다.
 *
 * 지시서 §5.1 의 「8 조합(4 stage × 접힘/펼침) 표시 불변식」을 두 겹으로 잡는다:
 *   1. 슬롯 판정(순수 함수) — 어느 자리에 그리는가
 *   2. 소스 구조 — dock 안에서 **접히는 본문 바깥**에 있는가
 * 2 가 없으면 1 은 축퇴다: 슬롯이 "route-dock" 이어도 칩이 `hidden` 패널 안에 있으면
 * 접는 순간 사라진다. 순수 함수로는 그것을 볼 수 없다.
 */

const ALL_STAGES: RideUiStage[] = [
  "gate",
  "gate-nickname",
  "idle",
  "setup",
  "ready-to-start",
  "riding",
  "paused",
  "summary",
];

const DOCK_STAGES: RideUiStage[] = ["setup", "ready-to-start", "riding", "paused"];

describe("sensorChipSlot — 센서 칩 자리", () => {
  it("RouteDock 이 보이는 네 stage 에서는 dock 이 칩을 그린다", () => {
    for (const stage of DOCK_STAGES) {
      assert.equal(isRouteDockVisible(stage), true, `${stage}: dock 이 보여야 한다`);
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, isGate: false, isSummary: false }),
        "route-dock",
        `${stage}: 칩은 dock`,
      );
    }
  });

  it("dock 이 없는 stage 에서는 우상단 폴백 — 센서 시트 입구가 사라지면 안 된다", () => {
    // `idle` = 앱 첫 화면(경로 없음). 여기서 「체험 속도로 준비」를 못 하면 Go 가 영영 잠긴다.
    assert.equal(
      sensorChipSlot({ stage: "idle", hasCadence: true, isGate: false, isSummary: false }),
      "map-hud-tr",
    );
    // 게이트가 시각적으로 닫힌 `gate` — MapHud 는 isGate=false 로 넘긴다
    assert.equal(
      sensorChipSlot({ stage: "gate", hasCadence: true, isGate: false, isSummary: false }),
      "map-hud-tr",
    );
  });

  it("게이트·결과 시트·센서 없음 에서는 어디에도 그리지 않는다", () => {
    for (const stage of ALL_STAGES) {
      assert.equal(
        sensorChipSlot({ stage, hasCadence: false, isGate: false, isSummary: false }),
        "none",
        `${stage}: 센서 상태가 없으면 미표시`,
      );
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, isGate: true, isSummary: false }),
        "none",
        `${stage}: 게이트 중 미표시`,
      );
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, isGate: false, isSummary: true }),
        "none",
        `${stage}: 결과 시트 중 미표시`,
      );
    }
  });

  it("두 곳에 동시에 뜨지 않고, 보여야 할 때 빠지지도 않는다", () => {
    for (const stage of ALL_STAGES) {
      const slot = sensorChipSlot({ stage, hasCadence: true, isGate: false, isSummary: false });
      // 배타성 — 슬롯은 단일 값이므로 dock 과 우상단이 동시에 참일 수 없다
      assert.equal(slot === "route-dock" && slot === "map-hud-tr", false);
      // 소실 금지 — 게이트·결과가 아니면 반드시 어딘가에 있다
      assert.notEqual(slot, "none", `${stage}: 칩이 사라지면 안 된다`);
      assert.equal(slot === "route-dock", isRouteDockVisible(stage), `${stage}: dock 여부와 일치`);
    }
  });
});

describe("RouteDock 소스 구조 — 접어도 센서가 남는다", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(
    path.resolve(__dirname, "../../src/components/route-dock/RouteDock.tsx"),
    "utf8",
  );

  it("칩이 접히는 본문(route-dock__panel) 보다 앞에 온다 = 본문 바깥", () => {
    const chipAt = src.indexOf("<CadenceHudChip");
    const panelAt = src.indexOf('className="route-dock__panel');
    assert.notEqual(chipAt, -1, "RouteDock 이 센서 칩을 그려야 한다");
    assert.notEqual(panelAt, -1, "접이식 본문 앵커");
    assert.ok(chipAt < panelAt, "칩은 hidden 패널 앞(= 바깥)에 있어야 한다");
  });

  it("접힘 여부(expanded)가 칩 렌더를 가르지 않는다", () => {
    const chipAt = src.indexOf("<CadenceHudChip");
    const chipEnd = src.indexOf("/>", chipAt);
    // 칩 블록을 여는 조건은 `cadence ?` 하나뿐 — expanded 가 끼어들면 접을 때 사라진다
    const guard = src.slice(Math.max(0, chipAt - 400), chipAt);
    assert.ok(guard.includes("{cadence ? ("), "칩 가드는 cadence 유무만이어야 한다");
    assert.equal(guard.includes("expanded"), false, "expanded 가 칩 가드에 들어가면 안 된다");
    assert.equal(
      src.slice(chipAt, chipEnd).includes("expanded"),
      false,
      "칩 props 에 expanded 가 들어가면 안 된다",
    );
  });

  it("MapHud 우상단은 슬롯 판정을 거친다 — 칩을 무조건 그리지 않는다", () => {
    const hud = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/maphud/MapHud.tsx"),
      "utf8",
    );
    assert.ok(hud.includes("sensorChipSlot("), "MapHud 가 슬롯 판정을 써야 한다");
    assert.ok(
      /showCadenceChip\s*=\s*\n?\s*sensorChipSlot\(/.test(hud),
      "우상단 표시는 슬롯 === 'map-hud-tr' 로만 결정",
    );
    assert.ok(hud.includes('=== "map-hud-tr"'), "폴백 슬롯 비교가 있어야 한다");
  });
});
