/**
 * 입문(Basic) 실도로 publication 3건 idempotent 시드/마이그레이션.
 *
 * 프로덕션 `firestore.rules` 는 클라이언트의 `routePublications` create/geometry update 를 막으므로
 * Firestore 를 실제 실도로 seed 로 맞추는 것은 이 Admin CLI 의 몫이다.
 *
 *   # 무엇이 바뀔지만 본다(기본 권장 — 프로덕션은 먼저 이것부터)
 *   npm run admin:seed-basic-intro-publications -- --dry-run
 *
 *   # 실제 쓰기 (Chief 승인 후)
 *   npm run admin:seed-basic-intro-publications
 *
 *   # 허구 직선 레거시 3건을 archived 로 내림 (삭제 아님, 별도 승인 필요)
 *   npm run admin:seed-basic-intro-publications -- --archive-legacy --dry-run
 *
 * 이 CLI 는 어떤 문서도 삭제하지 않는다.
 */
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { seedBasicIntroPublicationsWithAdminSdk } from "./seedBasicIntroPublicationsCore.js";

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
  npm run admin:seed-basic-intro-publications -- [--dry-run] [--archive-legacy]
                                                [--projectId=<id>] [--serviceAccount=<path>]

  --dry-run         쓰기 없이 계획만 출력
  --archive-legacy  허구 직선 레거시 3건을 status=archived 로 내림 (삭제하지 않음)`);
    return;
  }

  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const dryRun = hasFlag("dry-run");
  const archiveLegacy = hasFlag("archive-legacy");
  const result = await seedBasicIntroPublicationsWithAdminSdk({ dryRun, archiveLegacy });
  console.info(JSON.stringify(result, null, 2));
  if (dryRun) console.info("[cli] dry-run only — Firestore 는 바뀌지 않았습니다");
  if (result.errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
