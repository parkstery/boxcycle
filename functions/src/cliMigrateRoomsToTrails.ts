/**
 * `rooms/{trailId}/members|liveCourseRides` → `trails/{trailId}/...` 일회성 복사.
 *
 *   npm run admin:migrate-rooms-to-trails -- --dry-run
 *   npm run admin:migrate-rooms-to-trails
 *
 * 배포 순서 권장:
 * 1. firestore.rules (`trails` write 허용) 배포
 * 2. 본 CLI 실행
 * 3. 웹·Functions(`trails` 경로) 배포
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrateRoomsToTrailsWithAdminSdk } from "./migrateRoomsToTrailsCore.js";

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
  npm run admin:migrate-rooms-to-trails -- [--dry-run] [--serviceAccount=/abs/path.json]

Copies documents from rooms/{id}/members and rooms/{id}/liveCourseRides to trails/{id}/...
Skips targets that already exist. Does not delete rooms/* sources.`);
    return;
  }

  initFirebaseAdmin();
  const dryRun = hasFlag("dry-run");
  const result = await migrateRoomsToTrailsWithAdminSdk({ dryRun });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
