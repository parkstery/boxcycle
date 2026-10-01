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

export type WorldLivePublicationRideOverlayEnabledOpts = {
  configured: boolean;
  hasUser: boolean;
  pageVisible: boolean;
  isRideSessionActive: boolean;
  debugIsolationOn: boolean;
  publicationPresenceWorldMapEnabled: boolean;
};

/** 다 Trail world livePublicationRides overlay — 주행 중 off (현재 Trail spectator 유지). */
export function resolveWorldLivePublicationRideOverlayEnabled(
  opts: WorldLivePublicationRideOverlayEnabledOpts,
): boolean {
  return (
    !opts.debugIsolationOn &&
    Boolean(opts.configured && opts.hasUser && opts.pageVisible) &&
    !opts.publicationPresenceWorldMapEnabled &&
    !opts.isRideSessionActive
  );
}
