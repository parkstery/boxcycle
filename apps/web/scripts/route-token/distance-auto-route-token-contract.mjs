import assert from "node:assert/strict";
import { AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR_HOST, HARNESS_REGION, URLS } from "./harness-config.mjs";
import { assertDirectDirectionsOff, assertEmulatorIsolation } from "./emulator-guard.mjs";

function logStep(label, detail) {
  console.log(`[route-token:auto] ${label}${detail ? `: ${detail}` : ""}`);
}

async function signUpAnonymous() {
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  assert.equal(res.status, 200, `anonymous signUp status ${res.status}`);
  const json = await res.json();
  assert.ok(json.idToken, "idToken missing");
  assert.ok(json.localId, "localId missing");
  return { idToken: json.idToken, uid: json.localId };
}

async function postJson(url, idToken, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON ${url} ${res.status}: ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

async function harnessControl(action, extra = {}) {
  const res = await fetch(URLS.harnessControl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { action, ...extra } }),
  });
  if (res.status === 404) {
    throw new Error("routeTokenHarnessControl unavailable — harness env not active?");
  }
  const json = await res.json();
  assert.equal(res.status, 200, `harness ${action} failed: ${JSON.stringify(json)}`);
  return json.result;
}

async function ensureOnboarding(idToken) {
  const { status, json } = await postJson(URLS.ensureOnboarding, idToken, {});
  assert.equal(status, 200, JSON.stringify(json));
  return json.result.routeTokenBalance;
}

async function autoRoute(idToken, requestId, overrides = {}) {
  const payload = {
    start: [127.02, 37.5],
    profile: "cycling",
    targetDistanceMeters: 5000,
    bearingDeg: 90,
    requestId,
    ...overrides,
  };
  const { status, json } = await postJson(URLS.getDistanceAutoRoute, idToken, payload);
  return { status, json, payload };
}

async function inspectUser(uid) {
  return harnessControl("inspectUser", { uid });
}

export async function runDistanceAutoRouteTokenContract() {
  assertEmulatorIsolation();
  assertDirectDirectionsOff();
  await harnessControl("reset");

  const guest = await signUpAnonymous();
  logStep("Guest", guest.uid);
  const balance = await ensureOnboarding(guest.idToken);
  assert.equal(balance, 3, "onboarding balance");

  const success = await autoRoute(guest.idToken, "harness_auto_ok_00000001");
  assert.equal(success.status, 200, JSON.stringify(success.json));
  assert.equal(success.json.result.status, "found", "auto route should succeed");
  assert.equal(success.json.result.routeTokenBalance, 2, "success spends 1 token");

  let inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 2);
  assert.equal(inspect.routeGenerateSpend, 1, "one ledger spend for auto route");
  assert.ok(inspect.providerCallCount > 0, "provider was called");
  assert.ok(inspect.providerCallCount <= 35, "provider calls capped at candidate count");
  const providerAfterSuccess = inspect.providerCallCount;

  const dup = await autoRoute(guest.idToken, "harness_auto_ok_00000001");
  assert.equal(dup.status, 200);
  assert.equal(dup.json.result.status, "found");
  inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 2, "idempotent retry must not spend again");
  assert.equal(inspect.routeGenerateSpend, 1);
  assert.equal(inspect.providerCallCount, providerAfterSuccess, "idempotent retry skips provider");

  await harnessControl("reset");
  const failGuest = await signUpAnonymous();
  await ensureOnboarding(failGuest.idToken);

  await harnessControl("setFailAll", { fail: true });
  const fail = await autoRoute(failGuest.idToken, "harness_auto_fail_00000001");
  await harnessControl("setFailAll", { fail: false });
  assert.equal(fail.status, 200, JSON.stringify(fail.json));
  assert.equal(fail.json.result.status, "failed", "all provider failures should fail without net spend");
  assert.equal(fail.json.result.routeTokenBalance, 3, "failure keeps balance");

  inspect = await inspectUser(failGuest.uid);
  assert.equal(inspect.balance, 3);
  const routeLedgerNet = inspect.ledger
    .filter((row) => row.reason === "route_generate" || row.reason === "directions_refund")
    .reduce((sum, row) => sum + row.delta, 0);
  assert.equal(routeLedgerNet, 0, "failed auto route net spend 0");

  const failDup = await autoRoute(failGuest.idToken, "harness_auto_fail_00000001");
  assert.equal(failDup.status, 200);
  assert.equal(failDup.json.result.status, "failed");
  inspect = await inspectUser(failGuest.uid);
  assert.equal(inspect.balance, 3);
  const providerAfterFail = inspect.providerCallCount;

  await harnessControl("setBalance", { uid: failGuest.uid, balance: 0 });
  const beforeDenied = await inspectUser(failGuest.uid);
  const denied = await autoRoute(failGuest.idToken, "harness_auto_zero_00000001");
  assert.equal(denied.status, 429, "zero balance HTTP status");
  assert.equal(denied.json?.error?.status, "RESOURCE_EXHAUSTED");
  inspect = await inspectUser(failGuest.uid);
  assert.equal(
    inspect.providerCallCount,
    beforeDenied.providerCallCount,
    "zero balance must not call provider",
  );
  void providerAfterFail;

  logStep("distance auto route token contract", "PASS");
}

async function assertProductionAutoRouteSurfaceAbsent() {
  const url = `http://${FUNCTIONS_EMULATOR_HOST}/boxcycle-dc2df/${HARNESS_REGION}/getDistanceAutoRoute`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        start: [127.02, 37.5],
        profile: "cycling",
        targetDistanceMeters: 5000,
        bearingDeg: 90,
        requestId: "prod_surface_check_01",
      },
    }),
  });
  assert.ok(res.status === 401 || res.status === 403 || res.status === 404, "unauthenticated prod surface");
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  runDistanceAutoRouteTokenContract()
    .then(() => assertProductionAutoRouteSurfaceAbsent())
    .catch((err) => {
      console.error("[route-token:auto] FAIL", err);
      process.exit(1);
    });
}
