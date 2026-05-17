/**
 * 로컬에서 서비스 계정(또는 ADC)으로 savedRoutes 완주 격상.
 *
 * 사용:
 *   npm run admin:promote-saved-route -- --routeId=Firestore문서ID
 *   npm run admin:promote-saved-route -- --routeId=xxx --rideId=rides문서ID
 *
 * 인증: 환경변수 GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   또는 gcloud auth application-default login (에뮬레이터/개인 GCP 권한에 따라 다름)
 *
 * 감사 로그용 actorUid 는 --actorUid=내FirebaseUid 로 넘기면 콘솔 로그에 남는다(기본: cli).
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promoteSavedRouteWithAdminSdk } from "./savedRouteAdminPromoteCore.js";

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
    const pid =
      typeof parsed === "object" && parsed !== null && "project_id" in parsed
        ? String((parsed as { project_id?: string }).project_id ?? "")
        : "";
    console.info("[cli] firebase-admin: --serviceAccount", pid || "(unknown project)");
    return;
  }
  initializeApp();
  console.info("[cli] firebase-admin: default credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC)");
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:promote-saved-route -- --routeId=<savedRoutes doc id> [--rideId=<rides doc id>|empty for null] [--actorUid=<uid>] [--serviceAccount=/abs/path.json]

Environment:
  GOOGLE_APPLICATION_CREDENTIALS   service account JSON path

Note: This CLI bypasses Firestore rules. Use only on trusted machines.`);
    process.exit(0);
  }

  const routeId = arg("routeId");
  if (!routeId?.trim()) {
    console.error("Missing --routeId=");
    process.exit(1);
  }

  let rideId: string | null | undefined;
  if (arg("rideId") !== undefined) {
    const r = arg("rideId");
    rideId = r === "" || r === "null" ? null : r;
  }

  const actorUid = arg("actorUid")?.trim() || "cli";

  initFirebaseAdmin();

  const result = await promoteSavedRouteWithAdminSdk({
    routeId: routeId.trim(),
    actorUid,
    rideId,
  });

  console.info(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
