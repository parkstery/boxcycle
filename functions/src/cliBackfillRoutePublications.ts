/**
 * 레거시 courses -> routePublications 백필.
 *
 *   npm run admin:backfill-route-publications -- --dry-run
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { backfillRoutePublicationsWithAdminSdk } from "./backfillRoutePublicationsCore.js";

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
  npm run admin:backfill-route-publications [--dry-run]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const result = await backfillRoutePublicationsWithAdminSdk({ dryRun });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) console.info("[cli] dry-run only");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
