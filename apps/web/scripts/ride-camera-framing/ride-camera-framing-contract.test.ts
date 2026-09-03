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
  rideHeightSpanMargin,
  rideLookAtAlongM,
  rideSafeViewportPx,
  rideSpanM,
} from "../../src/lib/rideCameraFraming.ts";

/** `config.ts` 의 기준 배율. 여기서만 쓰는 상수가 아니라 제품 값과 같아야 한다. */
const BASE_SCALE = 1.15;
/** pitch 0 의 세로 여유 하한 — 비공개 상수라 시험이 같은 값을 다시 적는다 */
const HEIGHT_SPAN_MARGIN_FLAT = 1.12;

/**
 * pitch 별 「inSafeArea 가 참이 되는 최소 margin」 실측표.
 * 살아 있는 지도에서 잰 값이다(`g5-margin-sweep.mjs` · `g5-margin-*.json`).
 * factor 1 과 factor 20 의 값이 거의 같아 배율 불변임을 확인했으므로 큰 쪽을 적는다.
 */
const MEASURED_MIN_MARGIN: ReadonlyArray<readonly [number, number]> = [
  [0, 0.4],
  [30, 1.1],
  [45, 1.8],
  [60, 2.4],
  [70, 2.9],
  [75, 2.8],
  [80, 3.25],
];

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
          const spanM = rideSpanM(distanceM, pitch, displayHeightAt(factor));
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
  const spanM40 = rideSpanM(40, 80, displayHeightAt(20));

  it("보호가 없으면 110.16m 였다(결함 재현)", () => {
    const naive = unprotectedLookAtAlongM(80, lookAtHeightAt(20));
    assert.ok(Math.abs(naive - 110.16) < 0.05, `실측 110.16m 와 다르다: ${naive.toFixed(2)}`);
  });

  it("보호 후에는 spanM 비율 상한으로 잘린다", () => {
    const lookAt = rideLookAtAlongM(80, spanM40, lookAtHeightAt(20));
    assert.ok(Math.abs(lookAt - spanM40 * RIDE_LOOKAT_SPAN_RATIO) < 1e-9);
    // 절대 미터가 아니라 프레임 대비로 본다 — G-5 에서 span 자체가 커졌다.
    assert.ok(lookAt < unprotectedLookAtAlongM(80, lookAtHeightAt(20)), "보호가 줄이지 못했다");
    assert.ok(lookAt / spanM40 <= 0.8, "실측 안전 창을 벗어난다");
  });

  it("오프셋/span 이 배율에 불변이다 — 라이더의 화면 위치가 배율을 타지 않는다", () => {
    const rel = (factor: number) => {
      const span = rideSpanM(40, 80, displayHeightAt(factor));
      return rideLookAtAlongM(80, span, lookAtHeightAt(factor)) / span;
    };
    assert.ok(Math.abs(rel(10) - rel(20)) < 1e-9, `배율마다 다르다: ${rel(10)} vs ${rel(20)}`);
  });
});

describe("현재 제품 보존 · factor 1 은 수정 전과 같다", () => {
  // factor 1 의 오프셋은 pitch 에만 의존하는 상수(거리와 무관)라 상한에 걸리지 않아야 한다.
  for (const pitch of [30, 45, 80]) {
    for (const distanceM of [10, 20, 40]) {
      it(`pitch ${pitch}° · 거리 ${distanceM}m 에서 오프셋이 그대로다`, () => {
        const spanM = rideSpanM(distanceM, pitch, displayHeightAt(1));
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
      assert.equal(rideSpanM(distanceM, 80, displayHeightAt(1)), distanceM);
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

describe("경계 · heightSpan 이 거리를 이기는 전환점(이제 pitch 함수다)", () => {
  const transitionAt = (pitchDeg: number) =>
    40 / (rideHeightSpanMargin(pitchDeg) * RIDER_HEAD_C_Y_M * BASE_SCALE);

  it("pitch 0 의 전환점은 22.41배다(감리가 적었던 36배가 아니다)", () => {
    // margin 하한 1.12 가 그대로 쓰이므로 G-3·G-4 의 검산값이 여기 남는다.
    assert.equal(rideHeightSpanMargin(0), HEIGHT_SPAN_MARGIN_FLAT);
    assert.ok(Math.abs(transitionAt(0) - 22.406) < 0.01, `전환점이 다르다: ${transitionAt(0).toFixed(3)}`);
  });

  it("pitch 0 에서 22배는 거리가, 23배는 전고가 지배한다", () => {
    assert.equal(rideSpanM(40, 0, displayHeightAt(22)), 40);
    assert.ok(rideSpanM(40, 0, displayHeightAt(23)) > 40);
  });

  it("pitch 80 의 전환점은 7.16배로 내려온다 — G-5 원근 보정의 결과다", () => {
    assert.ok(
      Math.abs(transitionAt(80) - 7.156) < 0.02,
      `pitch 80 전환점이 다르다: ${transitionAt(80).toFixed(3)}`,
    );
  });

  it("pitch 80 에서 20배는 전고가 지배한다 — 줌 아웃 수용의 실체다", () => {
    // G-4 까지는 40m(거리 지배)였다. 사용자가 2026-09-03 에 줌 아웃을 수용해 바뀐 값이다.
    const span = rideSpanM(40, 80, displayHeightAt(20));
    assert.ok(span > 40, `전고가 지배하지 않는다: ${span.toFixed(2)}`);
    assert.ok(Math.abs(span - 111.8) < 0.5, `span 이 예상과 다르다: ${span.toFixed(2)}`);
  });
});

describe("G-5 · margin 은 pitch 원근 확대를 덮는다", () => {
  for (const [pitch, measured] of MEASURED_MIN_MARGIN) {
    it(`pitch ${pitch}° 실측 필요값 ${measured} 를 덮는다`, () => {
      const m = rideHeightSpanMargin(pitch);
      assert.ok(m >= measured, `모자란다: ${m.toFixed(3)} < ${measured}`);
    });
  }

  it("pitch 에 대해 단조 증가한다 — 더 눕히면 더 넓게 담는다", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 90; p += 5) {
      const m = rideHeightSpanMargin(p);
      assert.ok(m >= prev - 1e-12, `pitch ${p}° 에서 줄었다: ${prev} → ${m}`);
      prev = m;
    }
  });

  it("정의역 밖 pitch 도 유한하다", () => {
    for (const p of [-30, 0, 90, 120, Number.MAX_SAFE_INTEGER]) {
      const m = rideHeightSpanMargin(p);
      assert.ok(Number.isFinite(m) && m >= HEIGHT_SPAN_MARGIN_FLAT, `pitch ${p} 에서 ${m}`);
    }
  });

  it("필요 이상으로 넓히지 않는다 — 실측값의 1.6배를 넘지 않는다", () => {
    // 줌 아웃 수용에도 상한이 있다. 여유가 과하면 400배 영역으로 미끄러진다.
    for (const [pitch, measured] of MEASURED_MIN_MARGIN) {
      if (pitch === 0) continue; // pitch 0 은 하한 1.12 가 지배한다(현재 제품 보존이 목적)
      const m = rideHeightSpanMargin(pitch);
      assert.ok(m <= measured * 1.6, `과하다: pitch ${pitch}° 에서 ${m.toFixed(2)} > ${(measured * 1.6).toFixed(2)}`);
    }
  });
});

describe("G-5 §4.3 · span 상한", () => {
  const PITCH_DOMAIN = [0, 30, 45, 60, 70, 80] as const;
  const ALL_DISTANCES = [1, 10, 20, 40] as const;

  it("factor 20 의 span 은 120m 를 넘지 않는다", () => {
    for (const pitch of PITCH_DOMAIN) {
      for (const d of ALL_DISTANCES) {
        const span = rideSpanM(d, pitch, displayHeightAt(20));
        assert.ok(span <= 120, `pitch ${pitch}° · 거리 ${d}m 에서 ${span.toFixed(1)}m`);
      }
    }
  });

  it("factor 1 의 span 은 40m 를 넘지 않는다 — 현재 제품이 줌 아웃되면 안 된다", () => {
    for (const pitch of PITCH_DOMAIN) {
      for (const d of ALL_DISTANCES) {
        const span = rideSpanM(d, pitch, displayHeightAt(1));
        assert.ok(span <= 40, `pitch ${pitch}° · 거리 ${d}m 에서 ${span.toFixed(1)}m`);
      }
    }
  });

  it("factor 1 의 거리 10·20·40m 는 여전히 거리가 그대로 span 이다(회귀 방지)", () => {
    for (const pitch of PITCH_DOMAIN) {
      for (const d of [10, 20, 40]) {
        assert.equal(
          rideSpanM(d, pitch, displayHeightAt(1)),
          d,
          `pitch ${pitch}° · 거리 ${d}m 에서 span 이 바뀌었다`,
        );
      }
    }
  });

  it("factor 1 거리 1m 는 heightSpan 이 지배하고, 그 값이 실측 필요값을 만족한다", () => {
    // G-4 에서 「원래 깨져 있던 자리」로 판정된 케이스. 이제 라이더가 프레임에 들어간다.
    const span = rideSpanM(1, 80, displayHeightAt(1));
    assert.ok(span > 1, "거리가 지배하면 라이더가 넘친다");
    assert.ok(
      Math.abs(span - displayHeightAt(1) * rideHeightSpanMargin(80)) < 1e-9,
      "heightSpan 이 지배하지 않는다",
    );
  });
});
