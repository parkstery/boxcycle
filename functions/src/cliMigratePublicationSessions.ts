/**
 * `coursePresence` → `publicationSessions` 일회성 복사.
 *
 *   npm run admin:migrate-publication-sessions -- --dry-run
 *   npm run admin:migrate-publication-sessions
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migratePublicationSessionsWithAdminSdk } from "./migratePublicationSessionsCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function initFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  const explicit = arg("serviceAccount");
  if (explicit) {
    const raw = readFileSync(resolve(explicit), "utf8");
    const parsed = JSON.parse(raw) as Parameters<typeof cert>[0];
    initializeApp({ credential: cert(parsed) });
    return;
  }
  initializeApp();
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:migrate-publication-sessions -- [--dry-run] [--delete-legacy]`);
    return;
  }

  initFirebaseAdmin();
  const result = await migratePublicationSessionsWithAdminSdk({
    dryRun: hasFlag("dry-run"),
    deleteLegacy: hasFlag("delete-legacy"),
  });
  console.info(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
