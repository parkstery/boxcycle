import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMERA1_AERIAL_DISTANCE_M,
  CAMERA1_LEGACY_MODES,
  CAMERA1_MODE_CYCLE,
  CAMERA1_MODE_META,
  nextCamera1Mode,
  normalizeCamera1Mode,
  resolveCamera1EnterMapStyle,
  resolveCamera1ExitMapStyle,
  type Camera1Mode,
} from "../../src/lib/camera/camera1Mode.ts";
import { RIDE_CAMERA_DISTANCE_MAX_M, RIDE_CAMERA_DISTANCE_MIN_M } from "../../src/lib/map/mapGlobeView.ts";

/**
 * Quick Camera 1 의 단계 표를 고정한다.
 *
 * 왜 필요한가 — 2026-09-24 구조 감사에서 「거리 클램프 이원화」가 위험 R5 로 잡혔다.
 * 맵 뷰 시트의 수동 슬라이더는 `RIDE_CAMERA_DISTANCE_MAX_M`(60m)로 클램프하는데,
 * QC1 의 preset 경로는 그 상한을 거치지 않아 500m 가 그대로 통과한다.
 * 이 우회는 **의도**이지만 지금까지 주석에만 적혀 있었다. 누군가 두 경로를
 * "일원화" 하면 500m 단계가 조용히 60m 로 잘리고, 화면을 보지 않으면 모른다.
 * 그 순간 이 시험이 깨지도록 여기에 못을 박는다.
 *
 * 지시11: 순환 routeFit → aerial500 → aerial20. 옛 4단(200/60/5)으로 되돌리면 실패.
 */

/** 표 3개(순환·거리·표식)가 갈라지지 않았는지 — 모든 판정의 전제다. */
describe("M0 · 시험 자가 검산", () => {
  it("표가 비어 있지 않다 — 빈 배열이면 이하 모든 판정이 공허하게 참이 된다", () => {
    assert.ok(CAMERA1_MODE_CYCLE.length > 0, "CAMERA1_MODE_CYCLE 이 비었다");
    assert.ok(Object.keys(CAMERA1_MODE_META).length > 0, "CAMERA1_MODE_META 가 비었다");
    assert.ok(Object.keys(CAMERA1_AERIAL_DISTANCE_M).length > 0, "CAMERA1_AERIAL_DISTANCE_M 이 비었다");
  });

  it("클램프 상수가 실수다 — 센티넬이면 상한 비교가 무의미해진다", () => {
    assert.equal(typeof RIDE_CAMERA_DISTANCE_MAX_M, "number");
    assert.ok(Number.isFinite(RIDE_CAMERA_DISTANCE_MAX_M));
    assert.ok(RIDE_CAMERA_DISTANCE_MAX_M > RIDE_CAMERA_DISTANCE_MIN_M);
  });
});

describe("순환 · 3단이 닫힌 고리다 (지시11)", () => {
  it("단계는 R → 500 → 20 세 개다 — 옛 4단(200/60/5)으로 되돌리면 여기서 깨진다", () => {
    assert.deepEqual([...CAMERA1_MODE_CYCLE], ["routeFit", "aerial500", "aerial20"]);
    for (const legacy of CAMERA1_LEGACY_MODES) {
      assert.ok(
        !(CAMERA1_MODE_CYCLE as readonly string[]).includes(legacy),
        `옛 단계 ${legacy} 가 순환에 남아 있다`,
      );
    }
  });

  it("세 번 누르면 제자리로 돌아온다", () => {
    for (const start of CAMERA1_MODE_CYCLE) {
      let cur: Camera1Mode = start;
      for (let i = 0; i < CAMERA1_MODE_CYCLE.length; i += 1) cur = nextCamera1Mode(cur);
      assert.equal(cur, start, `${start} 에서 ${CAMERA1_MODE_CYCLE.length}번 순환했는데 제자리가 아니다`);
    }
  });

  it("한 바퀴에 모든 단계를 한 번씩 지난다 — 건너뛰거나 맴돌지 않는다", () => {
    const seen: Camera1Mode[] = [];
    let cur: Camera1Mode = CAMERA1_MODE_CYCLE[0]!;
    for (let i = 0; i < CAMERA1_MODE_CYCLE.length; i += 1) {
      seen.push(cur);
      cur = nextCamera1Mode(cur);
    }
    assert.equal(new Set(seen).size, CAMERA1_MODE_CYCLE.length);
  });

  it("순서는 routeFit → aerial500 → aerial20 → routeFit", () => {
    assert.equal(nextCamera1Mode("routeFit"), "aerial500");
    assert.equal(nextCamera1Mode("aerial500"), "aerial20");
    assert.equal(nextCamera1Mode("aerial20"), "routeFit");
  });
});

describe("레거시 이관 · 옛 aerial* 는 routeFit", () => {
  it("현행 식별자는 그대로", () => {
    assert.equal(normalizeCamera1Mode("routeFit"), "routeFit");
    assert.equal(normalizeCamera1Mode("aerial500"), "aerial500");
    assert.equal(normalizeCamera1Mode("aerial20"), "aerial20");
  });

  it("옛 aerial200/60/5 와 알 수 없는 값은 routeFit", () => {
    for (const legacy of CAMERA1_LEGACY_MODES) {
      assert.equal(normalizeCamera1Mode(legacy), "routeFit", `${legacy} → routeFit`);
    }
    assert.equal(normalizeCamera1Mode("nope"), "routeFit");
    assert.equal(normalizeCamera1Mode(null), "routeFit");
  });

  it("nextCamera1Mode 가 옛 값을 받아도 안전하게 순환한다", () => {
    assert.equal(nextCamera1Mode("aerial200"), "aerial500");
    assert.equal(nextCamera1Mode("aerial60"), "aerial500");
    assert.equal(nextCamera1Mode("aerial5"), "aerial500");
  });
});

describe("R5 고정 · preset 거리는 슬라이더 상한을 의도적으로 넘는다", () => {
  it("500m 단계가 존재하고 값이 정확히 500 이다", () => {
    assert.equal(CAMERA1_AERIAL_DISTANCE_M.aerial500, 500);
  });

  it("500m 는 수동 슬라이더 상한보다 크다 — 두 경로를 일원화하면 여기서 깨진다", () => {
    assert.ok(
      CAMERA1_AERIAL_DISTANCE_M.aerial500 > RIDE_CAMERA_DISTANCE_MAX_M,
      `preset 500m 가 슬라이더 상한(${RIDE_CAMERA_DISTANCE_MAX_M}m) 이하로 내려왔다. ` +
        "클램프를 일원화했다면 QC1 의 500m 단계가 죽는다 — 화면으로 확인하고 이 시험을 갱신하라.",
    );
  });

  it("20m 단계는 정확히 20", () => {
    assert.equal(CAMERA1_AERIAL_DISTANCE_M.aerial20, 20);
  });

  it("aerial 거리는 큰 값에서 작은 값으로 단조 감소한다", () => {
    const order = CAMERA1_MODE_CYCLE.filter((m): m is Exclude<Camera1Mode, "routeFit"> => m !== "routeFit");
    const values = order.map((m) => CAMERA1_AERIAL_DISTANCE_M[m]);
    for (let i = 1; i < values.length; i += 1) {
      assert.ok(values[i]! < values[i - 1]!, `${order[i]} 가 ${order[i - 1]} 보다 멀다 — 순환 방향이 뒤집혔다`);
    }
  });
});

describe("맵 스타일 진입/이탈 (지시11)", () => {
  const outdoors = "mapbox://styles/mapbox/outdoors-v12";
  const satellite = "mapbox://styles/mapbox/satellite-streets-v12";

  it("1번 진입 시 위성으로 바꾸고 직전 스타일을 기억한다", () => {
    const enter = resolveCamera1EnterMapStyle({
      currentStyle: outdoors,
      satelliteStyle: satellite,
    });
    assert.equal(enter.nextStyle, satellite);
    assert.equal(enter.styleBeforeEnter, outdoors);
  });

  it("이탈 시 진입 직전 스타일로 복원한다", () => {
    assert.equal(
      resolveCamera1ExitMapStyle({
        currentStyle: satellite,
        styleBeforeEnter: outdoors,
        userToggledWhileInCamera1: false,
      }),
      outdoors,
    );
  });

  it("1번 안에서 사용자가 토글했으면 이탈해도 복원하지 않는다", () => {
    assert.equal(
      resolveCamera1ExitMapStyle({
        currentStyle: outdoors,
        styleBeforeEnter: outdoors,
        userToggledWhileInCamera1: true,
      }),
      outdoors,
    );
    assert.equal(
      resolveCamera1ExitMapStyle({
        currentStyle: satellite,
        styleBeforeEnter: outdoors,
        userToggledWhileInCamera1: true,
      }),
      satellite,
    );
  });
});

describe("표 정합 · 단계를 늘릴 때 한 곳만 고치면 되도록", () => {
  it("모든 단계가 표식·라벨을 갖는다", () => {
    for (const mode of CAMERA1_MODE_CYCLE) {
      const meta = CAMERA1_MODE_META[mode];
      assert.ok(meta, `${mode} 의 META 가 없다`);
      assert.ok(meta.mark.length > 0, `${mode} 의 표식이 비었다`);
      assert.ok(meta.label.length > 0, `${mode} 의 라벨이 비었다`);
    }
  });

  it("routeFit 을 뺀 모든 단계가 preset 거리를 갖는다 — 거리 없는 aerial 은 NaN 으로 흐른다", () => {
    for (const mode of CAMERA1_MODE_CYCLE) {
      if (mode === "routeFit") continue;
      const d = CAMERA1_AERIAL_DISTANCE_M[mode];
      assert.ok(Number.isFinite(d) && d > 0, `${mode} 의 preset 거리가 없거나 유효하지 않다`);
    }
  });

  it("거리 표에 순환에 없는 유령 단계가 없다", () => {
    for (const key of Object.keys(CAMERA1_AERIAL_DISTANCE_M)) {
      assert.ok(
        (CAMERA1_MODE_CYCLE as readonly string[]).includes(key),
        `${key} 는 거리 표에만 있고 순환에는 없다`,
      );
    }
  });

  it("버튼 표식은 2~4자다 — UI 공간 밀도 원칙 D6", () => {
    for (const mode of CAMERA1_MODE_CYCLE) {
      const { mark } = CAMERA1_MODE_META[mode];
      assert.ok(mark.length >= 1 && mark.length <= 4, `${mode} 표식 "${mark}" 가 4자를 넘는다`);
    }
  });

  it("표식은 서로 구분된다 — 같은 글자면 어느 단계인지 알 수 없다", () => {
    const marks = CAMERA1_MODE_CYCLE.map((m) => CAMERA1_MODE_META[m].mark);
    assert.equal(new Set(marks).size, marks.length, `표식이 겹친다: ${marks.join(" ")}`);
  });
});
