import assert from "node:assert/strict";
import {
  DEFAULT_ROUTE_TOKEN_ECONOMY,
  resolveIsAnonymousForOnboarding,
  resolveOnboardingGrantAmount,
} from "../../../../functions/lib/routeTokenCore.js";

const economy = {
  ...DEFAULT_ROUTE_TOKEN_ECONOMY,
  onboardingGrant: 15,
  guestOnboardingGrant: 10,
};

assert.equal(resolveIsAnonymousForOnboarding({ isAnonymous: true }), true);
assert.equal(resolveIsAnonymousForOnboarding({ isAnonymous: false }), false);
assert.equal(resolveIsAnonymousForOnboarding({}, true), true);
assert.equal(resolveIsAnonymousForOnboarding({}, false), false);
assert.equal(resolveIsAnonymousForOnboarding({}), true, "missing field defaults to guest");

assert.equal(resolveOnboardingGrantAmount(economy, true), 10);
assert.equal(resolveOnboardingGrantAmount(economy, false), 15);

console.log("[route-token] onboarding grant resolver PASS");
