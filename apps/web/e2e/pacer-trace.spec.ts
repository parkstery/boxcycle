/**
 * 진단 전용 — 페이서 프레임 궤적을 덤프한다(툭툭 끊김 원인 계측). 판정 없음.
 */
import { test } from "./open-meteo-stub";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureRiding, guestStart, loadIntroCourse, setSpeedKmh } from "./rideEntryHelpers";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.out/pacer/trace.json");

test("pacer frame trace", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await guestStart(page);
  await loadIntroCourse(page, { pick: "longest" });
  await ensureRiding(page);
  await setSpeedKmh(page, 20);
  await page.waitForTimeout(25_000);
  await page.evaluate(() => {
    (window as unknown as { __rtwPacerTrace: unknown[] }).__rtwPacerTrace = [];
  });
  await page.waitForTimeout(30_000);
  const trace = await page.evaluate(
    () => (window as unknown as { __rtwPacerTrace: unknown[] }).__rtwPacerTrace,
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(trace));
  console.log(`PACER_TRACE frames=${trace.length} -> ${OUT}`);
});
