/**
 * userPrivate/{uid} 보안 규칙 시험 — Auth·Firestore 에뮬레이터, REST 로 직접 호출.
 * 본인만 읽고 쓰는지, 값 범위·필드 제한이 지켜지는지 본다.
 *
 * 실행: npm run test:calorie-profile:rules
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

const DOCS = `http://${FS_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function anonymousUser() {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) },
  );
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  return { uid: json.localId, token: json.idToken };
}

function fieldsOf(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = { nullValue: null };
    else if (typeof v === "number") out[k] = { doubleValue: v };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else if (v instanceof Date) out[k] = { timestampValue: v.toISOString() };
    else throw new Error(`unsupported ${k}`);
  }
  return out;
}

/** serverTimestamp 와 같은 REQUEST_TIME 변환을 기본으로 붙인다 */
async function write(user, uid, data, { serverTime = true } = {}) {
  const body = {
    writes: [
      {
        update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/userPrivate/${uid}`, fields: fieldsOf(data) },
        ...(serverTime ? { updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] } : {}),
      },
    ],
  };
  const res = await fetch(`${DOCS}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function read(user, uid) {
  const res = await fetch(`${DOCS}/userPrivate/${uid}`, {
    headers: user ? { Authorization: `Bearer ${user.token}` } : {},
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const cases = [];
function check(name, actual, expected) {
  cases.push({ name, ok: actual === expected, actual, expected });
}

const a = await anonymousUser();
const b = await anonymousUser();

check("R1 본인 쓰기 허용", await write(a, a.uid, { weightKg: 70, intensityId: "moderate" }), 200);
const own = await read(a, a.uid);
check("R2 본인 읽기 허용", own.status, 200);
check("R2 값 보존", own.json?.fields?.weightKg?.doubleValue, 70);
check("R3 남의 문서 읽기 거절", (await read(b, a.uid)).status, 403);
check("R4 남의 문서 쓰기 거절", await write(b, a.uid, { weightKg: 50, intensityId: "light" }), 403);
check("R5 로그인 없이 읽기 거절", (await read(null, a.uid)).status, 403);
check("R6 체중 범위 밖(500) 거절", await write(a, a.uid, { weightKg: 500, intensityId: "light" }), 403);
check("R6 체중 범위 밖(10) 거절", await write(a, a.uid, { weightKg: 10, intensityId: "light" }), 403);
check("R7 모르는 강도 거절", await write(a, a.uid, { weightKg: 70, intensityId: "extreme" }), 403);
check("R8 다른 필드 끼워 넣기 거절", await write(a, a.uid, { weightKg: 70, intensityId: "light", nickname: "x" }), 403);
check(
  "R9 updatedAt 임의 시각 거절",
  await write(a, a.uid, { weightKg: 70, intensityId: "light", updatedAt: new Date("2020-01-01") }, { serverTime: false }),
  403,
);
check("R10 비우기(null) 허용", await write(a, a.uid, { weightKg: null, intensityId: null }), 200);
check("R11 소수 체중 허용", await write(a, a.uid, { weightKg: 62.5, intensityId: "hard" }), 200);

for (const c of cases) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} (got ${c.actual}, want ${c.expected})`);
const failed = cases.filter((c) => !c.ok);
console.log(`calorie-profile rules: ${cases.length - failed.length}/${cases.length} pass`);
if (failed.length) process.exit(1);
