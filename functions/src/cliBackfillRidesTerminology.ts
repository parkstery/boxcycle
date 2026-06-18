/**
 * rides canonical 필드 백필 — roomId->trailId, userRouteId->routeId, courseId->publicationId.
 *
 *   npm run admin:backfill-rides-terminology -- --dry-run
 *   npm run admin:backfill-rides-terminology
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillRidesTerminologyWithAdminSdk } from "./backfillRidesTerminologyCore.js";

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
  npm run admin:backfill-rides-terminology [--dry-run] [--projectId=boxcycle-dc2df]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const result = await backfillRidesTerminologyWithAdminSdk({ dryRun });
  console.info(JSON.stringify({ ...result, wouldUpdate: dryRun ? result.matched : undefined }, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
