/**
 * trails/{id}.motionInstance 보안 규칙 시험 — Auth·Firestore 에뮬레이터, REST 직접 호출.
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §5.1 P1
 *
 * 지키는 것: 이름표는 허용 목록의 이름만(주소 금지), 만든 뒤 바꿀 수 없음, 필드 없는 옛 Trail·옛 앱 호환.
 *
 * 실행 (C:\20.HDev\boxcycle\apps\web): npm run test:trail-motion:rules
 */
import assert from "node:assert/strict";
import { hostFor } from "../../../../scripts/emulatorPorts.mjs";

const PROJECT_ID = "boxcycle-dc2df";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? hostFor("auth");
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? hostFor("firestore");
for (const [label, host] of [["auth", AUTH_HOST], ["firestore", FS_HOST]]) {
  if (!host || !/^(127\.0\.0\.1|localhost):/.test(host)) {
    throw new Error(`${label} emulator host missing/non-local (${host || "unset"}) — refuse live Firebase.`);
  }
}
const DB = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `http://${FS_HOST}/v1/${DB}`;

async function anonymousUser() {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  return { uid: json.localId, token: json.idToken };
}

function fieldsOf(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = { nullValue: null };
    else if (Number.isInteger(v)) out[k] = { integerValue: String(v) };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else throw new Error(`unsupported ${k}`);
  }
  return out;
}

/** create: 새 문서(존재하면 실패). 클라이언트 createTrailInstance 의 setDoc 과 같은 모양. */
async function createTrail(user, id, extra) {
  const data = { hostUid: user.uid, displayNumber: 35, status: "open", visibility: "private", ...extra };
  return commit(user, {
    update: { name: `${DB}/trails/${id}`, fields: fieldsOf(data) },
    currentDocument: { exists: false },
    updateTransforms: [
      { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
      { fieldPath: "lastActivityAt", setToServerValue: "REQUEST_TIME" },
    ],
  });
}

/** update: 지정 필드만(updateDoc 과 같은 병합). */
async function updateTrail(user, id, data, { touchActivity = true } = {}) {
  return commit(user, {
    update: { name: `${DB}/trails/${id}`, fields: fieldsOf(data) },
    updateMask: { fieldPaths: Object.keys(data) },
    currentDocument: { exists: true },
    ...(touchActivity ? { updateTransforms: [{ fieldPath: "lastActivityAt", setToServerValue: "REQUEST_TIME" }] } : {}),
  });
}

async function commit(user, write) {
  const res = await fetch(`${BASE}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
    body: JSON.stringify({ writes: [write] }),
  });
  return res.status;
}

const cases = [];
const check = (name, actual, expected) => cases.push({ name, ok: actual === expected, actual, expected });
const host = await anonymousUser();
const tag = Date.now().toString(36);

check("M1 이름표 default 로 생성 허용", await createTrail(host, `m1-${tag}`, { motionInstance: "default" }), 200);
check("M2 이름표 없이 생성 허용(옛 앱)", await createTrail(host, `m2-${tag}`, {}), 200);
check(
  "M3 주소를 이름표로 생성 거절",
  await createTrail(host, `m3-${tag}`, { motionInstance: "https://evil-default-rtdb.firebaseio.com" }),
  403,
);
check("M4 목록에 없는 이름 생성 거절", await createTrail(host, `m4-${tag}`, { motionInstance: "eu" }), 403);
check("M5 다른 필드 수정 허용(이름표 유지)", await updateTrail(host, `m1-${tag}`, { status: "closed" }), 200);
check("M6 이름표 바꾸기 거절", await updateTrail(host, `m1-${tag}`, { motionInstance: "eu" }), 403);
check("M7 옛 Trail 에 이름표 덧붙이기 거절(만든 뒤 변경 금지)", await updateTrail(host, `m2-${tag}`, { motionInstance: "default" }), 403);
check("M8 옛 Trail 다른 필드 수정 허용", await updateTrail(host, `m2-${tag}`, { status: "closed" }), 200);

for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} (got ${c.actual}, want ${c.expected})`);
const failed = cases.filter((c) => !c.ok);
console.log(`trail motionInstance rules: ${cases.length - failed.length}/${cases.length} pass`);
if (failed.length) process.exit(1);
