import assert from "node:assert/strict";
import { AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR_HOST, HARNESS_REGION, URLS } from "./harness-config.mjs";
import { assertDirectDirectionsOff, assertEmulatorIsolation } from "./emulator-guard.mjs";
import { HARNESS_TEST_ECONOMY, seedHarnessTestEconomy } from "./harness-test-economy.mjs";
import { harnessControl as defaultHarnessControl } from "./harness-control.mjs";

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

async function ensureOnboarding(idToken) {
  const { status, json } = await postJson(URLS.ensureOnboarding, idToken, {});
  assert.equal(status, 200, JSON.stringify(json));
  return json.result.routeTokenBalance;
}

async function autoRoute(idToken, requestId, overrides = {}) {
  const payload = {
    start: [127.02, 37.5],
    targetRoadPoint: [127.07668, 37.5],
    profile: "cycling",
    targetDistanceMeters: 5000,
    requestId,
    ...overrides,
  };
  const { status, json } = await postJson(URLS.getDistanceAutoRoute, idToken, payload);
  return { status, json, payload };
}

async function inspectUser(harnessControl, uid) {
  return harnessControl("inspectUser", { uid });
}

export async function runDistanceAutoRouteTokenContract(options = {}) {
  const harnessControl = options.harnessControl ?? defaultHarnessControl;
  const economy = options.economy ?? HARNESS_TEST_ECONOMY;
  const guestGrant = economy.guestOnboardingGrant;

  assertEmulatorIsolation();
  assertDirectDirectionsOff();
  await harnessControl("reset");
  await seedHarnessTestEconomy(harnessControl);

  const guest = await signUpAnonymous();
  logStep("Guest", guest.uid);
  const balance = await ensureOnboarding(guest.idToken);
  assert.equal(balance, guestGrant, "onboarding balance");

  const success = await autoRoute(guest.idToken, "harness_auto_ok_00000001");
  assert.equal(success.status, 200, JSON.stringify(success.json));
  assert.equal(success.json.result.status, "found", "auto route should succeed");
  assert.equal(success.json.result.routeTokenBalance, guestGrant - 1, "success spends 1 token");

  let inspect = await inspectUser(harnessControl, guest.uid);
  assert.equal(inspect.balance, guestGrant - 1);
  assert.equal(inspect.routeGenerateSpend, 1, "one ledger spend for auto route");
  assert.ok(inspect.providerCallCount > 0, "provider was called");
  assert.ok(inspect.providerCallCount <= 12, "provider calls capped at 3F-C-R1 budget");
  const providerAfterSuccess = inspect.providerCallCount;

  const dup = await autoRoute(guest.idToken, "harness_auto_ok_00000001");
  assert.equal(dup.status, 200);
  assert.equal(dup.json.result.status, "found");
  inspect = await inspectUser(harnessControl, guest.uid);
  assert.equal(inspect.balance, guestGrant - 1, "idempotent retry must not spend again");
  assert.equal(inspect.routeGenerateSpend, 1);
  assert.equal(inspect.providerCallCount, providerAfterSuccess, "idempotent retry skips provider");

  await harnessControl("reset");
  await seedHarnessTestEconomy(harnessControl);
  const failGuest = await signUpAnonymous();
  await ensureOnboarding(failGuest.idToken);

  await harnessControl("setFailAll", { fail: true });
  const fail = await autoRoute(failGuest.idToken, "harness_auto_fail_00000001");
  await harnessControl("setFailAll", { fail: false });
  assert.equal(fail.status, 200, JSON.stringify(fail.json));
  assert.equal(fail.json.result.status, "failed", "all provider failures should fail without net spend");
  assert.equal(fail.json.result.routeTokenBalance, guestGrant, "failure keeps balance");

  inspect = await inspectUser(harnessControl, failGuest.uid);
  assert.equal(inspect.balance, guestGrant);
  const routeLedgerNet = inspect.ledger
    .filter((row) => row.reason === "route_generate" || row.reason === "directions_refund")
    .reduce((sum, row) => sum + row.delta, 0);
  assert.equal(routeLedgerNet, 0, "failed auto route net spend 0");

  const failDup = await autoRoute(failGuest.idToken, "harness_auto_fail_00000001");
  assert.equal(failDup.status, 200);
  assert.equal(failDup.json.result.status, "failed");
  inspect = await inspectUser(harnessControl, failGuest.uid);
  assert.equal(inspect.balance, guestGrant);
  const providerAfterFail = inspect.providerCallCount;

  await harnessControl("setBalance", { uid: failGuest.uid, balance: 0 });
  const beforeDenied = await inspectUser(harnessControl, failGuest.uid);
  const denied = await autoRoute(failGuest.idToken, "harness_auto_zero_00000001");
  assert.equal(denied.status, 429, "zero balance HTTP status");
  assert.equal(denied.json?.error?.status, "RESOURCE_EXHAUSTED");
  inspect = await inspectUser(harnessControl, failGuest.uid);
  assert.equal(
    inspect.providerCallCount,
    beforeDenied.providerCallCount,
    "zero balance must not call provider",
  );
  void providerAfterFail;

  await harnessControl("reset");
  await seedHarnessTestEconomy(harnessControl);
  const retryGuest = await signUpAnonymous();
  await ensureOnboarding(retryGuest.idToken);

  const firstSearch = await autoRoute(retryGuest.idToken, "harness_auto_retry_00000001");
  assert.equal(firstSearch.status, 200, JSON.stringify(firstSearch.json));
  assert.equal(firstSearch.json.result.routeTokenBalance, guestGrant - 1, "첫 탐색 후 잔액");

  const adjustRetry = await autoRoute(retryGuest.idToken, "harness_auto_retry_00000002", {
    distanceAdjustRetry: true,
    targetDistanceMeters: 6000,
  });
  assert.equal(adjustRetry.status, 200, JSON.stringify(adjustRetry.json));
  const retryBalance = adjustRetry.json.result.routeTokenBalance;
  assert.equal(
    retryBalance,
    guestGrant - 1,
    `distanceAdjustRetry는 토큰을 추가로 소비하지 않아야 함 (잔액 ${retryBalance})`,
  );

  const retryInspect = await inspectUser(harnessControl, retryGuest.uid);
  assert.equal(retryInspect.balance, guestGrant - 1, "distanceAdjustRetry 후 잔액 유지");
  assert.equal(retryInspect.routeGenerateSpend, 1, "distanceAdjustRetry는 route_generate 지출 없음");

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
        targetRoadPoint: [127.07668, 37.5],
        profile: "cycling",
        targetDistanceMeters: 5000,
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
