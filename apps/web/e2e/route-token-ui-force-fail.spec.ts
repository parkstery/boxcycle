import { test } from "@playwright/test";

test.describe("Route Token UI force fail", () => {
  test.skip(process.env.ROUTE_TOKEN_UI_FORCE_FAIL !== "1", "ROUTE_TOKEN_UI_FORCE_FAIL=1 전용");

  test("runner cleanup regression — intentional failure", async () => {
    throw new Error("ROUTE_TOKEN_UI_FORCE_FAIL");
  });
});
