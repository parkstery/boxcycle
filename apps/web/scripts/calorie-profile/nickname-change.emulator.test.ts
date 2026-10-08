/**
 * 프로필 수정 — 닉네임 변경을 실제 규칙(에뮬레이터) 위에서 제품 함수 그대로 시험한다.
 * 실행(apps/web): npm run test:profile-edit:emulator
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserWithEmailAndPassword, signInAnonymously, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../src/lib/firebase/app.ts";
import {
  NicknameTakenError,
  changeNicknameTransaction,
  claimNicknameTransaction,
} from "../../src/lib/identity/repo/firestoreUser.ts";

const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (!/^(127\.0\.0\.1|localhost):/.test(FS_HOST)) {
  throw new Error(`FIRESTORE_EMULATOR_HOST missing/non-local (${FS_HOST || "unset"}) — refuse live Firebase.`);
}
const DOCS = `http://${FS_HOST}/v1/projects/boxcycle-dc2df/databases/(default)/documents`;
const ADMIN = { Authorization: "Bearer owner" };

async function adminGet(path: string): Promise<Record<string, Record<string, unknown>> | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: ADMIN });
  if (res.status === 404) return null;
  assert.equal(res.status, 200, `${path}: ${res.status}`);
  return ((await res.json()) as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
}

async function adminSetPaid(uid: string): Promise<void> {
  const res = await fetch(`${DOCS}/users/${uid}?updateMask.fieldPaths=tier&updateMask.fieldPaths=subscriptionStatus`, {
    method: "PATCH",
    headers: { ...ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: { tier: { stringValue: "registered_paid" }, subscriptionStatus: { stringValue: "active" } },
    }),
  });
  assert.equal(res.status, 200, await res.text());
}

const stamp = Date.now().toString(36).slice(-5);
const OLD = `old${stamp}`;
const NEW = `new${stamp}`;
const TAKEN = `tkn${stamp}`;

/** 실제 앱처럼 게스트 문서(tier: anonymous)가 먼저 있고, 가입 때 닉네임으로 승격된다 */
async function signUp(label: string) {
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
  const cred = await createUserWithEmailAndPassword(auth, `${label}-${stamp}@example.test`, "ProfileEdit123!");
  const res = await fetch(`${DOCS}/users/${cred.user.uid}`, {
    method: "PATCH",
    headers: { ...ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { tier: { stringValue: "anonymous" }, isAnonymous: { booleanValue: true } } }),
  });
  assert.equal(res.status, 200, await res.text());
  return cred.user;
}

test("닉네임 변경 — 새 이름 예약·옛 이름 해제·유료 플랜 유지·중복 거절", async () => {
  // B 가 먼저 TAKEN 을 가진다
  const b = await signUp("b");
  await claimNicknameTransaction(b, TAKEN);

  const a = await signUp("a");
  await claimNicknameTransaction(a, OLD);
  await adminSetPaid(a.uid);

  // P1 변경 성공
  await changeNicknameTransaction(a, NEW);
  const userDoc = await adminGet(`users/${a.uid}`);
  assert.equal(userDoc?.nickname?.stringValue, NEW, "P1 nickname");
  assert.equal(userDoc?.nicknameKey?.stringValue, NEW.toLowerCase(), "P1 nicknameKey");
  assert.equal(userDoc?.displayName?.stringValue, NEW, "P1 displayName");
  // P2 유료 플랜이 그대로다(가입 함수를 썼다면 registered_free 로 강등됐다)
  assert.equal(userDoc?.tier?.stringValue, "registered_paid", "P2 tier 유지");
  // P3 새 예약은 내 것, 옛 예약은 풀렸다
  assert.equal((await adminGet(`nicknames/${NEW.toLowerCase()}`))?.ownerUid?.stringValue, a.uid, "P3 new reserved");
  assert.equal(await adminGet(`nicknames/${OLD.toLowerCase()}`), null, "P3 old released");

  // P4 남의 이름은 거절, 내 이름은 그대로
  await assert.rejects(changeNicknameTransaction(a, TAKEN), NicknameTakenError);
  assert.equal((await adminGet(`users/${a.uid}`))?.nickname?.stringValue, NEW, "P4 unchanged");
  assert.equal((await adminGet(`nicknames/${TAKEN}`))?.ownerUid?.stringValue, b.uid, "P4 B keeps");

  // P5 대소문자만 바꾸기 — 같은 예약 키를 유지한다
  const NEW_CASED = NEW.charAt(0).toUpperCase() + NEW.slice(1);
  await changeNicknameTransaction(a, NEW_CASED);
  assert.equal((await adminGet(`users/${a.uid}`))?.nickname?.stringValue, NEW_CASED, "P5 cased");
  assert.equal((await adminGet(`nicknames/${NEW.toLowerCase()}`))?.ownerUid?.stringValue, a.uid, "P5 key kept");

  // P6 옛 이름은 이제 다른 사람이 가질 수 있다
  const c = await signUp("c");
  await claimNicknameTransaction(c, OLD);
  assert.equal((await adminGet(`nicknames/${OLD.toLowerCase()}`))?.ownerUid?.stringValue, c.uid, "P6 reusable");
});

test("게스트는 닉네임을 바꿀 수 없다", async () => {
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
  const g = (await signInAnonymously(auth)).user;
  await assert.rejects(changeNicknameTransaction(g, `gst${stamp}`), /게스트/);
  await signOut(auth);
});
