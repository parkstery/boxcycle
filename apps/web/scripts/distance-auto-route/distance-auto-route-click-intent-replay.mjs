import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFixtureExpectations,
  printReplayTable,
  replayClickIntentFixture,
  rowsFromReplay,
} from "./click-intent-replay-core.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(__dirname, "fixtures/click-intent-baseline.json"), "utf8"),
);

const allRows = [];

for (const fixture of fixtures) {
  const { searched } = await replayClickIntentFixture(fixture);
  assertFixtureExpectations(fixture, searched);
  const rows = rowsFromReplay(fixture, searched);
  for (const row of rows) {
    assert.equal(row.sameResult, true, `${fixture.id}: baseline·observe must match`);
    assert.ok(row.sameResultReason, `${fixture.id}: sameResult reason required`);
  }
  allRows.push(...rows);
}

printReplayTable(allRows);
assert.equal(fixtures.length, 4, "click-intent baseline must cover four scenarios");
