/**
 * `liveCourseRides` → `livePublicationRides` 일회성 복사.
 *
 *   npm run admin:migrate-live-publication-rides -- --dry-run
 *   npm run admin:migrate-live-publication-rides
 *   npm run admin:migrate-live-publication-rides -- --delete-legacy
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrateLivePublicationRidesWithAdminSdk } from "./migrateLivePublicationRidesCore.js";

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
  npm run admin:migrate-live-publication-rides -- [--dry-run] [--delete-legacy] [--serviceAccount=/abs/path.json]

Copies trails/{id}/liveCourseRides/* to livePublicationRides/* with publicationId field.`);
    return;
  }

  initFirebaseAdmin();
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
