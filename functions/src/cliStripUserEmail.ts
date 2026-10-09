/**
 * users/{uid} 의 email 필드 제거(2026-10-09 Chief).
 * users 문서는 로그인한 누구나 읽는다. 이메일은 아무 화면도 읽지 않고 Auth 에 이미 있으므로 지운다.
 * 새로 넣는 것은 firestore.rules(userEmailNotAdded)가 막는다.
 *
 *   npm run admin:strip-user-email            # 조사만(건수)
 *   npm run admin:strip-user-email -- --yes   # 실제로 지움
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId")?.trim() || "boxcycle-dc2df",
    serviceAccountPath: arg("serviceAccount")?.trim(),
  });
  const yes = process.argv.includes("--yes");
  const db = getFirestore();
  const snap = await db.collection("users").get();
  const withEmail = snap.docs.filter((d) => {
    const e = d.get("email");
    return typeof e === "string" && e.length > 0;
  });
  console.info(`[cli] users ${snap.size}건 중 이메일이 든 문서 ${withEmail.length}건`);
  if (!yes) {
    console.info("[DRY-RUN] 아무것도 바꾸지 않았습니다. 실제로 지우려면 --yes 를 붙이세요.");
    return;
  }
  for (const d of withEmail) await d.ref.update({ email: FieldValue.delete() });
  const after = await db.collection("users").get();
  const left = after.docs.filter((d) => typeof d.get("email") === "string" && d.get("email").length > 0).length;
  console.info(`[cli] 지움 ${withEmail.length}건 · 남은 이메일 ${left}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
