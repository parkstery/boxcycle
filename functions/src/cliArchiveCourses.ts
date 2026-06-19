/**
 * `routePublications` 가 있는 `courses` → `status: archived`.
 *
 *   npm run admin:archive-courses -- --dry-run
 *   npm run admin:archive-courses
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { archiveCoursesWithAdminSdk } from "./archiveCoursesCore.js";

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
  npm run admin:archive-courses -- [--dry-run] [--limit=200] [--serviceAccount=/abs/path.json]`);
    return;
  }

  initFirebaseAdmin();
  const limitRaw = arg("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const result = await archiveCoursesWithAdminSdk({
    dryRun: hasFlag("dry-run"),
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  console.info(JSON.stringify(result, null, 2));
  if (hasFlag("dry-run")) {
    console.info("[cli] dry-run only — re-run without --dry-run to apply.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
