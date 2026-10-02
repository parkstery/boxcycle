import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideActivityWorldResume,
} from "../../src/lib/activity/activityWorldResumePolicy.ts";
import {
  ACTIVITY_WORLD_POLL_ACTIVE_MS,
  ACTIVITY_WORLD_POLL_IDLE_MS,
} from "../../src/lib/activity/activityWorldPollConstants.ts";
import {
  createInflightDeduper,
  decidePublishedCatalogRefresh,
  PUBLISHED_CATALOG_TTL_MS,
} from "../../src/lib/route/publishedCatalogRefreshPolicy.ts";

describe("publishedCatalogRefreshPolicy", () => {
  const ttl = PUBLISHED_CATALOG_TTL_MS;
  const t0 = 1_000_000;

  it("initial: no cached result → immediate fetch", () => {
    assert.equal(
      decidePublishedCatalogRefresh({
        hasCachedResult: false,
        lastSuccessAtMs: null,
        nowMs: t0,
        force: false,
      }),
      "fetch",
    );
  });

  it("fresh resume within TTL → use_cache", () => {
    assert.equal(
      decidePublishedCatalogRefresh({
        hasCachedResult: true,
        lastSuccessAtMs: t0,
        nowMs: t0 + ttl - 1,
        force: false,
      }),
      "use_cache",
    );
  });

  it("stale resume at/after TTL → fetch", () => {
    assert.equal(
      decidePublishedCatalogRefresh({
        hasCachedResult: true,
        lastSuccessAtMs: t0,
        nowMs: t0 + ttl,
        force: false,
      }),
      "fetch",
    );
  });

  it("force bypasses TTL", () => {
    assert.equal(
      decidePublishedCatalogRefresh({
        hasCachedResult: true,
        lastSuccessAtMs: t0,
        nowMs: t0 + 1,
        force: true,
      }),
      "fetch",
    );
  });

  it("failed refresh is not treated as fresh (null lastSuccess → fetch)", () => {
    assert.equal(
      decidePublishedCatalogRefresh({
        hasCachedResult: false,
        lastSuccessAtMs: null,
        nowMs: t0,
        force: false,
      }),
      "fetch",
    );
  });

  it("in-flight dedup shares one promise", async () => {
    const dedupe = createInflightDeduper<number>();
    let calls = 0;
    const factory = () =>
      new Promise<number>((resolve) => {
        calls += 1;
        setTimeout(() => resolve(42), 20);
      });
    const a = dedupe.run(factory);
    const b = dedupe.run(factory);
    assert.equal(dedupe.isInflight(), true);
    assert.equal(a, b);
    assert.equal(await a, 42);
    assert.equal(await b, 42);
    assert.equal(calls, 1);
    assert.equal(dedupe.isInflight(), false);
    await dedupe.run(factory);
    assert.equal(calls, 2);
  });

  it("TTL constant is 5 minutes", () => {
    assert.equal(PUBLISHED_CATALOG_TTL_MS, 5 * 60_000);
  });
});

describe("activityWorldResumePolicy", () => {
  const t0 = 2_000_000;

  it("initial immediate when never succeeded", () => {
    assert.deepEqual(
      decideActivityWorldResume({
        lastSuccessAtMs: null,
        nowMs: t0,
        freshnessIntervalMs: ACTIVITY_WORLD_POLL_IDLE_MS,
      }),
      { action: "immediate" },
    );
  });

  it("fresh resume idle interval → schedule remaining", () => {
    const age = 12_000;
    assert.deepEqual(
      decideActivityWorldResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + age,
        freshnessIntervalMs: ACTIVITY_WORLD_POLL_IDLE_MS,
      }),
      { action: "schedule", delayMs: ACTIVITY_WORLD_POLL_IDLE_MS - age },
    );
  });

  it("fresh resume active interval → schedule remaining", () => {
    const age = 15_000;
    assert.deepEqual(
      decideActivityWorldResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + age,
        freshnessIntervalMs: ACTIVITY_WORLD_POLL_ACTIVE_MS,
      }),
      { action: "schedule", delayMs: ACTIVITY_WORLD_POLL_ACTIVE_MS - age },
    );
  });

  it("stale resume → immediate", () => {
    assert.deepEqual(
      decideActivityWorldResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + ACTIVITY_WORLD_POLL_ACTIVE_MS,
        freshnessIntervalMs: ACTIVITY_WORLD_POLL_ACTIVE_MS,
      }),
      { action: "immediate" },
    );
  });

  it("force bypass → immediate", () => {
    assert.deepEqual(
      decideActivityWorldResume({
        lastSuccessAtMs: t0,
        nowMs: t0 + 1,
        freshnessIntervalMs: ACTIVITY_WORLD_POLL_IDLE_MS,
        force: true,
      }),
      { action: "immediate" },
    );
  });
});
