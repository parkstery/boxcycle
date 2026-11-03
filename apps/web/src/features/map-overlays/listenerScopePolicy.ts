/**
 * Nonessential Firestore listener gates during Trail ride.
 * Pure policy — no React / Firebase imports.
 */

export type OpenTrailsListenerEnabledOpts = {
  configured: boolean;
  hasUser: boolean;
  trailheadSessionActive: boolean;
  isRideSessionActive: boolean;
  menuOpen: boolean;
};

/**
 * Trailhead `openTrailListings` + CG: idle Trailhead 또는 주행 중 메뉴 열림에서만.
 * 주행 + 메뉴 닫힘이면 listing/CG 를 내려 현재 Trail peer 허브만 남긴다.
 */
export function resolveOpenTrailsListenerEnabled(
  opts: OpenTrailsListenerEnabledOpts,
): boolean {
  return Boolean(
    opts.configured &&
      opts.hasUser &&
      opts.trailheadSessionActive &&
      (!opts.isRideSessionActive || opts.menuOpen),
  );
}

export type ActiveLiveRideTrailIdsListenerEnabledOpts = {
  configured: boolean;
  hasUser: boolean;
  pageVisible: boolean;
  trailheadSessionActive: boolean;
  isRideSessionActive: boolean;
};

/** World-map discovery 용 project-wide CG — 주행 중에는 메뉴 hook 이 담당. */
export function resolveActiveLiveRideTrailIdsListenerEnabled(
  opts: ActiveLiveRideTrailIdsListenerEnabledOpts,
): boolean {
  return Boolean(
    opts.configured &&
      opts.hasUser &&
      opts.pageVisible &&
      opts.trailheadSessionActive &&
      !opts.isRideSessionActive,
  );
}

export type WorldLivePublicationRideOverlayEligibleOpts = {
  configured: boolean;
  hasUser: boolean;
  isRideSessionActive: boolean;
  debugIsolationOn: boolean;
  publicationPresenceWorldMapEnabled: boolean;
};

export type WorldLivePublicationRideOverlayEnabledOpts =
  WorldLivePublicationRideOverlayEligibleOpts & {
    pageVisible: boolean;
  };

/** eligibility — pageVisible 제외. short-hide grace 는 hook 에서 적용. */
export function resolveWorldLivePublicationRideOverlayEligible(
  opts: WorldLivePublicationRideOverlayEligibleOpts,
): boolean {
  return (
    !opts.debugIsolationOn &&
    Boolean(opts.configured && opts.hasUser) &&
    !opts.publicationPresenceWorldMapEnabled &&
    !opts.isRideSessionActive
  );
}

/** 다 Trail world livePublicationRides overlay — 주행 중 off (현재 Trail spectator 유지). */
export function resolveWorldLivePublicationRideOverlayEnabled(
  opts: WorldLivePublicationRideOverlayEnabledOpts,
): boolean {
  return resolveWorldLivePublicationRideOverlayEligible(opts) && opts.pageVisible;
}

/**
 * 첫 화면·주행 중 세계 지도가 `livePublicationRides` 를 구독하는 Trail 수 상한.
 * 비용 절감 L3(document/ops/20261103-cost-squeeze/01-audit.md, Chief 승인 11-03): 구독마다 그 Trail
 * 라이더의 4초 쓰기를 보는 사람이 전부 읽는다(보는 사람 × 라이더). 화면 안 필터는 Trail 목록에
 * 지역 필드가 생기면(00-plan G4) 더한다 — 그 전에는 「현재 Trail + 라이더 많은 순」으로 자른다.
 */
export const WORLD_SPECTATOR_TRAIL_LIMIT = 8;

export function pickWorldSpectatorTrailIds(input: {
  /** 지금 내가 있는 Trail(없으면 null) — 항상 포함 */
  currentTrailId: string | null;
  /** 공개 Trail 목록(서버 갱신) — 라이더 많은 순으로 채운다 */
  openTrails: readonly { id: string; liveRiderCount?: number }[];
  /** 목록에 아직 없는 주행 중 Trail(안전망 조회) — 남는 자리에 */
  activeTrailIds: readonly string[];
  limit?: number;
}): string[] {
  const limit = Math.max(1, input.limit ?? WORLD_SPECTATOR_TRAIL_LIMIT);
  const out: string[] = [];
  const add = (id: string | null | undefined) => {
    if (!id || out.includes(id) || out.length >= limit) return;
    out.push(id);
  };
  add(input.currentTrailId);
  const ranked = [...input.openTrails].sort((a, b) => (b.liveRiderCount ?? 0) - (a.liveRiderCount ?? 0));
  for (const t of ranked) add(t.id);
  for (const id of input.activeTrailIds) add(id);
  return out;
}
