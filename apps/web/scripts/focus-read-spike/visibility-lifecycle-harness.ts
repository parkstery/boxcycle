/**
 * Trailhead idle 의 pageVisible 게이트 수명주기를 순수하게 재생한다.
 * Firebase 호출 없음 — visibilityReadMeters 에 앱이 하는 open/close·one-shot·presence 만 남긴다.
 *
 * 검증하는 것: 앱 제어 fanout 의 결정적 operation proxy delta.
 * 추론만 하는 것: SDK WebChannel reconnect / billed read (미계측).
 */

import {
  noteTrailPresenceWriteProxy,
  noteVisibilityOneShot,
  trackVisibilityListener,
  type VisibilityListenerPath,
} from "../../src/lib/debug/visibilityReadMeters.ts";

export type TrailheadIdleHarnessOpts = {
  /** world livePublicationRides hub 개수 (default Trail 제외) */
  worldTrailCount: number;
  /** catalog label getDoc 수 (applicant uid 고유 수) */
  catalogLabelCount?: number;
  /** route geometry gap-fill 호출 수 (캐시 miss 가정) */
  routeGeometryGapFillCount?: number;
  /** Activity World batch 호출 여부 (ids 비면 제품도 스킵) */
  activityWorldBatch?: boolean;
  /** liveIds 캐시 hit 로 one-shot 을 건너뛸지 */
  skipActivityWorldLiveIds?: boolean;
};

type Held = {
  path: VisibilityListenerPath;
  release: () => void;
};

export type TrailheadIdleHarness = {
  /** baseline settle — kept + visible-gated 전부 open, 초기 one-shot·presence */
  settleVisible: () => void;
  hide: () => void;
  show: () => void;
  /** hide→show 를 n회 */
  cycleVisibility: (n: number) => void;
  /** 현재 open 중인 path 목록(디버그) */
  openPaths: () => VisibilityListenerPath[];
};

function openPath(path: VisibilityListenerPath, held: Held[]): void {
  held.push({
    path,
    release: trackVisibilityListener(path, () => {}),
  });
}

function closePath(path: VisibilityListenerPath, held: Held[]): void {
  for (let i = held.length - 1; i >= 0; i -= 1) {
    if (held[i]!.path !== path) continue;
    held[i]!.release();
    held.splice(i, 1);
  }
}

function noteVisibleOneShots(opts: TrailheadIdleHarnessOpts): void {
  noteVisibilityOneShot("activityWorldSummary");
  noteVisibilityOneShot("activityWorldGlobal");
  if (!opts.skipActivityWorldLiveIds) {
    noteVisibilityOneShot("activityWorldLiveIds");
  }
  if (opts.activityWorldBatch !== false) {
    // harness 는 app fanout(invocation) 모델 — cache-miss getDoc 수는 별도 E2E/실측
    noteVisibilityOneShot("activityWorldBatchInvocation");
  }
  noteVisibilityOneShot("catalogPublications");
  const labels = opts.catalogLabelCount ?? 0;
  if (labels > 0) noteVisibilityOneShot("catalogLabels", labels);
  const gap = opts.routeGeometryGapFillCount ?? 0;
  if (gap > 0) noteVisibilityOneShot("routeGeometryGapFill", gap);
}

/**
 * OpenTrails 가 CG 를 유지한다고 가정 — ActiveIds consumer 는 시뮬하지 않고
 * underlying CG open/close 만 반영한다 (kept).
 */
export function createTrailheadIdleVisibilityHarness(
  opts: TrailheadIdleHarnessOpts,
): TrailheadIdleHarness {
  const held: Held[] = [];
  let visible = true;
  const n = Math.max(0, Math.floor(opts.worldTrailCount));

  const openKept = () => {
    openPath("openTrailListings", held);
    openPath("collectionGroupLiveRides", held);
    openPath("users", held);
    openPath("users", held); // tier + token
    openPath("economy", held);
    openPath("conquest", held);
  };

  const openVisibleGated = () => {
    openPath("trailMembers", held);
    for (let i = 0; i < n; i += 1) openPath("trailLiveRides", held);
  };

  const closeVisibleGated = () => {
    closePath("trailMembers", held);
    closePath("trailLiveRides", held);
  };

  return {
    settleVisible() {
      openKept();
      openVisibleGated();
      noteVisibleOneShots(opts);
      noteTrailPresenceWriteProxy();
      visible = true;
    },
    hide() {
      if (!visible) return;
      closeVisibleGated();
      visible = false;
    },
    show() {
      if (visible) return;
      openVisibleGated();
      noteVisibleOneShots(opts);
      noteTrailPresenceWriteProxy();
      visible = true;
    },
    cycleVisibility(cycles: number) {
      const c = Math.max(0, Math.floor(cycles));
      for (let i = 0; i < c; i += 1) {
        this.hide();
        this.show();
      }
    },
    openPaths() {
      return held.map((h) => h.path);
    },
  };
}
