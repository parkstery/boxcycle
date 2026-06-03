/**
 * P4 — 레거시 course* Firestore 경로 → routeCatalog / routeActivity / routePresence / liveRouteRides
 *
 *   npm run admin:migrate-route-catalog-paths -- --dry-run
 *   npm run admin:migrate-route-catalog-paths
 *
 * 배포 순서:
 * 1. firestore.rules·indexes 배포
 * 2. 본 CLI 실행
 * 3. functions·hosting 배포
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrateRouteCatalogPathsWithAdminSdk } from "./migrateRouteCatalogPathsCore.js";

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
  npm run admin:migrate-route-catalog-paths -- [--dry-run] [--serviceAccount=/abs/path.json]

Copies courses, courseActivity, coursePresence/*/members, trails|rooms/*/liveCourseRides
to routeCatalog, routeActivity, routePresence, trails/*/liveRouteRides (same document ids).
Does not delete legacy collections.`);
    return;
  }

  initFirebaseAdmin();
  const dryRun = hasFlag("dry-run");
  const result = await migrateRouteCatalogPathsWithAdminSdk({ dryRun });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
