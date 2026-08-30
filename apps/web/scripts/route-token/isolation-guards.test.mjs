import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDirectDirectionsOff, assertEmulatorIsolation } from "./emulator-guard.mjs";

function withEnv(patch, fn) {
  const prev = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(patch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

describe("emulator guard negative cases", () => {
  it("FIRESTORE_EMULATOR_HOST 누락 → 실패", () => {
    withEnv(
      {
        FIRESTORE_EMULATOR_HOST: undefined,
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        RTW_ROUTE_TOKEN_HARNESS: "1",
        GCLOUD_PROJECT: "demo-rtw-route-token",
      },
      () => {
        assert.throws(() => assertEmulatorIsolation(), /FIRESTORE_EMULATOR_HOST/);
      },
    );
  });

  it("잘못된 project → 실패", () => {
    withEnv(
      {
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        RTW_ROUTE_TOKEN_HARNESS: "1",
        GCLOUD_PROJECT: "boxcycle-dc2df",
      },
      () => {
        assert.throws(() => assertEmulatorIsolation(), /demo-rtw-route-token/);
      },
    );
  });

  it("VITE_DIRECTIONS_DIRECT=1 → 실패", () => {
    withEnv({ VITE_DIRECTIONS_DIRECT: "1" }, () => {
      assert.throws(() => assertDirectDirectionsOff(), /VITE_DIRECTIONS_DIRECT/);
    });
  });

  it("RTW_ROUTE_TOKEN_HARNESS 누락 → 실패", () => {
    withEnv(
      {
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        GCLOUD_PROJECT: "demo-rtw-route-token",
        RTW_ROUTE_TOKEN_HARNESS: undefined,
      },
      () => {
        assert.throws(() => assertEmulatorIsolation(), /RTW_ROUTE_TOKEN_HARNESS/);
      },
    );
  });
});
