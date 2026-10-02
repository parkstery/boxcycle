import { test, expect, type Page } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guestStart } from "./rideEntryHelpers";

/**
 * TASK-02 / TASK-03 / TASK-04 — Trailhead idle hidden→visible operation proxy (DEV meters).
 * Uses __rtwReadSubsApi.setVisibilityOverride (not CDP) for deterministic pageVisible.
 *
 * Hard guard: FIRESTORE_EMULATOR_HOST required.
 * Run: npm run test:e2e:focus-read-spike
 *
 * N=3 world trailLiveRides 는 별도 테스트 — seed 실패 시 soft-skip 하고
 * baseline(N≈0) 결과와 숫자를 섞지 않는다.
 */

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? "";
const FS_PROJECT = process.env.GCLOUD_PROJECT?.trim() || "boxcycle-dc2df";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../.out/focus-read-spike");
const WORLD_N = 3;
const SHORT_HIDE_MS = 200;
/** matches LISTENER_VISIBILITY_GRACE_MS + buffer */
const LONG_HIDE_MS = 11_000;
const SEED_TRAIL_IDS = [
  "focus-spike-live-a",
  "focus-spike-live-b",
  "focus-spike-live-c",
] as const;

type VisSnap = {
  listeners?: Record<string, { open?: number; openTotal?: number; closeTotal?: number }>;
  oneShots?: Record<string, number>;
  trailPresenceWrites?: number;
};

function assertEmulatorHostOnly(): void {
  if (!EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST missing — refuse live Firebase. Use firebase emulators:exec.",
    );
  }
  const host = EMULATOR_HOST.toLowerCase();
  const local =
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]");
  if (!local) {
    throw new Error(`FIRESTORE_EMULATOR_HOST=${EMULATOR_HOST} is not a local emulator — abort.`);
  }
}

async function waitMeters(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility?: unknown; setVisibilityOverride?: unknown };
      };
      return (
        typeof w.__rtwReadSubsApi?.snapshotVisibility === "function" &&
        typeof w.__rtwReadSubsApi?.setVisibilityOverride === "function"
      );
    },
    null,
    { timeout: 30_000 },
  );
}

async function snapVisibility(page: Page): Promise<VisSnap> {
  return page.evaluate(() => {
    const w = window as Window & {
      __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
    };
    return w.__rtwReadSubsApi!.snapshotVisibility();
  });
}

async function setVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate((v) => {
    const w = window as Window & {
      __rtwReadSubsApi?: { setVisibilityOverride: (next: boolean | null) => void };
    };
    w.__rtwReadSubsApi!.setVisibilityOverride(v);
  }, visible);
}

function delta(before: VisSnap, after: VisSnap) {
  const paths = new Set([
    ...Object.keys(before.listeners ?? {}),
    ...Object.keys(after.listeners ?? {}),
  ]);
  const listeners: Record<string, { openTotal: number; closeTotal: number }> = {};
  for (const p of paths) {
    listeners[p] = {
      openTotal: (after.listeners?.[p]?.openTotal ?? 0) - (before.listeners?.[p]?.openTotal ?? 0),
      closeTotal: (after.listeners?.[p]?.closeTotal ?? 0) - (before.listeners?.[p]?.closeTotal ?? 0),
    };
  }
  const oneShotKeys = new Set([
    ...Object.keys(before.oneShots ?? {}),
    ...Object.keys(after.oneShots ?? {}),
  ]);
  const oneShots: Record<string, number> = {};
  for (const k of oneShotKeys) {
    oneShots[k] = (after.oneShots?.[k] ?? 0) - (before.oneShots?.[k] ?? 0);
  }
  return {
    listeners,
    oneShots,
    trailPresenceWrites: (after.trailPresenceWrites ?? 0) - (before.trailPresenceWrites ?? 0),
  };
}

test.describe.configure({ mode: "serial" });

test("Trailhead idle: short-hide ×10 grace keeps members; long-hide closes once", async ({
  page,
}) => {
  assertEmulatorHostOnly();
  test.setTimeout(180_000);

  await page.goto("/");
  await guestStart(page);
  await waitMeters(page);

  // settle visible — members open + initial one-shots done
  await setVisible(page, true);
  await page.waitForFunction(
    () => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
      };
      return (w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailMembers?.open ?? 0) >= 1;
    },
    null,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(2_500);

  const controlBefore = await snapVisibility(page);
  await page.waitForTimeout(500);
  const controlDelta = delta(controlBefore, await snapVisibility(page));

  const cycleBefore = await snapVisibility(page);
  for (let i = 0; i < 10; i += 1) {
    await setVisible(page, false);
    await page.waitForTimeout(SHORT_HIDE_MS);
    // short hide must keep members warm (grace)
    const mid = await snapVisibility(page);
    expect(mid.listeners?.trailMembers?.open ?? 0).toBeGreaterThanOrEqual(1);
    await setVisible(page, true);
    await page.waitForTimeout(250);
  }
  // allow catalog / poll tick to settle (fresh-resume should stay quiet)
  await page.waitForTimeout(1_500);
  const cycleDelta = delta(cycleBefore, await snapVisibility(page));

  const longBefore = await snapVisibility(page);
  await setVisible(page, false);
  await page.waitForFunction(
    () => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
      };
      return (w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailMembers?.open ?? 0) === 0;
    },
    null,
    { timeout: LONG_HIDE_MS + 3_000 },
  );
  await setVisible(page, true);
  await page.waitForFunction(
    () => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
      };
      return (w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailMembers?.open ?? 0) >= 1;
    },
    null,
    { timeout: 8_000 },
  );
  const longDelta = delta(longBefore, await snapVisibility(page));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "visibility-e2e-delta.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        note: "operation proxy — not billed reads; SDK reconnect unmetered; TASK-04 short-hide grace",
        controlDelta,
        cycleDelta,
        longDelta,
        outPath,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(controlDelta.listeners.trailMembers?.openTotal ?? 0).toBe(0);
  expect(controlDelta.listeners.trailMembers?.closeTotal ?? 0).toBe(0);
  // TASK-04: short hide ×10 → no members churn
  expect(cycleDelta.listeners.trailMembers?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.trailMembers?.closeTotal ?? 0).toBe(0);
  expect(cycleDelta.trailPresenceWrites).toBe(0);

  // Kept listeners should not app-resubscribe
  expect(cycleDelta.listeners.openTrailListings?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.users?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.economy?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.conquest?.openTotal ?? 0).toBe(0);

  // TASK-03 one-shots stay 0
  expect(cycleDelta.oneShots.catalogPublications ?? 0).toBe(0);
  expect(cycleDelta.oneShots.activityWorldSummary ?? 0).toBe(0);
  expect(cycleDelta.oneShots.activityWorldGlobal ?? 0).toBe(0);
  expect(cycleDelta.oneShots.activityWorldRouteActivityGetDoc ?? 0).toBe(0);

  expect(cycleDelta.listeners.trailLiveRides?.openTotal ?? 0).toBe(0);

  // long hide → one close + one open on resume
  expect(longDelta.listeners.trailMembers?.closeTotal ?? 0).toBe(1);
  expect(longDelta.listeners.trailMembers?.openTotal ?? 0).toBe(1);
});

function docsUrl(docPath: string): string {
  return `http://${EMULATOR_HOST}/v1/projects/${FS_PROJECT}/databases/(default)/documents/${docPath}`;
}

async function upsertEmulatorDoc(
  docPath: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(docsUrl(docPath), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`Emulator PATCH ${docPath} failed: ${res.status} ${await res.text()}`);
  }
}

/** CG discovery → world overlay trailLiveRides×N 용 REST seed (Rules bypass owner). */
async function seedWorldLiveTrails(n: number): Promise<string[]> {
  const nowIso = new Date().toISOString();
  const ids = SEED_TRAIL_IDS.slice(0, n);
  for (let i = 0; i < ids.length; i += 1) {
    const trailId = ids[i]!;
    const uid = `focus-seed-rider-${i + 1}`;
    await upsertEmulatorDoc(`trails/${trailId}`, {
      hostUid: { stringValue: uid },
      displayNumber: { integerValue: String(100 + i) },
      status: { stringValue: "open" },
      visibility: { stringValue: "open" },
      publicationId: { stringValue: `focus-spike-pub-${i + 1}` },
      createdAt: { timestampValue: nowIso },
      lastActivityAt: { timestampValue: nowIso },
    });
    await upsertEmulatorDoc(`trails/${trailId}/livePublicationRides/${uid}`, {
      publicationId: { stringValue: `focus-spike-pub-${i + 1}` },
      progressRatio: { doubleValue: 0.25 },
      lastSeenAt: { timestampValue: nowIso },
      displayName: { stringValue: `Seed ${i + 1}` },
      ridePhase: { stringValue: "live" },
      speedMps: { doubleValue: 4 },
      distMeters: { doubleValue: 100 },
    });
  }
  return [...ids];
}

test("optional: seed N=3 world trails → short-hide trailLiveRides 0/0; long-hide close+open", async ({
  page,
}) => {
  assertEmulatorHostOnly();
  test.setTimeout(180_000);

  let seedError: string | null = null;
  let seededIds: string[] = [];
  try {
    seededIds = await seedWorldLiveTrails(WORLD_N);
  } catch (e) {
    seedError = e instanceof Error ? e.message : String(e);
  }

  await page.goto("/");
  await guestStart(page);
  await waitMeters(page);
  await setVisible(page, true);

  if (seedError) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "visibility-e2e-n3-skip.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          status: "seed_failed",
          seedError,
          note: "N=3 remains pure harness model — not mixed with baseline E2E",
        },
        null,
        2,
      ),
      "utf8",
    );
    test.info().annotations.push({ type: "n3", description: `seed_failed: ${seedError}` });
    return;
  }

  // Wait until world overlay holds N trailLiveRides opens (CG + enrichment path).
  const reachedN = await page
    .waitForFunction(
      (n) => {
        const w = window as Window & {
          __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
        };
        const open = w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailLiveRides?.open ?? 0;
        return open >= n;
      },
      WORLD_N,
      { timeout: 25_000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!reachedN) {
    const snap = await snapVisibility(page);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "visibility-e2e-n3-skip.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          status: "discovery_timeout",
          seededIds,
          trailLiveRidesOpen: snap.listeners?.trailLiveRides?.open ?? 0,
          note: "App discovery did not open N trailLiveRides in time — keep harness model only",
        },
        null,
        2,
      ),
      "utf8",
    );
    test.info().annotations.push({
      type: "n3",
      description: `discovery_timeout open=${snap.listeners?.trailLiveRides?.open ?? 0}`,
    });
    return;
  }

  await page.waitForTimeout(1_000);
  const cycleBefore = await snapVisibility(page);
  for (let i = 0; i < 10; i += 1) {
    await setVisible(page, false);
    await page.waitForTimeout(SHORT_HIDE_MS);
    const mid = await snapVisibility(page);
    expect(mid.listeners?.trailLiveRides?.open ?? 0).toBeGreaterThanOrEqual(WORLD_N);
    await setVisible(page, true);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1_000);
  const cycleDelta = delta(cycleBefore, await snapVisibility(page));

  const longBefore = await snapVisibility(page);
  await setVisible(page, false);
  await page.waitForFunction(
    () => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
      };
      return (w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailLiveRides?.open ?? 0) === 0;
    },
    null,
    { timeout: LONG_HIDE_MS + 3_000 },
  );
  await setVisible(page, true);
  await page.waitForFunction(
    (n) => {
      const w = window as Window & {
        __rtwReadSubsApi?: { snapshotVisibility: () => VisSnap };
      };
      return (w.__rtwReadSubsApi?.snapshotVisibility()?.listeners?.trailLiveRides?.open ?? 0) >= n;
    },
    WORLD_N,
    { timeout: 15_000 },
  );
  const longDelta = delta(longBefore, await snapVisibility(page));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "visibility-e2e-n3-delta.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        status: "measured",
        seededIds,
        worldN: WORLD_N,
        expectedShortHideOpenClose: 0,
        cycleDelta,
        longDelta,
        outPath,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(cycleDelta.listeners.trailLiveRides?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.trailLiveRides?.closeTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.trailMembers?.openTotal ?? 0).toBe(0);
  expect(cycleDelta.listeners.trailMembers?.closeTotal ?? 0).toBe(0);
  expect(cycleDelta.trailPresenceWrites).toBe(0);
  expect(cycleDelta.oneShots.catalogPublications ?? 0).toBe(0);
  expect(cycleDelta.oneShots.activityWorldSummary ?? 0).toBe(0);
  expect(cycleDelta.oneShots.activityWorldGlobal ?? 0).toBe(0);

  expect(longDelta.listeners.trailLiveRides?.closeTotal ?? 0).toBe(WORLD_N);
  expect(longDelta.listeners.trailLiveRides?.openTotal ?? 0).toBe(WORLD_N);
});
