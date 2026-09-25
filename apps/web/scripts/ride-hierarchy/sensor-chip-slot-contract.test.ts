import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { RideUiStage } from "../../src/hooks/useRideUiStage.ts";
import { sensorChipSlot, sensorChipSlotView } from "../../src/lib/route/sensorChipSlot.ts";
import { isRouteDockVisible } from "../../src/lib/route/routeDockUiPolicy.ts";

/**
 * UI-DECLUTTER-SENSOR-6A — 센서 신호는 **정확히 한 곳**에 있고, 사라지지 않는다.
 *
 * 지시서 §5.1 의 「8 조합(4 stage × 접힘/펼침) 표시 불변식」을 세 겹으로 잡는다:
 *   1. 슬롯 판정(순수 함수) — 어느 자리에, 칩인가 캐럿 LED 인가
 *   2. **제품이 그 판정을 실제로 호출하는가**
 *   3. 소스 구조 — dock 안에서 **접히는 본문 바깥**에 있는가
 *
 * 3 이 없으면 1 은 축퇴다: 슬롯이 dock 이어도 칩이 `hidden` 패널 안에 있으면
 * 접는 순간 사라진다. 순수 함수로는 그것을 볼 수 없다.
 *
 * 2026-09-26: **2 를 추가했다.** 그 전까지 이 시험이 `sensorChipSlot` 의 **유일한
 * 소비자**였다 — 제품은 같은 판정을 인라인으로 따로 갖고 있었고, 09-23 에 세 번째
 * 갈래(접힘 캐럿 LED)가 제품에만 생겼는데 모듈은 2갈래인 채였다. 아무도 호출하지 않는
 * 판정을 시험하는 것은 **자기 자신을 소비자로 둔 축퇴**다.
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


const EXPANDED_ONLY: RideUiStage[] = ["setup", "ready-to-start"];

describe("sensorChipSlot — 센서 신호의 자리", () => {
  it("RouteDock 이 보이고 펼쳐져 있으면 dock 이 칩을 그린다", () => {
    for (const stage of EXPANDED_ONLY) {
      assert.equal(isRouteDockVisible(stage), true, `${stage}: dock 이 보여야 한다`);
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, expanded: true }),
        "route-dock-chip",
        `${stage}: 칩은 dock`,
      );
    }
  });

  it("접히면 칩 대신 캐럿 LED — 신호가 사라지지는 않는다", () => {
    /*
     * 2026-09-16 사고의 재발 방지선은 「칩이 항상 있다」가 아니라
     * **「연결 표시가 사라지지 않는다」** 다. 접힘에서 `none` 이 나오면 그 사고와 같은 결과다.
     */
    // 첫 화면 — 센서가 있으면 항상 캐럿 형태(펼침 여부와 무관)
    for (const expanded of [true, false]) {
      assert.equal(
        sensorChipSlot({ stage: "idle", hasCadence: true, expanded }),
        "route-dock-caret",
        `idle(expanded=${expanded}): 캐럿 LED`,
      );
    }
    // 주행 중 접힘 — 칩을 빼고 캐럿 폭만
    for (const stage of ["riding", "paused"] as RideUiStage[]) {
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, expanded: false }),
        "route-dock-caret",
        `${stage} 접힘: 캐럿 LED`,
      );
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, expanded: true }),
        "route-dock-chip",
        `${stage} 펼침: 칩 복귀`,
      );
    }
  });

  it("우상단 폴백은 더 이상 없다 — 신호는 dock 아니면 아예 없다", () => {
    /*
     * 폴백이 있던 이유는 `idle` 에 dock 이 없어서였다. 센서 시트는 「센서 없음」의
     * 유일한 입구이고 그것이 Go 의 사전조건이라, 첫 화면에서 신호가 사라지면 주행을 시작할
     * 수 없었다. dock 이 `idle` 까지 오면서 그 근거가 사라졌다.
     */
    for (const stage of ALL_STAGES) {
      for (const expanded of [true, false]) {
        const slot: string = sensorChipSlot({ stage, hasCadence: true, expanded });
        assert.notEqual(slot, "map-hud-tr", `${stage}: 우상단 폴백 부활 금지`);
        assert.ok(
          slot === "none" || slot.startsWith("route-dock-"),
          `${stage}: dock 밖에 자리를 만들지 않는다 (${slot})`,
        );
      }
    }
  });

  it("게이트·결과 시트·센서 없음 에서는 어디에도 그리지 않는다", () => {
    for (const stage of ALL_STAGES) {
      for (const expanded of [true, false]) {
        assert.equal(
          sensorChipSlot({ stage, hasCadence: false, expanded }),
          "none",
          `${stage}: 센서 상태가 없으면 미표시`,
        );
      }
    }
    for (const stage of ["gate", "gate-nickname", "summary"] as RideUiStage[]) {
      assert.equal(isRouteDockVisible(stage), false, `${stage}: dock 이 없어야 한다`);
      assert.equal(
        sensorChipSlot({ stage, hasCadence: true, expanded: true }),
        "none",
        `${stage}: 화면을 덮는 카드·시트가 자리를 차지한다`,
      );
    }
  });

  it("두 곳에 동시에 뜨지 않고, 보여야 할 때 빠지지도 않는다", () => {
    for (const stage of ALL_STAGES) {
      for (const expanded of [true, false]) {
        const slot = sensorChipSlot({ stage, hasCadence: true, expanded });
        assert.equal(
          slot !== "none",
          isRouteDockVisible(stage),
          `${stage}(expanded=${expanded}): dock 여부와 일치`,
        );
      }
    }
  });

  it("접힘 형태와 슬롯이 같은 판정에서 나온다 — 갈라질 자리가 없다", () => {
    /*
     * `caretOnly` 는 레이아웃 클래스의 근거이면서 슬롯의 근거다. 둘이 따로 계산되면
     * 한쪽만 바뀌어 「캐럿 폭인데 칩을 그린다」 같은 상태가 된다(09-23 이 그랬다).
     */
    for (const stage of ALL_STAGES) {
      for (const expanded of [true, false]) {
        const view = sensorChipSlotView({ stage, hasCadence: true, expanded });
        assert.equal(
          view.caretOnly,
          view.rideCollapsed || view.preRouteCollapsed,
          `${stage}: caretOnly 는 두 접힘의 합`,
        );
        if (view.slot !== "none") {
          assert.equal(
            view.slot === "route-dock-caret",
            view.caretOnly,
            `${stage}(expanded=${expanded}): 접힘이면 캐럿, 아니면 칩`,
          );
        }
      }
    }
  });
});

describe("제품이 그 판정을 실제로 호출한다", () => {
  const __dirnameCall = path.dirname(fileURLToPath(import.meta.url));
  const dock = fs.readFileSync(
    path.resolve(__dirnameCall, "../../src/components/route-dock/RouteDock.tsx"),
    "utf8",
  );

  it("RouteDock 이 sensorChipSlot 모듈을 import 해 호출한다", () => {
    /*
     * 이 겹이 없으면 앞의 순수 함수 시험 전체가 축퇴다 — 아무도 부르지 않는 판정은
     * 언제 제품과 갈라져도 초록으로 남는다. 실제로 09-23 ~ 09-26 사이가 그랬다.
     */
    assert.match(
      dock,
      /import\s*\{[^}]*sensorChipSlotView[^}]*\}\s*from\s*"[^"]*lib\/route\/sensorChipSlot"/,
      "RouteDock 이 슬롯 판정을 import 해야 한다",
    );
    assert.match(dock, /sensorChipSlotView\(\s*\{/, "판정을 실제로 호출해야 한다");
  });

  it("칩·캐럿 분기를 인라인으로 다시 계산하지 않는다", () => {
    for (const inlined of [
      /const\s+rideCollapsed\s*=/,
      /const\s+preRouteCollapsed\s*=/,
      /const\s+caretOnly\s*=/,
    ]) {
      assert.doesNotMatch(
        dock,
        inlined,
        `접힘 판정을 인라인으로 되살리면 모듈과 갈라진다: ${inlined}`,
      );
    }
    assert.match(
      dock,
      /showSensorChip\s*=\s*sensorView\.slot\s*===\s*"route-dock-chip"/,
      "칩 표시는 슬롯 판정에서 나와야 한다",
    );
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

  /*
   * 2026-09-25 정정 — 이 시험은 2026-09-23 `c66699a`(지시01 접힘 캐럿 LED) 이후 **red 였다.**
   * 09-18 이후 갱신되지 않은 채, 「칩 가드는 `cadence` 하나뿐」이라는 낡은 계약을 주장했다.
   * 아무도 몰랐던 이유: `test:next-ride` 가 어느 게이트에도 없었다(이번에 pre-push 로 승격).
   *
   * 지금의 의도는 「접어도 센서 신호가 남는다」 그대로이고, **남기는 수단만** 바뀌었다 —
   * 접히면 칩 대신 **캐럿 LED** 가 연결만 표시한다(rpm 은 펼친 뒤 칩에서). 그래서 보호해야
   * 할 것은 「칩이 항상 있다」가 아니라 **「접힘에서 연결 표시가 사라지지 않는다」** 다.
   */
  it("접힘에서도 연결 표시가 남는다 — 칩이 없으면 캐럿 LED 가 대신한다", () => {
    const chipAt = src.indexOf("<CadenceHudChip");
    const guard = src.slice(Math.max(0, chipAt - 400), chipAt);
    assert.ok(
      guard.includes("showSensorChip && cadence ? ("),
      "칩 가드는 cadence 유무 + 캐럿 전용 여부여야 한다",
    );
    // 칩을 접힘에서 빼는 대가로 캐럿 LED 가 반드시 있어야 한다. 하나라도 없으면
    // 접었을 때 센서 신호가 통째로 사라진다(2026-09-16 사고와 같은 결과).
    assert.ok(
      /const \{[^}]*preRouteCollapsed[^}]*\} = sensorView;/.test(src),
      "접힘 판정을 슬롯 모듈에서 받아야 한다(2026-09-26: 인라인 계산 폐지)",
    );
    assert.ok(
      /const caretSensorView\s*=[\s\S]{0,160}route-dock-caret/.test(src),
      "접힘일 때 연결을 표시할 캐럿 LED 뷰가 있어야 한다",
    );
    assert.ok(
      src.includes("CadenceHudChip.css"),
      "캐럿 LED 가 재사용하는 LED 클래스가 import 되어야 한다",
    );
  });

  it("MapHud 우상단에서 센서 칩이 완전히 빠졌다", () => {
    const hud = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/maphud/MapHud.tsx"),
      "utf8",
    );
    /*
     * 산문이 아니라 **코드**를 본다 — 단순 부분문자열로 보면 "…`cadence` 는 RouteDock 으로
     * 간다" 같은 주석에도 걸려, 설명을 지워야 시험이 통과하는 거꾸로 된 게이트가 된다.
     */
    assert.equal(hud.includes("CadenceHudChip"), false, "우상단에 센서 칩이 남으면 안 된다");
    assert.equal(hud.includes("showCadenceChip"), false, "폴백 표시 분기가 남으면 안 된다");
    assert.doesNotMatch(hud, /^\s*cadence[?]?:/m, "props 에 cadence 가 남으면 안 된다");
    assert.doesNotMatch(hud, /\bcadence\.\w/, "cadence 값을 읽는 코드가 남으면 안 된다");
  });

  it("좌하단 스택은 dock·입문 CTA 둘만 — 「다음 주행」 카드는 밖(우하단)이다", () => {
    /*
     * dock 이 `idle` 까지 오면서 「다음 주행」 카드·입문 CTA 와 **같은 좌표**를 쓰게 됐고,
     * 셋이 각자 absolute 로 붙어 있으면 그대로 겹치므로 한 스택으로 묶었다(2026-09-16).
     *
     * 2026-09-17: 그런데 스택은 **하단 기준**이라 「다음 주행」 카드가 들고 날 때마다 그 위의
     * RouteDock 이 밀려 올라갔다 내려왔다 했다 — 「창의 위치가 흔들려서는 안 된다」(Chief).
     * 카드만 스택 밖 우하단으로 내보내 자리를 갈랐다. 남은 둘은 서로 배타적이라 스택으로 충분하다.
     * (카드의 실제 좌표·dock 불변은 e2e `ride-summary-compact.spec.ts` 가 렌더 결과로 잰다.)
     */
    const app = fs.readFileSync(path.resolve(__dirname, "../../src/App.tsx"), "utf8");
    const open = app.indexOf("<MapBottomLeftStack>");
    const close = app.indexOf("</MapBottomLeftStack>", open);
    assert.ok(open > 0 && close > open, "좌하단 스택이 있어야 한다");
    const inner = app.slice(open, close);
    for (const node of ["{routeDockPanel}", "{firstRideIntroCard}"]) {
      assert.ok(inner.includes(node), `${node} 가 스택 안에 있어야 한다`);
    }
    assert.equal(
      inner.includes("{nextRideCard}"),
      false,
      "「다음 주행」 카드가 스택에 되돌아오면 dock 이 다시 흔들린다",
    );
    assert.ok(app.includes("{nextRideCard}"), "카드 자체는 여전히 렌더돼야 한다");
  });
});
