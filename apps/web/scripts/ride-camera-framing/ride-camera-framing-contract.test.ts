// 주행 follow 구도(`rideCameraFraming.ts`) 순수 규칙 계약.
//
// 이 파일이 생긴 이유: 이 모듈에는 시험이 **0건**이었고, 그래서 `RIDER_LOOK_AT_HEIGHT_M`
// 에만 `Math.max` 보호가 빠져 있는 결함이 라이더 배율 20배를 붙일 때까지 살아남았다
// (G-3 실측: 라이더–카메라 center 거리 5.51m → 110.16m, 라이더가 화면 밖).
// 배율은 GLB 를 교체하면 언제든 바뀌므로, 화면이 아니라 여기서 먼저 막는다.
//
// 규칙: 인체 수치를 하드코딩하지 않는다. `RIDER_HEAD_C_Y_M`·`RIDER_PELVIS_Y_M` 은
// `riderRig.geometry.mjs` 파생값이라 rig 가 바뀌면 같이 바뀌어야 한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RIDER_HEAD_C_Y_M,
  RIDER_PELVIS_Y_M,
  RIDE_HUD_SAFE_PADDING,
  RIDE_LOOKAT_SPAN_RATIO,
  computeRideFollowFraming,
  rideLookAtAlongM,
  rideSafeViewportPx,
  rideSpanM,
} from "../../src/lib/rideCameraFraming.ts";

/** `config.ts` 의 기준 배율. 여기서만 쓰는 상수가 아니라 제품 값과 같아야 한다. */
const BASE_SCALE = 1.15;
/** `rideCameraFraming.ts` 내부의 세로 여유 — 비공개라 시험이 같은 값을 다시 적는다 */
const HEIGHT_SPAN_MARGIN = 1.12;

const FACTORS = [1, 10, 20] as const;
const PITCHES = [0, 45, 80] as const;
const DISTANCES = [1, 10, 40] as const;

const displayHeightAt = (factor: number) => RIDER_HEAD_C_Y_M * BASE_SCALE * factor;
const lookAtHeightAt = (factor: number) => RIDER_PELVIS_Y_M * BASE_SCALE * factor;

/** 보호가 없던 시절의 오프셋 — 회귀 비교의 기준 */
function unprotectedLookAtAlongM(pitchDeg: number, lookAtHeightM: number): number {
  const depressionRad = ((90 - pitchDeg) * Math.PI) / 180;
  const tanDep = Math.tan(Math.max(0.017, depressionRad));
  return lookAtHeightM / tanDep;
}

describe("M0 · 시험 자가 검산", () => {
  // 축퇴값(0·상수)으로 아래 단언이 전부 참이 되는 사고를 먼저 막는다.
  it("rig 파생 인체 수치가 살아 있다", () => {
    assert.ok(Number.isFinite(RIDER_HEAD_C_Y_M) && RIDER_HEAD_C_Y_M > 1, "머리 높이가 축퇴값이다");
    assert.ok(Number.isFinite(RIDER_PELVIS_Y_M) && RIDER_PELVIS_Y_M > 0.5, "골반 높이가 축퇴값이다");
    assert.ok(RIDER_PELVIS_Y_M < RIDER_HEAD_C_Y_M, "골반이 머리보다 높다");
  });

  it("배율을 키우면 무보호 오프셋은 실제로 커진다(비교 대상이 상수가 아니다)", () => {
    const at1 = unprotectedLookAtAlongM(80, lookAtHeightAt(1));
    const at20 = unprotectedLookAtAlongM(80, lookAtHeightAt(20));
    assert.ok(at20 / at1 > 19.9 && at20 / at1 < 20.1, `20배가 아니다: ${at20 / at1}`);
  });

  it("안전영역 세로가 뷰포트보다 좁다", () => {
    const safe = rideSafeViewportPx(1280, 900);
    assert.equal(safe.height, 900 - RIDE_HUD_SAFE_PADDING.top - RIDE_HUD_SAFE_PADDING.bottom);
    assert.ok(safe.height > 0 && safe.height < 900);
  });
});

describe("불변식 · look-at 오프셋은 spanM 비율 상한을 넘지 않는다", () => {
  for (const factor of FACTORS) {
    for (const pitch of PITCHES) {
      for (const distanceM of DISTANCES) {
        it(`factor ${factor} · pitch ${pitch}° · 거리 ${distanceM}m`, () => {
          const spanM = rideSpanM(distanceM, displayHeightAt(factor));
          const lookAt = rideLookAtAlongM(pitch, spanM, lookAtHeightAt(factor));
          assert.ok(
            lookAt <= spanM * RIDE_LOOKAT_SPAN_RATIO + 1e-9,
            `오프셋 ${lookAt.toFixed(2)}m 가 상한 ${(spanM * RIDE_LOOKAT_SPAN_RATIO).toFixed(2)}m 를 넘었다`,
          );
          assert.ok(lookAt >= 0 && Number.isFinite(lookAt));
        });
      }
    }
  }

  it("비율은 실측 창(하한 0.551 · 상한 0.80) 안에 있다", () => {
    // 하한: factor 1 이 거리 10m 에서 쓰는 5.51m 를 통과시켜야 한다.
    // 상한: inSafeArea 를 만족하는 오프셋/spanM 최대값(spanM 10·20·40m 실측 0.800).
    assert.ok(RIDE_LOOKAT_SPAN_RATIO >= 0.551, "factor 1 의 현재 카메라가 바뀐다");
    assert.ok(RIDE_LOOKAT_SPAN_RATIO <= 0.8, "실측 안전 창을 벗어난다");
  });
});

describe("G-3 결함 고정 · 20배에서 오프셋이 달아나지 않는다", () => {
  const spanM40 = rideSpanM(40, displayHeightAt(20));

  it("보호가 없으면 110.16m 였다(결함 재현)", () => {
    const naive = unprotectedLookAtAlongM(80, lookAtHeightAt(20));
    assert.ok(Math.abs(naive - 110.16) < 0.05, `실측 110.16m 와 다르다: ${naive.toFixed(2)}`);
  });

  it("보호 후에는 spanM 비율 상한으로 잘린다", () => {
    const lookAt = rideLookAtAlongM(80, spanM40, lookAtHeightAt(20));
    assert.ok(Math.abs(lookAt - spanM40 * RIDE_LOOKAT_SPAN_RATIO) < 1e-9);
    assert.ok(lookAt < 30, `여전히 멀다: ${lookAt.toFixed(2)}m`);
  });

  it("배율을 키워도 오프셋이 선형으로 커지지 않는다", () => {
    const at10 = rideLookAtAlongM(80, rideSpanM(40, displayHeightAt(10)), lookAtHeightAt(10));
    const at20 = rideLookAtAlongM(80, rideSpanM(40, displayHeightAt(20)), lookAtHeightAt(20));
    assert.ok(at20 / at10 < 2, `배율에 비례해 커졌다: ${(at20 / at10).toFixed(2)}배`);
  });
});

describe("현재 제품 보존 · factor 1 은 수정 전과 같다", () => {
  // factor 1 의 오프셋은 pitch 에만 의존하는 상수(거리와 무관)라 상한에 걸리지 않아야 한다.
  for (const pitch of [30, 45, 80]) {
    for (const distanceM of [10, 20, 40]) {
      it(`pitch ${pitch}° · 거리 ${distanceM}m 에서 오프셋이 그대로다`, () => {
        const spanM = rideSpanM(distanceM, displayHeightAt(1));
        const before = unprotectedLookAtAlongM(pitch, lookAtHeightAt(1));
        const after = rideLookAtAlongM(pitch, spanM, lookAtHeightAt(1));
        assert.ok(
          Math.abs(after - before) < 1e-9,
          `factor 1 이 바뀌었다: ${before.toFixed(4)} → ${after.toFixed(4)}`,
        );
      });
    }
  }

  it("spanM 도 factor 1 에서는 거리가 그대로 지배한다", () => {
    for (const distanceM of [10, 20, 40]) {
      assert.equal(rideSpanM(distanceM, displayHeightAt(1)), distanceM);
    }
  });

  it("거리 0·offsetBearing null 은 예전처럼 fallbackZoom 으로 조기 반환한다", () => {
    const out = computeRideFollowFraming({
      riderLngLat: [126.9884, 37.5485],
      offsetBearing: null,
      distanceM: 0,
      pitchDeg: 80,
      viewportWidthPx: 1280,
      viewportHeightPx: 900,
      fallbackZoom: 17.6,
    });
    assert.equal(out.zoom, 17.6);
    assert.deepEqual(out.center, [126.9884, 37.5485]);
  });
});

describe("경계 · heightSpan 이 거리를 이기는 전환점", () => {
  // 40 / (1.12 × HEAD_C_Y × 1.15) — G-3 검산값 22.406배. 감리 지시서의 36배는 오류였다.
  const transition = 40 / (HEIGHT_SPAN_MARGIN * RIDER_HEAD_C_Y_M * BASE_SCALE);

  it("전환점은 22.41배다(36배가 아니다)", () => {
    assert.ok(Math.abs(transition - 22.406) < 0.01, `전환점이 다르다: ${transition.toFixed(3)}`);
  });

  it("22배는 거리(40m)가 지배한다", () => {
    assert.equal(rideSpanM(40, displayHeightAt(22)), 40);
  });

  it("23배는 전고가 지배한다", () => {
    const span = rideSpanM(40, displayHeightAt(23));
    assert.ok(span > 40, `전고가 지배하지 않는다: ${span.toFixed(2)}`);
  });

  it("20배는 아직 거리가 지배한다 — 채택 근거의 그 부분은 참이다", () => {
    assert.equal(rideSpanM(40, displayHeightAt(20)), 40);
  });
});
