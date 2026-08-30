import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const {
  resolveHarnessActive,
  ROUTE_TOKEN_HARNESS_PROJECT_ID,
} = require("../../../../functions/lib/harnessActive.js");

const DEMO = ROUTE_TOKEN_HARNESS_PROJECT_ID;
const PROD = "boxcycle-dc2df";

const CASES = [
  { label: "emulator+demo+flag", env: { FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: DEMO, RTW_ROUTE_TOKEN_HARNESS: "1" }, expected: true },
  { label: "no emulator", env: { GCLOUD_PROJECT: DEMO, RTW_ROUTE_TOKEN_HARNESS: "1" }, expected: false },
  { label: "prod project", env: { FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: PROD, RTW_ROUTE_TOKEN_HARNESS: "1" }, expected: false },
  { label: "no flag", env: { FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: DEMO }, expected: false },
  { label: "prod no emulator", env: { GCLOUD_PROJECT: PROD, RTW_ROUTE_TOKEN_HARNESS: "1" }, expected: false },
  {
    label: "firebase config parse fail",
    env: { FUNCTIONS_EMULATOR: "true", FIREBASE_CONFIG: "{invalid", RTW_ROUTE_TOKEN_HARNESS: "1" },
    expected: false,
  },
];

describe("resolveHarnessActive truth table", () => {
  for (const row of CASES) {
    it(`${row.label} → ${row.expected}`, () => {
      assert.equal(resolveHarnessActive(row.env), row.expected);
    });
  }
});
