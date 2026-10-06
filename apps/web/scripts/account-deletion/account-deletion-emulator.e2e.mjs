/**
 * 계정 탈퇴 통합 시험 — Auth·Firestore·RTDB·Functions 에뮬레이터.
 * HTTP 로 deleteAccountHttp 를 직접 호출한다(Google 팝업 재인증 없음).
 *
 * 실행: npm run test:e2e:account-deletion
 * (run-with-functions-emulator → firebase emulators:exec)
 *
 * SoT: document/ops/20261006-account-deletion/02-task-15.md
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostFor } from "../../../../scripts/emulatorPorts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../../functions/package.json"));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID = "boxcycle-dc2df";
const REGION = "asia-northeast3";

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? hostFor("auth");
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? hostFor("firestore");
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? hostFor("database");
const FN_HOST = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? hostFor("functions");

function requireLocalHost(label, host) {
  if (!host || (!host.startsWith("127.0.0.1:") && !host.startsWith("localhost:"))) {
    throw new Error(`${label} missing/non-local (${host || "unset"}) — refuse live Firebase.`);
  }
}

requireLocalHost("FIREBASE_AUTH_EMULATOR_HOST", AUTH_HOST);
requireLocalHost("FIRESTORE_EMULATOR_HOST", FS_HOST);
requireLocalHost("FIREBASE_DATABASE_EMULATOR_HOST", DB_HOST);
requireLocalHost("FIREBASE_FUNCTIONS_EMULATOR_HOST", FN_HOST);

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB_HOST;

const DELETE_URL = `http://${FN_HOST}/${PROJECT_ID}/${REGION}/deleteAccountHttp`;

function log(step, detail) {
  console.log(`[account-deletion-e2e] ${step}${detail ? `: ${detail}` : ""}`);
}

async function authSignUpEmail(email, password = "AccountDeletionPass123!") {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  assert.equal(res.status, 200, `email signUp ${email}: ${res.status} ${JSON.stringify(json)}`);
  assert.ok(json.idToken && json.localId);
  return { idToken: json.idToken, uid: json.localId, email, password };
}

async function authSignUpAnonymous() {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const json = await res.json();
  assert.equal(res.status, 200, `anonymous signUp: ${res.status} ${JSON.stringify(json)}`);
  return { idToken: json.idToken, uid: json.localId };
}

async function assertAuthMissing(auth, uid, label) {
  try {
    await auth.getUser(uid);
    assert.fail(`${label} Auth user should be deleted: ${uid}`);
  } catch (e) {
    assert.equal(e?.code, "auth/user-not-found", `${label} expected user-not-found, got ${e?.code}`);
  }
}

async function assertAuthExists(auth, uid, label) {
  const user = await auth.getUser(uid);
  assert.equal(user.uid, uid, `${label} Auth user missing`);
}

async function postDeleteAccount(idToken, confirmPhrase) {
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(DELETE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirmPhrase }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

function initAdmin() {
  if (getApps().length === 0) {
    // Functions 에뮬레이터(initializeApp()) 와 같은 default RTDB 네임스페이스를 쓴다.
    // `http://host:9000?ns=` 형태는 Admin·Functions 가 서로 다른 인스턴스를 볼 수 있다.
    initializeApp({
      projectId: PROJECT_ID,
      databaseURL: `https://${PROJECT_ID}-default-rtdb.firebaseio.com`,
    });
  }
  return {
    db: getFirestore(),
    rtdb: getDatabase(),
    auth: getAuth(),
  };
}

async function seedUserData(db, rtdb, { uidA, uidB, nicknameA, trailId, pubId }) {
  const nickKey = nicknameA.trim().toLowerCase();
  const batch = db.batch();

  batch.set(db.doc(`users/${uidA}`), {
    nickname: nicknameA,
    // stripeSubscriptionId 없음 — 에뮬레이터에서 Stripe 해지 건너뜀
  });
  batch.set(db.doc(`users/${uidB}`), { nickname: "UserBKeep" });
  batch.set(db.doc(`nicknames/${nickKey}`), { ownerUid: uidA, nickname: nicknameA });

  for (const id of [`sr-a-1-${uidA.slice(0, 6)}`, `sr-a-2-${uidA.slice(0, 6)}`]) {
    batch.set(db.doc(`savedRoutes/${id}`), { userId: uidA, name: id });
  }
  batch.set(db.doc(`savedRoutes/sr-b-1-${uidB.slice(0, 6)}`), { userId: uidB, name: "B route" });

  for (const id of [`ride-a-1-${uidA.slice(0, 6)}`, `ride-a-2-${uidA.slice(0, 6)}`]) {
    batch.set(db.doc(`rides/${id}`), { userId: uidA, status: "completed" });
  }

  batch.set(db.doc(`conquest/${uidA}`), { totalMeters: 100 });
  batch.set(db.doc(`conquest/${uidA}/chunks/c1`), { meters: 50 });
  batch.set(db.doc(`conquest/${uidA}/traces/t1`), { meters: 50 });

  batch.set(db.doc(`routeTokenLedger/ledger-a-1`), { userId: uidA, delta: 1 });
  batch.set(db.doc(`publicRouteRequests/req-a-1`), { applicantUid: uidA, status: "pending" });
  batch.set(db.doc(`routePublications/${pubId}`), {
    applicantUid: uidA,
    title: "pub-by-A",
    publisherDeleted: false,
  });

  batch.set(db.doc(`livePresence/${uidA}`), { trailId, at: Date.now() });
  batch.set(db.doc(`trails/${trailId}`), { hostUid: uidB, status: "open" });
  batch.set(db.doc(`trails/${trailId}/members/${uidA}`), { uid: uidA, role: "rider" });

  await batch.commit();

  await rtdb.ref(`trails/${trailId}/motion/${uidA}`).set({
    p: "pub-seed",
    d: 12.5,
    v: 4.2,
    ph: "live",
    t: Date.now(),
  });

  return { nickKey };
}

async function assertDocMissing(db, path) {
  const snap = await db.doc(path).get();
  assert.equal(snap.exists, false, `expected missing: ${path}`);
}

async function assertQueryEmpty(db, collection, field, uid) {
  const snap = await db.collection(collection).where(field, "==", uid).get();
  assert.equal(snap.size, 0, `expected 0 in ${collection} where ${field}==${uid}, got ${snap.size}`);
}

async function runHappyPath(admin) {
  const stamp = Date.now();
  const userA = await authSignUpEmail(`del_a_${stamp}@test.local`);
  const userB = await authSignUpEmail(`del_b_${stamp}@test.local`);
  const nicknameA = `DelA${stamp}`;
  const trailId = `trail-del-${stamp}`;
  const pubId = `pub-del-${stamp}`;

  log("seed", `A=${userA.uid} B=${userB.uid}`);
  const { nickKey } = await seedUserData(admin.db, admin.rtdb, {
    uidA: userA.uid,
    uidB: userB.uid,
    nicknameA,
    trailId,
    pubId,
  });

  // 시드 직후 motion 존재
  const motionBefore = await admin.rtdb.ref(`trails/${trailId}/motion/${userA.uid}`).get();
  assert.equal(motionBefore.exists(), true, "RTDB motion seeded");

  const del = await postDeleteAccount(userA.idToken, "탈퇴");
  log("deleteAccountHttp", `${del.status} ${JSON.stringify(del.json)}`);
  assert.equal(del.status, 200, `happy path status: ${JSON.stringify(del.json)}`);
  assert.equal(del.json?.result?.ok, true);

  // A 개인 데이터 없음
  await assertDocMissing(admin.db, `users/${userA.uid}`);
  await assertDocMissing(admin.db, `nicknames/${nickKey}`);
  await assertDocMissing(admin.db, `conquest/${userA.uid}`);
  await assertDocMissing(admin.db, `conquest/${userA.uid}/chunks/c1`);
  await assertDocMissing(admin.db, `conquest/${userA.uid}/traces/t1`);
  await assertDocMissing(admin.db, `livePresence/${userA.uid}`);
  await assertDocMissing(admin.db, `trails/${trailId}/members/${userA.uid}`);
  await assertQueryEmpty(admin.db, "savedRoutes", "userId", userA.uid);
  await assertQueryEmpty(admin.db, "rides", "userId", userA.uid);
  await assertQueryEmpty(admin.db, "routeTokenLedger", "userId", userA.uid);
  await assertQueryEmpty(admin.db, "publicRouteRequests", "applicantUid", userA.uid);

  // routePublications 익명화 유지
  const pub = await admin.db.doc(`routePublications/${pubId}`).get();
  assert.equal(pub.exists, true, "publication remains");
  assert.equal(pub.get("applicantUid"), "");
  assert.equal(pub.get("publisherDeleted"), true);

  // RTDB motion 없음
  const motionAfter = await admin.rtdb.ref(`trails/${trailId}/motion/${userA.uid}`).get();
  assert.equal(motionAfter.exists(), false, "RTDB motion removed");

  // B 데이터 유지
  const userBDoc = await admin.db.doc(`users/${userB.uid}`).get();
  assert.equal(userBDoc.exists, true, "B users doc remains");
  const bRoutes = await admin.db.collection("savedRoutes").where("userId", "==", userB.uid).get();
  assert.equal(bRoutes.size, 1, "B savedRoutes remains");

  // Auth A 없음 · B 유지
  await assertAuthMissing(admin.auth, userA.uid, "A");
  await assertAuthExists(admin.auth, userB.uid, "B");
  assert.equal((await admin.db.doc(`trails/${trailId}`).get()).exists, true, "trail doc remains");

  // (e) 두 번째 호출 — 계정 이미 삭제 → 401, B·익명화 데이터 손상 없음
  const second = await postDeleteAccount(userA.idToken, "탈퇴");
  log("second call", `${second.status} ${JSON.stringify(second.json)}`);
  assert.equal(second.status, 401, `second call expected 401, got ${second.status}`);
  const pubAgain = await admin.db.doc(`routePublications/${pubId}`).get();
  assert.equal(pubAgain.get("applicantUid"), "");
  assert.equal(pubAgain.get("publisherDeleted"), true);
  assert.equal((await admin.db.doc(`users/${userB.uid}`).get()).exists, true);
  await assertAuthExists(admin.auth, userB.uid, "B after second");

  return { userA, userB, nickKey, trailId, pubId };
}

async function runRejectionCases() {
  const stamp = Date.now();

  // (a) 토큰 없음 → 401
  const noToken = await postDeleteAccount(null, "탈퇴");
  log("reject no-token", `${noToken.status}`);
  assert.equal(noToken.status, 401);

  // (b) 확인 문구 틀림 → 400
  const user = await authSignUpEmail(`del_wrong_${stamp}@test.local`);
  const wrongPhrase = await postDeleteAccount(user.idToken, "탈퇴요");
  log("reject wrong-phrase", `${wrongPhrase.status} ${JSON.stringify(wrongPhrase.json)}`);
  assert.equal(wrongPhrase.status, 400);
  assert.match(String(wrongPhrase.json?.error?.status ?? ""), /INVALID_ARGUMENT/i);

  // (c) 익명(게스트) → failed-precondition
  const guest = await authSignUpAnonymous();
  const anon = await postDeleteAccount(guest.idToken, "탈퇴");
  log("reject anonymous", `${anon.status} ${JSON.stringify(anon.json)}`);
  assert.equal(anon.status, 400);
  assert.match(String(anon.json?.error?.status ?? ""), /FAILED_PRECONDITION/i);

  // (d) auth_time 오래된 토큰 — Auth 에뮬레이터에서 임의 auth_time 토큰 발급 불가
  log(
    "reject stale-auth_time",
    "SKIP — Auth emulator REST/signUp 이 발급하는 idToken 의 auth_time 은 항상 최근. 임의로 오래된 auth_time 을 넣을 API 가 없음",
  );

  // 정리: 잘못된 문구로 남은 계정은 성공 경로와 무관 — Auth 에 남겨도 에뮬레이터는 종료 시 소멸
  void user;
}

async function main() {
  log("hosts", `auth=${AUTH_HOST} fs=${FS_HOST} db=${DB_HOST} fn=${FN_HOST}`);
  log("url", DELETE_URL);

  const admin = initAdmin();
  await runHappyPath(admin);
  log("happy path", "PASS");
  await runRejectionCases();
  log("rejection cases", "PASS (d skipped)");
  log("ALL", "PASS");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("[account-deletion-e2e] FAIL", err);
    process.exit(1);
  });
