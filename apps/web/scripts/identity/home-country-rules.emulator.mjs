/**
 * users/{uid}.homeCountry 보안 규칙 시험 — Auth·Firestore 에뮬레이터, REST 직접 호출.
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §4.2 · 시안 document/ops/20261104-country-input-mockup
 *
 * 지키는 것: 정식 계정만, ISO 대문자 2글자, 변경 시각 = 요청 시각, 다시 바꾸기는 30일 뒤, 시각만 고치기 금지.
 *
 * 실행 (apps/web): npm run test:home-country:rules
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

const a = await googleLike("a");
await seed(a.uid, { isAnonymous: false, displayName: "rider-a" });
check("H1 처음 정하기 허용", await setCountry(a, "KR"), 200);
check("H2 30일 안에 바꾸기 거절", await setCountry(a, "JP"), 403);
check("H3 국가 그대로 다른 필드 수정 허용", await update(a, { displayName: "rider-a2" }), 200);

const b = await googleLike("b");
await seed(b.uid, { isAnonymous: false, homeCountry: "KR", homeCountryChangedAt: new Date(Date.now() - 31 * DAY_MS) });
check("H4 시각만 고치기 거절", await update(b, {}, ["homeCountryChangedAt"]), 403);
check("H5 30일 지나 바꾸기 허용", await setCountry(b, "JP"), 200);

const c = await googleLike("c");
await seed(c.uid, { isAnonymous: false });
check("H6 소문자 거절", await setCountry(c, "kr"), 403);
check("H7 세 글자 거절", await setCountry(c, "KOR"), 403);
check("H8 변경 시각을 직접 넣기 거절", await setCountry(c, "KR", { stamp: false, at: new Date(Date.now() - 40 * DAY_MS) }), 403);

const g = await guest();
await seed(g.uid, { isAnonymous: true });
check("H9 게스트 거절", await setCountry(g, "KR"), 403);

const d = await googleLike("d");
check(
  "H10 국가와 함께 문서 만들기 허용",
  await commit(d.token, {
    update: { name: `${DB}/users/${d.uid}`, fields: fieldsOf({ isAnonymous: false, homeCountry: "KR" }) },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: "homeCountryChangedAt", setToServerValue: "REQUEST_TIME" }],
  }),
  200,
);
const e = await googleLike("e");
check(
  "H11 만들 때 옛 시각 넣기 거절",
  await commit(e.token, {
    update: {
      name: `${DB}/users/${e.uid}`,
      fields: fieldsOf({ isAnonymous: false, homeCountry: "KR", homeCountryChangedAt: new Date(Date.now() - 40 * DAY_MS) }),
    },
    currentDocument: { exists: false },
  }),
  403,
);

for (const x of cases) console.log(`${x.ok ? "PASS" : "FAIL"} ${x.name} (got ${x.actual}, want ${x.expected})`);
const failed = cases.filter((x) => !x.ok);
console.log(`home country rules: ${cases.length - failed.length}/${cases.length} pass`);
if (failed.length) process.exit(1);
