/**
 * 로그인한 누구나 읽는 문서에서 개인정보 필드 제거(2026-10-09 Chief).
 *   - users/{uid}                     : email, photoURL
 *   - trails/{id}/members/{uid},
 *     publicationSessions/{id}/members/{uid} (collection group "members") : email, photoURL
 * 어느 화면도 이 값을 읽지 않고 Auth 에 이미 있다. 새로 넣는 것은 firestore.rules(publicPiiNotAdded)가 막는다.
 *
 *   npm run admin:strip-public-pii            # 조사만(건수)
 *   npm run admin:strip-public-pii -- --yes   # 실제로 지움
 */
import { FieldValue, getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

const PII_FIELDS = ["email", "photoURL"] as const;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** 지울 필드 — 값이 null 이 아닌 것만(null 은 개인정보가 아니고, 지워도 같다) */
function piiFieldsOf(d: QueryDocumentSnapshot): string[] {
  return PII_FIELDS.filter((f) => {
    const v = d.get(f);
    return v != null && v !== "";
  });
}

async function scan() {
  const db = getFirestore();
  const [users, members] = await Promise.all([db.collection("users").get(), db.collectionGroup("members").get()]);
  const hits = [...users.docs, ...members.docs]
    .map((d) => ({ d, fields: piiFieldsOf(d) }))
    .filter((h) => h.fields.length > 0);
  const count = (pred: (path: string) => boolean, f: string) =>
    hits.filter((h) => pred(h.d.ref.path) && h.fields.includes(f)).length;
  const isUser = (p: string) => p.startsWith("users/");
  return {
    hits,
    summary: {
      scanned: { users: users.size, members: members.size },
      users: { email: count(isUser, "email"), photoURL: count(isUser, "photoURL") },
      members: { email: count((p) => !isUser(p), "email"), photoURL: count((p) => !isUser(p), "photoURL") },
    },
  };
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId")?.trim() || "boxcycle-dc2df",
    serviceAccountPath: arg("serviceAccount")?.trim(),
  });
  const yes = process.argv.includes("--yes");
  const before = await scan();
  console.info(`[cli] 개인정보가 든 문서 ${before.hits.length}건`, JSON.stringify(before.summary));
  if (!yes) {
    console.info("[DRY-RUN] 아무것도 바꾸지 않았습니다. 실제로 지우려면 --yes 를 붙이세요.");
    return;
  }
  for (const { d, fields } of before.hits) {
    await d.ref.update(Object.fromEntries(fields.map((f) => [f, FieldValue.delete()])));
  }
  const after = await scan();
  console.info(`[cli] 지움 ${before.hits.length}건 · 남은 문서 ${after.hits.length}건`, JSON.stringify(after.summary));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
