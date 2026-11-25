import type { Map as MapboxMap } from "mapbox-gl";

/**
 * 지형 OFF 주행의 자동 품질 (2026-11-25 Chief, 지형 OFF·3D 최대 계획 5단계).
 *
 * 느려지면 나무 수 → 창문 무늬 순으로 줄이고 여유가 생기면 되돌린다. 그림자는 이미 꺼져 있다(고정 92).
 * 도로명·글자·라이더·주행선·건물·안개·능선과 시야 1km(고정 91)는 건드리지 않는다.
 */
export type RideQualityLevel = { label: string; maxTrees: number; windows: boolean };

export const RIDE_QUALITY_LEVELS: readonly RideQualityLevel[] = [
  { label: "전체", maxTrees: 900, windows: true },
  { label: "나무 1/2", maxTrees: 450, windows: true },
  { label: "나무 1/4", maxTrees: 225, windows: true },
  { label: "나무 1/4·창문 끔", maxTrees: 225, windows: false },
];

/** 합격 기준(계획 §4) — 이 아래로 5초 이어지면 한 단계 내린다. */
const SLOW_FPS = 24;
const SLOW_SECONDS = 5;
/** 이 위로 20초 이어지면 한 단계 올린다. 저전력 30FPS 기기도 올라갈 수 있게 30 보다 조금 낮다. */
const ROOMY_FPS = 28;
const ROOMY_SECONDS = 20;
const ROOMY_SECONDS_MAX = 300;
/** 올린 뒤 이 안에 다시 느려지면 그 단계는 무리다 — 다음 올리기까지 두 배로 기다린다. */
const BOUNCE_SECONDS = 60;
/** 단계를 바꾸거나 주행을 시작한 직후의 준비 시간은 세지 않는다. */
const SETTLE_SECONDS = 4;
const START_SECONDS = 8;

export type RideSecond = { loopFps: number; mapFps: number };

/** 1초 표본만 받아 단계를 정한다. */
export class RideQualityGovernor {
  level: number;
  private slow = 0;
  private roomy = 0;
  private skip = START_SECONDS;
  private roomyNeeded = ROOMY_SECONDS;
  private sinceRaise = Infinity;

  constructor(level = 0) {
    this.level = level;
  }

  note(second: RideSecond): boolean {
    this.sinceRaise += 1;
    if (this.skip > 0) {
      this.skip -= 1;
      return false;
    }
    // 지도가 쉬는 동안(일시정지)은 mapFps 가 낮아도 화면 순환은 빠르다 — 느린 것이 아니다.
    const isSlow = second.loopFps < SLOW_FPS;
    this.slow = isSlow ? this.slow + 1 : 0;
    this.roomy = !isSlow && second.mapFps >= ROOMY_FPS ? this.roomy + 1 : 0;
    if (this.slow >= SLOW_SECONDS && this.level < RIDE_QUALITY_LEVELS.length - 1) {
      if (this.sinceRaise <= BOUNCE_SECONDS) this.roomyNeeded = Math.min(ROOMY_SECONDS_MAX, this.roomyNeeded * 2);
      this.change(this.level + 1);
      return true;
    }
    if (this.roomy >= this.roomyNeeded && this.level > 0) {
      this.change(this.level - 1);
      this.sinceRaise = 0;
      return true;
    }
    return false;
  }

  /** 탭을 가렸다 돌아오면 앞의 표본은 이어지지 않는다. */
  interrupt(): void {
    this.slow = 0;
    this.roomy = 0;
    this.skip = Math.max(this.skip, SETTLE_SECONDS);
  }

  private change(level: number): void {
    this.level = level;
    this.slow = 0;
    this.roomy = 0;
    this.skip = SETTLE_SECONDS;
  }
}

/** `?ridequality=0~3` 은 그 단계로 고정해 비교한다. 없으면 자동. */
export function parseRideQuality(search: string | null | undefined): number | null {
  const raw = new URLSearchParams(search ?? "").get("ridequality");
  if (raw == null || !/^\d$/.test(raw)) return null;
  const value = Number(raw);
  return value < RIDE_QUALITY_LEVELS.length ? value : null;
}

/** 이 페이지에서 마지막으로 맞춘 단계 — 다음 주행은 여기서 시작한다. */
let currentLevel = 0;
let currentFixed = false;
/** 시험용 FPS 패널 표시. */
export function rideQualityText(): string {
  return `${RIDE_QUALITY_LEVELS[currentLevel].label}${currentFixed ? "(고정)" : ""}`;
}

export type RideQualityController = { setActive(active: boolean): void; dispose(): void };

export function installRideQuality(
  map: MapboxMap,
  options: { fixedLevel: number | null; onLevel: (level: RideQualityLevel) => void },
): RideQualityController {
  let raf: number | null = null;
  let governor = new RideQualityGovernor();
  let since = 0;
  let loops = 0;
  let renders = 0;
  const onRender = (): void => {
    renders += 1;
  };
  const apply = (level: number): void => {
    currentLevel = level;
    options.onLevel(RIDE_QUALITY_LEVELS[level]);
  };
  const restartSecond = (now: number): void => {
    since = now;
    loops = 0;
    renders = 0;
  };
  const onVisibility = (): void => {
    governor.interrupt();
    restartSecond(performance.now());
  };
  const loop = (now: number): void => {
    raf = window.requestAnimationFrame(loop);
    loops += 1;
    const elapsed = now - since;
    if (elapsed < 1000) return;
    const changed = governor.note({ loopFps: (loops * 1000) / elapsed, mapFps: (renders * 1000) / elapsed });
    restartSecond(now);
    if (changed) apply(governor.level);
  };
  const stop = (): void => {
    if (raf == null) return;
    window.cancelAnimationFrame(raf);
    raf = null;
    map.off("render", onRender);
    document.removeEventListener("visibilitychange", onVisibility);
  };
  return {
    setActive(active) {
      if (!active) {
        stop();
        return;
      }
      if (options.fixedLevel != null) {
        currentFixed = true;
        apply(options.fixedLevel);
        return;
      }
      if (raf != null) return;
      currentFixed = false;
      governor = new RideQualityGovernor(currentLevel);
      apply(currentLevel);
      restartSecond(performance.now());
      map.on("render", onRender);
      document.addEventListener("visibilitychange", onVisibility);
      raf = window.requestAnimationFrame(loop);
    },
    dispose: stop,
  };
}
