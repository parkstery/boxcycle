/**
 * 마일리지(누적 운동 이력) 전기간 재계산 백필.
 *
 *   npm run admin:backfill-mileage -- --dry-run
 *   npm run admin:backfill-mileage
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillMileageCore } from "./backfillMileageCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:backfill-mileage [--dry-run]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");

  const result = await backfillMileageCore({ dryRun });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) console.info("[cli] dry-run only");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
