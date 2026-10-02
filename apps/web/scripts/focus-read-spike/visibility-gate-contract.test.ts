import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  resolveActiveLiveRideTrailIdsListenerEnabled,
  resolveOpenTrailsListenerEnabled,
  resolveWorldLivePublicationRideOverlayEligible,
  resolveWorldLivePublicationRideOverlayEnabled,
} from "../../src/features/map-overlays/listenerScopePolicy.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8");

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

describe("visibility gate contracts (Trailhead idle)", () => {
  it("OpenTrails enabled has no pageVisible parameter (kept across visibility)", () => {
    assert.equal(
      resolveOpenTrailsListenerEnabled({
        configured: true,
        hasUser: true,
        trailheadSessionActive: true,
        isRideSessionActive: false,
        menuOpen: false,
      }),
      true,
    );
    const src = codeOnly(read("src/features/map-overlays/listenerScopePolicy.ts"));
    const start = src.indexOf("export function resolveOpenTrailsListenerEnabled");
    const end = src.indexOf("export type ActiveLiveRideTrailIdsListenerEnabledOpts");
    const openTrailsFn = src.slice(start, end);
    assert.ok(openTrailsFn.length > 0, "OpenTrails function slice");
    assert.ok(!openTrailsFn.includes("pageVisible"), "OpenTrails policy must not gate on pageVisible");
  });

  it("ActiveLiveRideTrailIds still requires pageVisible; world overlay eligible ignores it", () => {
    const base = {
      configured: true,
      hasUser: true,
      trailheadSessionActive: true,
      isRideSessionActive: false,
    } as const;
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({ ...base, pageVisible: true }),
      true,
    );
    assert.equal(
      resolveActiveLiveRideTrailIdsListenerEnabled({ ...base, pageVisible: false }),
      false,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEligible({
        configured: true,
        hasUser: true,
        isRideSessionActive: false,
        debugIsolationOn: false,
        publicationPresenceWorldMapEnabled: false,
      }),
      true,
    );
    assert.equal(
      resolveWorldLivePublicationRideOverlayEnabled({
        configured: true,
        hasUser: true,
        pageVisible: false,
        isRideSessionActive: false,
        debugIsolationOn: false,
        publicationPresenceWorldMapEnabled: false,
      }),
      false,
    );
  });

  it("useTrailSession splits members grace from presence pageVisible write", () => {
    const src = codeOnly(read("src/hooks/useTrailSession.ts"));
    assert.match(src, /useVisibilityListenGrace/);
    assert.match(src, /decidePresenceWriteResume/);
    assert.match(src, /subscribeTrailMembers/);
    assert.match(src, /upsertTrailPresence/);
    assert.match(src, /pageVisible/);
  });

  it("world livePublicationRides overlay uses eligibility + visibility grace", () => {
    const overlays = codeOnly(read("src/features/map-overlays/useAppMapOverlays.ts"));
    assert.match(overlays, /resolveWorldLivePublicationRideOverlayEligible/);
    assert.match(overlays, /useVisibilityListenGrace/);
    assert.match(overlays, /worldLivePublicationRideListenActive/);
  });

  it("App catalog refresh effect depends on pageVisible; explicit refresh forces TTL bypass", () => {
    const src = codeOnly(read("src/App.tsx"));
    assert.match(src, /refreshPublishedPublicCourseCatalog/);
    assert.match(src, /pageVisible/);
    assert.ok(
      /refreshPublishedPublicCourseCatalog[\s\S]{0,200}pageVisible|pageVisible[\s\S]{0,200}refreshPublishedPublicCourseCatalog/.test(
        src,
      ),
      "catalog refresh and pageVisible co-located in App effect deps",
    );
    assert.match(src, /refreshPublishedPublicCourseCatalog\(\{\s*force:\s*true\s*\}\)/);
  });

  it("Activity World sync splits eligibility from pageVisible and wires resume freshness", () => {
    const sync = codeOnly(read("src/features/map-overlays/useActivityWorldDataSync.ts"));
    assert.match(sync, /pageVisible/);
    assert.match(sync, /getLastSuccessAtMs/);
    assert.match(sync, /enabled:\s*enabled\s*&&\s*pageVisible/);
    const overlays = codeOnly(read("src/features/map-overlays/useAppMapOverlays.ts"));
    assert.match(overlays, /activityWorldEligible/);
    assert.match(overlays, /pageVisible,/);
    const poll = codeOnly(read("src/hooks/useActivityWorldAdaptivePoll.ts"));
    assert.match(poll, /decideActivityWorldResume/);
    const hub = codeOnly(read("src/hooks/usePublicationCatalogHub.ts"));
    assert.match(hub, /decidePublishedCatalogRefresh/);
    assert.match(hub, /createInflightDeduper/);
  });

  it("useDocumentVisibility exposes DEV override seam without changing default resolve", () => {
    const hook = codeOnly(read("src/hooks/useDocumentVisibility.ts"));
    assert.match(hook, /resolveDocumentVisible/);
    assert.match(hook, /subscribeDocumentVisibilityOverride/);
    const override = codeOnly(read("src/lib/debug/documentVisibilityOverride.ts"));
    assert.match(override, /setDocumentVisibilityOverrideForTests/);
    assert.match(override, /import\.meta\.env\?\.DEV/);
  });

  it("production: visibility override set/subscribe are complete no-ops", () => {
    const override = codeOnly(read("src/lib/debug/documentVisibilityOverride.ts"));
    assert.match(
      override,
      /export function setDocumentVisibilityOverrideForTests[\s\S]*?if \(!isOverrideAllowed\(\)\) return;/,
    );
    assert.match(
      override,
      /export function subscribeDocumentVisibilityOverride[\s\S]*?if \(!isOverrideAllowed\(\)\) return \(\) => \{\};/,
    );
    assert.ok(
      !/export function subscribeDocumentVisibilityOverride[\s\S]*?listeners\.add[\s\S]*?if \(!isOverrideAllowed/.test(
        override,
      ),
      "subscribe must gate before listeners.add",
    );
  });

  it("visibility meter wiring present at required subscribe/one-shot sites", () => {
    const sites: Array<[string, string]> = [
      ["src/lib/trail/repo/firestoreOpenTrailListings.ts", "trackVisibilityListener"],
      ["src/lib/trail/repo/firestoreTrail.ts", "trackVisibilityListener"],
      ["src/lib/trail/repo/firestoreTrailLivePublicationRides.ts", "trackVisibilityListener"],
      ["src/lib/account/repo/firestoreRouteToken.ts", "trackVisibilityListener"],
      ["src/lib/account/repo/firestoreRouteTokenEconomy.ts", "trackVisibilityListener"],
      ["src/lib/conquest/repo/firestoreConquest.ts", "trackVisibilityListener"],
      ["src/hooks/useUserTier.ts", "trackVisibilityListener"],
      ["src/lib/ride/repo/firestoreWorldPresence.ts", "noteVisibilityOneShot"],
      ["src/lib/activity/repo/firestoreWorldActivity.ts", "noteVisibilityOneShot"],
      ["src/lib/activity/repo/firestoreRouteActivity.ts", "noteVisibilityOneShot"],
      ["src/lib/route/repo/firestoreRoutePublications.ts", "noteVisibilityOneShot"],
      ["src/lib/identity/repo/firestoreUser.ts", "noteVisibilityOneShot"],
      ["src/lib/route/repo/firestoreCourses.ts", "noteVisibilityOneShot"],
    ];
    for (const [file, token] of sites) {
      const src = read(file);
      assert.ok(src.includes(token), `${file} should wire ${token}`);
    }
  });

  it("one-shot notes sit after cache guards and before Firebase calls (proxy class)", () => {
    const routeActivity = codeOnly(read("src/lib/activity/repo/firestoreRouteActivity.ts"));
    const batchFn = routeActivity.slice(
      routeActivity.indexOf("export async function fetchRouteActivitiesBatch"),
      routeActivity.indexOf("export function formatActivityWorldPinPopup"),
    );
    assert.match(batchFn, /noteVisibilityOneShot\("activityWorldBatchInvocation"\)/);
    assert.ok(
      !batchFn.includes("activityWorldRouteActivityGetDoc"),
      "batch entry must not count getDoc",
    );

    const fetchFn = routeActivity.slice(
      routeActivity.indexOf("export async function fetchRouteActivity"),
      routeActivity.indexOf("export function routeActivityHeatAnchorMs"),
    );
    const cacheReturn = fetchFn.indexOf("return cached.value");
    const getDocNote = fetchFn.indexOf(
      'noteVisibilityOneShot("activityWorldRouteActivityGetDoc")',
    );
    const getDocCall = fetchFn.indexOf("await getDoc(");
    assert.ok(cacheReturn >= 0 && getDocNote > cacheReturn, "getDoc note after cache hit return");
    assert.ok(getDocNote >= 0 && getDocCall > getDocNote, "getDoc note immediately before getDoc");

    const liveIdsFn = routeActivity.slice(
      routeActivity.indexOf("export async function fetchLiveRouteActivityIds"),
      routeActivity.indexOf("export function invalidateLiveRouteActivityIdsCache"),
    );
    const liveCacheReturn = liveIdsFn.indexOf("return liveRouteIdsCache.ids");
    const liveNote = liveIdsFn.indexOf('noteVisibilityOneShot("activityWorldLiveIds")');
    assert.ok(liveCacheReturn >= 0 && liveNote > liveCacheReturn, "liveIds note after TTL cache");

    const courses = codeOnly(read("src/lib/route/repo/firestoreCourses.ts"));
    const uncached = courses.slice(
      courses.indexOf("async function fetchCourseRoutePayloadUncached"),
      courses.indexOf("export async function fetchCourseRoutePayload"),
    );
    assert.match(uncached, /noteVisibilityOneShot\("routeGeometryGapFill"\)/);
    const cachedFn = courses.slice(
      courses.indexOf("export async function fetchCourseRoutePayload"),
      courses.indexOf("export async function fetchCourseRoutePayload") + 800,
    );
    assert.ok(
      cachedFn.includes("courseRoutePayloadMemoryCache.has") &&
        !cachedFn.includes('noteVisibilityOneShot("routeGeometryGapFill")'),
      "gap-fill note only on uncached path",
    );

    const summary = codeOnly(read("src/lib/ride/repo/firestoreWorldPresence.ts"));
    assert.match(
      summary,
      /noteVisibilityOneShot\("activityWorldSummary"\)[\s\S]{0,200}await getDoc\(/,
    );
    const global = codeOnly(read("src/lib/activity/repo/firestoreWorldActivity.ts"));
    assert.match(
      global,
      /noteVisibilityOneShot\("activityWorldGlobal"\)[\s\S]{0,200}await getDoc\(/,
    );
    const pubs = codeOnly(read("src/lib/route/repo/firestoreRoutePublications.ts"));
    assert.match(
      pubs,
      /noteVisibilityOneShot\("catalogPublications"\)[\s\S]{0,240}await getDocs\(/,
    );
    const labels = codeOnly(read("src/lib/identity/repo/firestoreUser.ts"));
    assert.match(
      labels,
      /if \(uniq\.length === 0\) return map;[\s\S]*?noteVisibilityOneShot\("catalogLabels"/,
    );
    assert.match(labels, /noteVisibilityOneShot\("catalogLabels"[\s\S]{0,200}await getDoc\(/);
  });
});
