/**
 * trails·openTrailListings — courseId → publicationId 백필
 *
 *   npm run admin:backfill-trails-publication-id -- --dry-run
 *   npm run admin:backfill-trails-publication-id
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillTrailsPublicationIdWithAdminSdk } from "./backfillTrailsPublicationIdCore.js";

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
  npm run admin:backfill-trails-publication-id [--dry-run] [--projectId=boxcycle-dc2df]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const result = await backfillTrailsPublicationIdWithAdminSdk({ dryRun });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
