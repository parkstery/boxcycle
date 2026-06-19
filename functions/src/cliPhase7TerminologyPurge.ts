/**
 * Phase 7-2/7-3 — trails publicationId backfill, courseId field purge, worldActivity rename.
 *
 *   npm run admin:phase7-terminology-purge -- --dry-run
 *   npm run admin:phase7-terminology-purge
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillTrailsPublicationIdWithAdminSdk } from "./backfillTrailsPublicationIdCore.js";
import { purgePhase7CourseIdFieldsWithAdminSdk } from "./purgePhase7CourseIdFieldsCore.js";
import { migrateWorldActivityTerminologyWithAdminSdk } from "./migrateWorldActivityTerminologyCore.js";

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
  npm run admin:phase7-terminology-purge [--dry-run] [--projectId=boxcycle-dc2df]

Steps (in order):
  1. backfill trails/openTrailListings publicationId
  2. purge rides/routePublications/publicRouteRequests courseId fields
  3. migrate worldActivity/global terminology`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");

  const trails = await backfillTrailsPublicationIdWithAdminSdk({ dryRun });
  const purge = await purgePhase7CourseIdFieldsWithAdminSdk({ dryRun });
  const world = await migrateWorldActivityTerminologyWithAdminSdk({ dryRun });

  console.info(
    JSON.stringify(
      {
        dryRun,
        trails,
        purge,
        world,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
