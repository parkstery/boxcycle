/**
 * routeActivity.lastCompletedRideAt 레거시 백필.
 *
 *   npm run admin:backfill-last-completed-ride-at -- --dry-run
 *   npm run admin:backfill-last-completed-ride-at -- --limit=100
 *   npm run admin:backfill-last-completed-ride-at -- --publicationId=abc123
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillRouteActivityLastCompletedRideAt } from "./backfillRouteActivityLastCompletedRideAtCore.js";

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
  npm run admin:backfill-last-completed-ride-at [--dry-run] [--limit=50] [--publicationId=id]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const limitRaw = arg("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const publicationId = arg("publicationId");

  const result = await backfillRouteActivityLastCompletedRideAt({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
    publicationId,
  });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) console.info("[cli] dry-run only");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
