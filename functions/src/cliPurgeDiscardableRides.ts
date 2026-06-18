/**
 * 거리 200m 이하 또는 주행 3분 이하 `rides` 문서 일괄 삭제.
 *
 *   npm run admin:purge-discardable-rides -- --dry-run
 *   npm run admin:purge-discardable-rides
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { purgeDiscardableRidesWithAdminSdk } from "./purgeDiscardableRidesCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const DEFAULT_PROJECT_ID = "boxcycle-dc2df";

function initFirebaseAdmin(): void {
  initFirebaseAdminForCli({
    projectId: arg("projectId")?.trim() || DEFAULT_PROJECT_ID,
    serviceAccountPath: arg("serviceAccount"),
  });
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:purge-discardable-rides -- [--dry-run] [--serviceAccount=/abs/path.json]

Deletes rides where distanceMeters <= 200 OR elapsedSec <= 180.`);
    return;
  }

  initFirebaseAdmin();
  const dryRun = hasFlag("dry-run");
  const result = await purgeDiscardableRidesWithAdminSdk({ dryRun });
  const report = {
    ...result,
    wouldDelete: dryRun ? result.matched : undefined,
  };
  console.info(JSON.stringify(report, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to delete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
