/**
 * conquest/{uid}/regions/{scopeCode} 보안 규칙 시험 — Auth·Firestore 에뮬레이터, REST 직접 호출.
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §4.4 (G5)
 *
 * 지키는 것: 본인만 읽기, 쓰기는 누구도 불가(Functions 전용), 다른 사람은 읽기 불가.
 *
 * 실행 (apps/web): npm run test:conquest-regions:rules
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
const DAY_MS = 86_400_000;

async function signUp(body) {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  return { uid: json.localId, token: json.idToken };
}
const tag = Date.now().toString(36);
const googleLike = (n) => signUp({ email: `hc-${n}-${tag}@example.com`, password: "secret123" });
const guest = () => signUp({});

function fieldsOf(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = { nullValue: null };
    else if (typeof v === "boolean") out[k] = { booleanValue: v };
    else if (typeof v === "string") out[k] = { stringValue: v };
    else if (v instanceof Date) out[k] = { timestampValue: v.toISOString() };
    else throw new Error(`unsupported ${k}`);
  }
  return out;
}

async function commit(token, write) {
  const res = await fetch(`${BASE}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ writes: [write] }),
  });
  return res.status;
}

/** 규칙을 건너뛰는 준비 쓰기(에뮬레이터 owner) */
async function seed(uid, data) {
  const status = await commit("owner", { update: { name: `${DB}/users/${uid}`, fields: fieldsOf(data) } });
  assert.equal(status, 200, `seed ${uid}`);
}

/** 앱의 saveHomeCountry 와 같은 병합 쓰기. stamp=false 면 시각을 직접 넣는다(조작 시도) */
async function setCountry(user, code, { stamp = true, at, exists = true } = {}) {
  const data = { homeCountry: code, ...(stamp ? {} : { homeCountryChangedAt: at }) };
  return commit(user.token, {
    update: { name: `${DB}/users/${user.uid}`, fields: fieldsOf(data) },
    updateMask: { fieldPaths: [...Object.keys(data), ...(stamp ? ["homeCountryChangedAt"] : [])] },
    ...(exists ? { currentDocument: { exists: true } } : {}),
    ...(stamp ? { updateTransforms: [{ fieldPath: "homeCountryChangedAt", setToServerValue: "REQUEST_TIME" }] } : {}),
  });
}

async function update(user, data, transformsAt = []) {
  return commit(user.token, {
    update: { name: `${DB}/users/${user.uid}`, fields: fieldsOf(data) },
    updateMask: { fieldPaths: [...Object.keys(data), ...transformsAt] },
    currentDocument: { exists: true },
    ...(transformsAt.length
      ? { updateTransforms: transformsAt.map((f) => ({ fieldPath: f, setToServerValue: "REQUEST_TIME" })) }
      : {}),
  });
}

const cases = [];
const check = (name, actual, expected) => cases.push({ name, ok: actual === expected, actual, expected });

async function read(token, path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.status;
}
async function writeDoc(token, path) {
  return commit(token, { update: { name: `${DB}/${path}`, fields: { meters: { integerValue: "999" } } } });
}

const a = await googleLike("ra");
const b = await googleLike("rb");
const doc = (u, code) => `conquest/${u.uid}/regions/${code}`;
for (const code of ["KR", "KR-11"]) {
  assert.equal(await commit("owner", { update: { name: `${DB}/${doc(a, code)}`, fields: { meters: { integerValue: "100" } } } }), 200);
}
check("R1 본인 국가 문서 읽기 허용", await read(a.token, doc(a, "KR")), 200);
check("R2 본인 행정구역 문서 읽기 허용", await read(a.token, doc(a, "KR-11")), 200);
check("R3 남의 문서 읽기 거절", await read(b.token, doc(a, "KR")), 403);
check("R4 본인이 쓰기 거절(Functions 전용)", await writeDoc(a.token, doc(a, "KR")), 403);
check("R5 새 문서 만들기 거절", await writeDoc(a.token, doc(a, "JP")), 403);
check("R6 남의 폴더에 쓰기 거절", await writeDoc(b.token, doc(a, "KR")), 403);

// rideRegions(지역별 주행 누적) — regions 와 같은 꼴
const rideDoc = (u, code) => `conquest/${u.uid}/rideRegions/${code}`;
assert.equal(await commit("owner", { update: { name: `${DB}/${rideDoc(a, "KR")}`, fields: { meters: { integerValue: "100" } } } }), 200);
check("R7 본인 rideRegions 읽기 허용", await read(a.token, rideDoc(a, "KR")), 200);
check("R8 남의 rideRegions 읽기 거절", await read(b.token, rideDoc(a, "KR")), 403);
check("R9 본인 rideRegions 쓰기 거절(Functions 전용)", await writeDoc(a.token, rideDoc(a, "KR")), 403);

for (const x of cases) console.log(`${x.ok ? "PASS" : "FAIL"} ${x.name} (got ${x.actual}, want ${x.expected})`);
const failed = cases.filter((x) => !x.ok);
console.log(`conquest regions rules: ${cases.length - failed.length}/${cases.length} pass`);
if (failed.length) process.exit(1);
