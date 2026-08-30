import assert from "node:assert/strict";
import { AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR_HOST, HARNESS_REGION, SAMPLE_ROUTE, URLS } from "./harness-config.mjs";
import { assertDirectDirectionsOff, assertEmulatorIsolation } from "./emulator-guard.mjs";

function logStep(label, detail) {
  console.log(`[route-token] ${label}${detail ? `: ${detail}` : ""}`);
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

async function directions(idToken, requestId, endOffset = 0) {
  const end = [SAMPLE_ROUTE.end[0] + endOffset * 0.001, SAMPLE_ROUTE.end[1]];
  const { status, json } = await postJson(URLS.getMapboxDirections, idToken, {
    ...SAMPLE_ROUTE,
    end,
    requestId,
  });
  return { status, json };
}

function errorStatus(json) {
  return json?.error?.status ?? null;
}

function countLedgerReason(ledger, reason) {
  return ledger.filter((row) => row.reason === reason).length;
}

async function inspectUser(uid) {
  return harnessControl("inspectUser", { uid });
}

async function assertProductionProjectControlAbsent() {
  const url = `http://${FUNCTIONS_EMULATOR_HOST}/boxcycle-dc2df/${HARNESS_REGION}/routeTokenHarnessControl`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { action: "stats" } }),
  });
  assert.equal(res.status, 404, "운영 project 에서 harness control 미발견");
}

async function runMainContract() {
  assertEmulatorIsolation();
  assertDirectDirectionsOff();
  await assertProductionProjectControlAbsent();
  await harnessControl("reset");

  const guest = await signUpAnonymous();
  logStep("Guest", guest.uid);

  let balance = await ensureOnboarding(guest.idToken);
  assert.equal(balance, 3, "onboarding balance");

  const balanceRetry = await ensureOnboarding(guest.idToken);
  assert.equal(balanceRetry, 3, "onboarding retry balance");
  let inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 3);
  assert.equal(countLedgerReason(inspect.ledger, "onboarding"), 1);

  const rows = [];
  for (let i = 1; i <= 3; i += 1) {
    const requestId = `harness_route_${i}_00000001`;
    const { status, json } = await directions(guest.idToken, requestId, i);
    assert.equal(status, 200, `route ${i}: ${JSON.stringify(json)}`);
    assert.equal(json.result.routeTokenBalance, 3 - i, `route ${i} balance`);
    inspect = await inspectUser(guest.uid);
    rows.push({
      step: i,
      status: "ok",
      balance: inspect.balance,
      routeGenerateSpend: inspect.routeGenerateSpend,
      providerCalls: inspect.providerCallCount,
    });
  }

  assert.deepEqual(
    rows.map((r) => r.balance),
    [2, 1, 0],
  );
  assert.deepEqual(
    rows.map((r) => r.routeGenerateSpend),
    [1, 2, 3],
  );
  assert.equal(rows[2].providerCalls, 3);

  const denied = await directions(guest.idToken, "harness_route_4_00000001", 4);
  assert.equal(denied.status, 429, "4th route HTTP status");
  assert.equal(errorStatus(denied.json), "RESOURCE_EXHAUSTED");
  inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 0);
  assert.equal(inspect.routeGenerateSpend, 3);
  assert.equal(inspect.providerCallCount, 3, "4th must not call provider");

  const dup = await directions(guest.idToken, "harness_route_1_00000001", 1);
  assert.equal(dup.status, 200);
  inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 0, "idempotent retry must not change balance");
  assert.equal(inspect.routeGenerateSpend, 3, "idempotent retry spend");

  console.log("\n=== ROUTE-TOKEN-1 통과표 ===");
  console.log("| step | result | balance | route_generate -1 | provider |");
  console.log("| 0 onboarding | ok | 3 | 0 | 0 |");
  for (const row of rows) {
    console.log(
      `| ${row.step} route | ok | ${row.balance} | ${row.routeGenerateSpend} | ${row.providerCalls} |`,
    );
  }
  console.log("| 4 route | resource-exhausted | 0 | 3 | 3 |");
}

async function runProviderFailureContract() {
  const guest = await signUpAnonymous();
  await ensureOnboarding(guest.idToken);
  await harnessControl("reset");
  await harnessControl("setFailNext", { fail: true });

  const { status, json } = await directions(guest.idToken, "harness_fail_00000001", 0);
  assert.notEqual(status, 200, "provider failure should not succeed");
  assert.ok(json.error, "error body expected");

  const inspect = await inspectUser(guest.uid);
  assert.equal(inspect.balance, 3, "provider failure net balance");
  assert.equal(inspect.providerCallCount, 1, "provider was invoked once");

  const onboardingCount = countLedgerReason(inspect.ledger, "onboarding");
  const refundCount = countLedgerReason(inspect.ledger, "directions_refund");
  const spendCount = countLedgerReason(inspect.ledger, "route_generate");
  assert.equal(onboardingCount, 1);
  assert.equal(spendCount, 1, "spend ledger recorded");
  assert.equal(refundCount, 1, "refund ledger recorded");
  const routeLedgerNet = inspect.ledger
    .filter((row) => row.reason === "route_generate" || row.reason === "directions_refund")
    .reduce((sum, row) => sum + row.delta, 0);
  assert.equal(routeLedgerNet, 0, "route ledger net delta");

  const retry = await directions(guest.idToken, "harness_fail_00000001", 0);
  assert.equal(retry.status, 200, "same requestId retry after refund");
  const afterRetry = await inspectUser(guest.uid);
  assert.equal(afterRetry.balance, 3, "retry must not add spend after refund");
  assert.equal(afterRetry.routeGenerateSpend, 1);
  assert.equal(afterRetry.providerCallCount, 2);

  logStep("provider failure contract", "PASS");
}

async function main() {
  await runMainContract();
  await runProviderFailureContract();
  console.log("\n[route-token] ROUTE-TOKEN-1 contract PASS");
}

main().catch((err) => {
  console.error("[route-token] FAIL", err);
  process.exit(1);
});
