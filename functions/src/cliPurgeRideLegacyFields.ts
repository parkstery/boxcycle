/**
 * rides 레거시 필드 roomId, userRouteId 제거 (canonical 필드 존재 시).
 *
 *   npm run admin:purge-ride-legacy-fields -- --dry-run
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { purgeRideLegacyFieldsWithAdminSdk } from "./purgeRideLegacyFieldsCore.js";

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
  npm run admin:purge-ride-legacy-fields [--dry-run]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const result = await purgeRideLegacyFieldsWithAdminSdk({ dryRun });
  console.info(JSON.stringify({ ...result, wouldUpdate: dryRun ? result.matched : undefined }, null, 2));
  if (dryRun) console.info("[cli] dry-run only");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
