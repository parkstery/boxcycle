import assert from "node:assert/strict";
import { URLS } from "./harness-config.mjs";

export async function harnessControl(action, extra = {}) {
  const res = await fetch(URLS.harnessControl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { action, ...extra } }),
  });
  if (res.status === 404) {
    throw new Error("routeTokenHarnessControl unavailable");
  }
  const json = await res.json();
  assert.equal(res.status, 200, `harness ${action}: ${JSON.stringify(json)}`);
  return json.result;
}

export async function pollInspectUser(uid, expect, { timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await harnessControl("inspectUser", { uid });
    const routeSpend = last.routeGenerateSpend ?? 0;
    const provider = last.providerCallCount ?? 0;
    if (
      last.balance === expect.balance &&
      routeSpend === expect.routeGenerateSpend &&
      provider === expect.providerCallCount
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `inspectUser timeout uid=${uid} expected=${JSON.stringify(expect)} last=${JSON.stringify(last)}`,
  );
}
