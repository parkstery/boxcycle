/**
 * Lobby/Room vs Trail, course vs route 필드 불일치 실측.
 *
 *   npm run admin:audit-terminology
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { auditTerminologyWithAdminSdk } from "./auditTerminologyCore.js";

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
  npm run admin:audit-terminology [--projectId=boxcycle-dc2df] [--serviceAccount=/abs/path.json]`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const result = await auditTerminologyWithAdminSdk();
  console.info(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
