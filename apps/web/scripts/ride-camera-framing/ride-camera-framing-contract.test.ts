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
import { rideCameraDistanceRangeM } from "../../src/lib/mapGlobeView.ts";

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

describe("G-5 · span 은 전고를 따라간다(고정 상한 없음)", () => {
  // 개정 전 판은 「factor 20 span ≤ 120m」 상한을 요구했다. 카메라를 고정하고 라이더를
  // 거기 맞추는 종속 관계였고, 개정판 §2 에서 폐기됐다. 이제 반대로 라이더가 범위를 정한다.
  const PITCH_DOMAIN = [0, 30, 45, 60, 70, 80] as const;

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

  it("같은 슬라이더 위치에서 span 이 배율에 정확히 비례한다", () => {
    for (const factor of [10, 20, 400]) {
      const r1 = rideCameraDistanceRangeM(displayHeightAt(1));
      const rf = rideCameraDistanceRangeM(displayHeightAt(factor));
      for (const f of [0, 0.5, 1]) {
        const d1 = r1.minM + (r1.maxM - r1.minM) * f;
        const df = rf.minM + (rf.maxM - rf.minM) * f;
        const s1 = rideSpanM(d1, 80, displayHeightAt(1));
        const sf = rideSpanM(df, 80, displayHeightAt(factor));
        assert.ok(
          Math.abs(sf / s1 - factor) / factor < 1e-9,
          `factor ${factor} · 슬라이더 ${f * 100}% 에서 ${(sf / s1).toFixed(3)}배`,
        );
      }
    }
  });

  it("heightSpan 은 하한에서만 지배한다 — 그 위로는 항상 거리가 이긴다", () => {
    for (const factor of [1, 20]) {
      const r = rideCameraDistanceRangeM(displayHeightAt(factor));
      // 하한은 프레이밍 바닥을 눈금 위로 올린 값이라 거리가 (아슬아슬하게) 이긴다
      assert.ok(
        Math.abs(rideSpanM(r.minM, 80, displayHeightAt(factor)) - r.minM) < 1e-9,
        "하한에서 heightSpan 이 거리를 이겨 죽은 구간이 남는다",
      );
      assert.equal(rideSpanM(r.maxM, 80, displayHeightAt(factor)), r.maxM);
    }
  });
});

// ── G-5(개정) · 카메라 거리 범위를 라이더 전고에서 유도한다 ────────────────
// 카메라 범위를 고정해 두고 라이더를 거기 맞추는 것이 아니라, 라이더 크기가
// 카메라 범위를 정한다. 그래서 라이더의 화면 점유 비율이 배율에 불변이고,
// 지도·건물이 상대적으로 작아진다.

/** 슬라이더를 비율로 훑는다 — 거리 절대값은 배율마다 다르다 */
const SLIDER_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

const rangeAt = (factor: number) => rideCameraDistanceRangeM(displayHeightAt(factor));
const sliderDistancesAt = (factor: number) => {
  const r = rangeAt(factor);
  return SLIDER_FRACTIONS.map((f) => r.minM + (r.maxM - r.minM) * f);
};

describe("G-5 · 카메라 거리 유도", () => {
  it("factor 1 은 오늘의 값(기본 40m · 상한 40m · 눈금 0.5m)을 그대로 재현한다", () => {
    const r = rangeAt(1);
    assert.ok(Math.abs(r.maxM - 40) < 1e-9, `상한이 ${r.maxM}`);
    assert.ok(Math.abs(r.defaultM - 40) < 1e-9, `기본이 ${r.defaultM}`);
    assert.ok(Math.abs(r.stepM - 0.5) < 1e-9, `눈금이 ${r.stepM}`);
  });

  it("하한은 heightSpan 이 거리를 이기는 지점을 눈금 위로 올린 값이다 — factor 1 에서 1m → 6m", () => {
    // 잘려 나가는 1~6m 는 main2 에서 이미 라이더가 화면에 없던 죽은 구간이다.
    const r = rangeAt(1);
    const floorM = displayHeightAt(1) * rideHeightSpanMargin(80);
    assert.ok(Math.abs(floorM - 5.589) < 0.01, `프레이밍 하한이 ${floorM.toFixed(3)}`);
    assert.ok(r.minM >= floorM, "올림이 아니라 내림했다");
    assert.ok(r.minM - floorM < r.stepM, "한 눈금보다 많이 올렸다");
    assert.equal(r.minM, 6);
  });

  it("슬라이더 칸 수가 배율에 불변이다 — 조작감이 같다", () => {
    for (const factor of [1, 10, 20, 400]) {
      const r = rangeAt(factor);
      const steps = (r.maxM - r.minM) / r.stepM;
      assert.ok(Math.abs(steps - 68) < 1e-6, `factor ${factor} 에서 ${steps} 칸`);
    }
  });

  it("하한 아래가 잘렸으므로 슬라이더 전 구간에서 거리가 span 을 지배한다(죽은 구간 없음)", () => {
    for (const factor of [1, 10, 20]) {
      const ds = sliderDistancesAt(factor);
      const zooms = new Set<number>();
      for (const d of ds) {
        const span = rideSpanM(d, 80, displayHeightAt(factor));
        assert.ok(
          Math.abs(span - d) < 1e-9,
          `factor ${factor} · 거리 ${d.toFixed(1)}m 가 heightSpan 에 먹혔다(span ${span.toFixed(1)})`,
        );
        zooms.add(Math.round(span * 1e6));
      }
      assert.equal(zooms.size, ds.length, `factor ${factor} 에서 슬라이더 지점이 겹친다`);
    }
  });

  it("라이더 화면 점유 비율이 배율에 불변이다 — 「라이더 크기 유지·지도가 작아짐」", () => {
    const fractionAt = (factor: number, sliderFraction: number) => {
      const r = rangeAt(factor);
      const d = r.minM + (r.maxM - r.minM) * sliderFraction;
      return displayHeightAt(factor) / rideSpanM(d, 80, displayHeightAt(factor));
    };
    for (const f of SLIDER_FRACTIONS) {
      const base = fractionAt(1, f);
      for (const factor of [10, 20, 400]) {
        const got = fractionAt(factor, f);
        assert.ok(
          Math.abs(got - base) / base <= 0.1,
          `슬라이더 ${f * 100}% 에서 factor ${factor} 점유율이 ${((got / base - 1) * 100).toFixed(1)}% 어긋난다`,
        );
      }
    }
  });

  it("look-at 오프셋도 슬라이더 전 구간에서 배율 불변이다", () => {
    const relAt = (factor: number, sliderFraction: number) => {
      const r = rangeAt(factor);
      const d = r.minM + (r.maxM - r.minM) * sliderFraction;
      const span = rideSpanM(d, 80, displayHeightAt(factor));
      return rideLookAtAlongM(80, span, lookAtHeightAt(factor)) / span;
    };
    for (const f of SLIDER_FRACTIONS) {
      for (const factor of [10, 20]) {
        assert.ok(Math.abs(relAt(factor, f) - relAt(1, f)) < 1e-9, `슬라이더 ${f * 100}% 에서 어긋난다`);
      }
    }
  });

  it("400배도 파국 없이 계산된다 — 구현하지 않고 확장성만 확인한다", () => {
    const r = rangeAt(400);
    for (const [name, v] of [["min", r.minM], ["default", r.defaultM], ["max", r.maxM], ["step", r.stepM]] as const) {
      assert.ok(Number.isFinite(v) && v > 0, `${name} 이 ${v}`);
    }
    assert.ok(r.minM < r.maxM, "하한이 상한보다 크다");
    for (const d of sliderDistancesAt(400)) {
      const span = rideSpanM(d, 80, displayHeightAt(400));
      const zoom = Math.log2((156543.03392 * Math.cos((37.5 * Math.PI) / 180)) / (span / 728)) - 0.6 * (80 / 90);
      assert.ok(Number.isFinite(zoom) && zoom > 0, `거리 ${d.toFixed(0)}m 에서 zoom ${zoom}`);
    }
  });

  it("카메라 범위에 배율과 무관한 고정 상한이 남아 있지 않다", () => {
    // 이번 개정의 요지 — 상한은 전고에 비례해야 한다.
    assert.ok(rangeAt(20).maxM > rangeAt(1).maxM * 19, "상한이 배율을 따라오지 않는다");
    assert.ok(rangeAt(400).maxM > rangeAt(20).maxM * 19, "큰 배율에서 상한이 막힌다");
  });
});
