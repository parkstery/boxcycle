/**
 * 프로필 수정 — 닉네임 변경을 실제 규칙(에뮬레이터) 위에서 제품 함수 그대로 시험한다.
 * 2026-10-09: 30일 제한·옛 이름 7일 묶기·users 이메일 금지(규칙을 앱 밖에서 직접 두드려 확인).
 * 실행(apps/web): npm run test:profile-edit:emulator
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserWithEmailAndPassword, signInAnonymously, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../../src/lib/firebase/app.ts";
import { deleteField, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "../../src/lib/firebase/app.ts";
import {
  NicknameCooldownError,
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

async function adminPatch(path: string, fields: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join("&");
  const res = await fetch(`${DOCS}/${path}?${mask}`, {
    method: "PATCH",
    headers: { ...ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  assert.equal(res.status, 200, await res.text());
}

const daysAgo = (d: number) => ({ timestampValue: new Date(Date.now() - d * 86_400_000).toISOString() });

async function denied(p: Promise<unknown>, label: string): Promise<void> {
  await assert.rejects(p, (e: { code?: string }) => e?.code === "permission-denied", label);
}

test("닉네임 변경 — 예약·플랜 유지·중복 거절·30일 제한·옛 이름 7일 묶기", async () => {
  const db = getFirebaseFirestore();
  // B 가 먼저 TAKEN 을 가진다
  const b = await signUp("b");
  await claimNicknameTransaction(b, TAKEN);

  const a = await signUp("a");
  await claimNicknameTransaction(a, OLD);
  await adminSetPaid(a.uid);
  assert.equal((await adminGet(`users/${a.uid}`))?.nicknameChangedAt, undefined, "가입 이름은 세지 않는다");

  // P4 남의 이름은 거절, 내 이름은 그대로
  await assert.rejects(changeNicknameTransaction(a, TAKEN), NicknameTakenError);
  assert.equal((await adminGet(`users/${a.uid}`))?.nickname?.stringValue, OLD, "P4 unchanged");
  assert.equal((await adminGet(`nicknames/${TAKEN}`))?.ownerUid?.stringValue, b.uid, "P4 B keeps");

  // P1 첫 변경은 언제든 — 변경 시각이 남는다
  await changeNicknameTransaction(a, NEW);
  const userDoc = await adminGet(`users/${a.uid}`);
  assert.equal(userDoc?.nickname?.stringValue, NEW, "P1 nickname");
  assert.equal(userDoc?.nicknameKey?.stringValue, NEW.toLowerCase(), "P1 nicknameKey");
  assert.equal(userDoc?.displayName?.stringValue, NEW, "P1 displayName");
  assert.ok(userDoc?.nicknameChangedAt?.timestampValue, "P1 nicknameChangedAt");
  // P2 유료 플랜이 그대로다(가입 함수를 썼다면 registered_free 로 강등됐다)
  assert.equal(userDoc?.tier?.stringValue, "registered_paid", "P2 tier 유지");
  // P3 새 예약은 내 것, 옛 예약은 내 이름으로 묶였다
  assert.equal((await adminGet(`nicknames/${NEW.toLowerCase()}`))?.ownerUid?.stringValue, a.uid, "P3 new reserved");
  const held = await adminGet(`nicknames/${OLD.toLowerCase()}`);
  assert.equal(held?.ownerUid?.stringValue, a.uid, "P3 old held by me");
  assert.ok(held?.releasedAt?.timestampValue, "P3 old releasedAt");

  // P5 30일 안 두 번째 변경 — 앱이 막고, 앱을 거치지 않아도 규칙이 막는다
  await assert.rejects(changeNicknameTransaction(a, `two${stamp}`), NicknameCooldownError);
  await setDoc(doc(db, "nicknames", `raw${stamp}`), { ownerUid: a.uid });
  await denied(
    setDoc(
      doc(db, "users", a.uid),
      { nickname: `raw${stamp}`, nicknameKey: `raw${stamp}`, nicknameChangedAt: serverTimestamp() },
      { merge: true },
    ),
    "P5 rules cooldown",
  );
  // 변경 시각만 고치거나 지워 제한을 풀 수 없다
  await denied(updateDoc(doc(db, "users", a.uid), { nicknameChangedAt: deleteField() }), "P5 rewind");

  // P6 묶인 옛 이름 — 남은 앱으로도, 직접 써도 못 가져간다
  const c = await signUp("c");
  await assert.rejects(claimNicknameTransaction(c, OLD), NicknameTakenError);
  await denied(setDoc(doc(db, "nicknames", OLD.toLowerCase()), { ownerUid: c.uid }), "P6 rules hold");

  // P7 묶임 7일이 지나면 가져갈 수 있다
  await adminPatch(`nicknames/${OLD.toLowerCase()}`, { releasedAt: daysAgo(8) });
  await claimNicknameTransaction(c, OLD);
  assert.equal((await adminGet(`nicknames/${OLD.toLowerCase()}`))?.ownerUid?.stringValue, c.uid, "P7 taken after hold");

  // P8 30일이 지나면 다시 바꿀 수 있고, 내가 묶어 둔 옛 이름은 되찾을 수 있다
  const auth = getFirebaseAuth();
  await signOut(auth);
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const a2 = (await signInWithEmailAndPassword(auth, `a-${stamp}@example.test`, "ProfileEdit123!")).user;
  await adminPatch(`users/${a.uid}`, { nicknameChangedAt: daysAgo(31) });
  await changeNicknameTransaction(a2, `thr${stamp}`);
  assert.equal((await adminGet(`users/${a.uid}`))?.nickname?.stringValue, `thr${stamp}`, "P8 changed after 30d");
  assert.ok((await adminGet(`nicknames/${NEW.toLowerCase()}`))?.releasedAt, "P8 NEW held");
  await adminPatch(`users/${a.uid}`, { nicknameChangedAt: daysAgo(31) });
  await changeNicknameTransaction(a2, NEW);
  const back = await adminGet(`nicknames/${NEW.toLowerCase()}`);
  assert.equal(back?.ownerUid?.stringValue, a.uid, "P8 reclaimed");
  assert.equal(back?.releasedAt, undefined, "P8 hold cleared");
});

test("users 문서에 이메일을 넣지 않는다 — 앱도, 직접 쓰기도", async () => {
  const db = getFirebaseFirestore();
  const u = await signUp("mail");
  await claimNicknameTransaction(u, `mail${stamp}`);
  assert.equal((await adminGet(`users/${u.uid}`))?.email, undefined, "가입 쓰기에 이메일 없음");
  await denied(setDoc(doc(db, "users", u.uid), { email: "x@example.test" }, { merge: true }), "이메일 추가 거절");
  // 예전에 저장된 이메일이 있어도 다른 쓰기는 막히지 않고, 지우기는 된다
  await adminPatch(`users/${u.uid}`, { email: { stringValue: "old@example.test" } });
  await setDoc(doc(db, "users", u.uid), { displayName: `mail${stamp}`, updatedAt: serverTimestamp() }, { merge: true });
  await updateDoc(doc(db, "users", u.uid), { email: deleteField() });
  assert.equal((await adminGet(`users/${u.uid}`))?.email, undefined, "지우기 허용");
});

test("Google 사진 주소(photoURL)도 공개 문서(users·동행 members)에 넣지 않는다", async () => {
  const db = getFirebaseFirestore();
  const u = await signUp("photo");
  await claimNicknameTransaction(u, `pho${stamp}`);
  assert.equal((await adminGet(`users/${u.uid}`))?.photoURL, undefined, "가입 쓰기에 사진 주소 없음");
  await denied(
    setDoc(doc(db, "users", u.uid), { photoURL: "https://example.test/p.jpg" }, { merge: true }),
    "users 사진 주소 추가 거절",
  );
  const member = doc(db, "trails", "default", "members", u.uid);
  await denied(
    setDoc(member, { displayName: `pho${stamp}`, photoURL: "https://example.test/p.jpg" }, { merge: true }),
    "동행 members 사진 주소 거절",
  );
  await setDoc(member, { displayName: `pho${stamp}`, photoURL: null, lastSeenAt: serverTimestamp() }, { merge: true });
  // 옛 문서에 남은 값이 있어도 다른 쓰기는 막히지 않는다(정리 도구가 지울 때까지)
  await adminPatch(`trails/default/members/${u.uid}`, { photoURL: { stringValue: "https://example.test/old.jpg" } });
  await setDoc(member, { lastSeenAt: serverTimestamp() }, { merge: true });
});

test("users 문서는 프로필 쓰기만 만든다 — 「주행 이어하기」 칸만 든 문서·로그인 방식과 다른 표시는 거절", async () => {
  const db = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
  const cred = await createUserWithEmailAndPassword(auth, `slot-${stamp}@example.test`, "ProfileEdit123!");
  const ref = doc(db, "users", cred.user.uid);
  await denied(
    setDoc(ref, { rideResumeSlot: { v: 1, initialized: true }, updatedAt: serverTimestamp() }, { merge: true }),
    "슬롯만 든 문서 생성 거절",
  );
  await denied(setDoc(ref, { isAnonymous: true, tier: "anonymous" }), "회원이 게스트 표시로 생성 거절");
  // 정상 경로(가입)는 그대로 된다
  await claimNicknameTransaction(cred.user, `slt${stamp}`);
  assert.equal((await adminGet(`users/${cred.user.uid}`))?.isAnonymous?.booleanValue, false);

  // 게스트: 정상 게스트 쓰기는 되고, 회원 표시로는 못 만든다
  await signOut(auth);
  const g = (await signInAnonymously(auth)).user;
  await denied(setDoc(doc(db, "users", g.uid), { isAnonymous: false }), "게스트가 회원 표시로 생성 거절");
  await setDoc(doc(db, "users", g.uid), { isAnonymous: true, tier: "anonymous", displayName: "게스트-test" });
  await signOut(auth);
});

test("게스트를 거치지 않은 새 회원(문서 없음)도 가입을 끝낸다 — 결제 필드·유료 등급은 못 넣는다", async () => {
  const db = getFirebaseFirestore();
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
  const cred = await createUserWithEmailAndPassword(auth, `direct-${stamp}@example.test`, "ProfileEdit123!");
  assert.equal(await adminGet(`users/${cred.user.uid}`), null, "전제: 문서 없음");
  await claimNicknameTransaction(cred.user, `dir${stamp}`);
  const created = await adminGet(`users/${cred.user.uid}`);
  assert.equal(created?.tier?.stringValue, "registered_free", "가입 완료");
  assert.equal(created?.nickname?.stringValue, `dir${stamp}`);

  // 같은 방법으로 유료 등급·결제 필드를 만들 수는 없다
  await signOut(auth);
  const evil = await createUserWithEmailAndPassword(auth, `evil-${stamp}@example.test`, "ProfileEdit123!");
  await setDoc(doc(db, "nicknames", `evl${stamp}`), { ownerUid: evil.user.uid });
  const base = { isAnonymous: false, nickname: `evl${stamp}`, nicknameKey: `evl${stamp}`, tierUpdatedAt: serverTimestamp() };
  await denied(setDoc(doc(db, "users", evil.user.uid), { ...base, tier: "registered_paid" }), "유료 등급 생성 거절");
  await denied(setDoc(doc(db, "users", evil.user.uid), { ...base, tier: "registered_free", subscriptionStatus: "active" }), "결제 필드 거절");
  await denied(setDoc(doc(db, "users", evil.user.uid), { isAnonymous: false, tier: "registered_free" }), "닉네임 예약 없이 회원 등급 거절");
  await signOut(auth);
});

test("게스트는 닉네임을 바꿀 수 없다", async () => {
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
  const g = (await signInAnonymously(auth)).user;
  await assert.rejects(changeNicknameTransaction(g, `gst${stamp}`), /게스트/);
  await signOut(auth);
});

/**
 * D (2026-10-09): 이미 가입한 회원이 **다시 로그인** — 앱은 저장된 닉네임으로 claimNicknameTransaction 을
 * 다시 부른다(useAppAuth). 이것이 규칙에 거절되면 로그인 때 닉네임 동기화가 「오류」로 끝난다.
 */
test("재로그인 — 같은 닉네임 재확인이 거절되지 않고, 플랜도 바뀌지 않는다", async () => {
  const name = `re${stamp}`;
  const u = await signUp("re");
  await claimNicknameTransaction(u, name); // 가입
  await claimNicknameTransaction(u, name); // 다시 로그인(무료)
  assert.equal((await adminGet(`users/${u.uid}`))?.tier?.stringValue, "registered_free", "무료 유지");
  await adminSetPaid(u.uid);
  await claimNicknameTransaction(u, name); // 유료 회원이 다시 로그인
  assert.equal((await adminGet(`users/${u.uid}`))?.tier?.stringValue, "registered_paid", "유료 유지");
});
