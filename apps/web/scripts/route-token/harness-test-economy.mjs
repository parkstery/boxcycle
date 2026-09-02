/** Route Token harness 전용 economy — 제품 기본값과 분리해 시험 기대치를 seed 에서 파생한다. */
export const HARNESS_TEST_ECONOMY = {
  generateCostBase: 1,
  earnPerKm: 0.15,
  onboardingGrant: 15,
  guestOnboardingGrant: 3,
  introRideBonus: 2,
  minRideDistanceM: 1000,
  minRideDurationSec: 180,
  dailyEarnCap: 10,
  guestDailyEarnCap: 5,
};

export async function seedHarnessTestEconomy(harnessControl) {
  await harnessControl("seedEconomy", { economy: HARNESS_TEST_ECONOMY });
  return HARNESS_TEST_ECONOMY;
}
