/**
 * `liveCourseRides` → `livePublicationRides` 일회성 복사.
 *
 *   npm run admin:migrate-live-publication-rides -- --dry-run
 *   npm run admin:migrate-live-publication-rides
 *   npm run admin:migrate-live-publication-rides -- --delete-legacy
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { migrateLivePublicationRidesWithAdminSdk } from "./migrateLivePublicationRidesCore.js";

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
  npm run admin:migrate-live-publication-rides -- [--dry-run] [--delete-legacy] [--projectId=boxcycle-dc2df] [--serviceAccount=/abs/path.json]

Copies trails/{id}/liveCourseRides/* to livePublicationRides/* with publicationId field.`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const dryRun = hasFlag("dry-run");
  const result = await migrateLivePublicationRidesWithAdminSdk({
    dryRun,
    deleteLegacy: hasFlag("delete-legacy"),
  });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
