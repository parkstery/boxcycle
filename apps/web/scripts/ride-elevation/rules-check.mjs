// routeElevations 규칙 게이트 (`RIDE-ELEVATION-QUOTA-1` D2).
// 규칙 파일을 눈으로 읽는 것은 검증이 아니다 — 에뮬레이터에 실제로 써 보고 확인한다.
// 실행: npm run test:ride-elevation-rules  (firebase emulators:exec 가 감싼다)
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "boxcycle-dc2df";
const app = initializeApp({ projectId: PROJECT_ID, apiKey: "fake-api-key", appId: "1:1:web:1" });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  ✔" : "  ✘"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function expectAllowed(name, fn) {
  try {
    await fn();
    check(name, true);
  } catch (e) {
    check(name, false, `막혔다: ${e?.code ?? e}`);
  }
}

async function expectDenied(name, fn) {
  try {
    await fn();
    check(name, false, "통과했다 — 막혀야 한다");
  } catch (e) {
    const denied = String(e?.code ?? e).includes("permission-denied");
    check(name, denied, denied ? "" : `다른 오류: ${e?.code ?? e}`);
  }
}

const values = Array.from({ length: 72 }, (_, i) => 40 + i * 0.5);
const payload = () => ({ values, sampleCount: values.length, source: "open-meteo", createdAt: serverTimestamp() });
const KEY = `v1-72-${Date.now().toString(16).padStart(16, "0")}`;

// ── 비로그인 ────────────────────────────────────────────────────────────
await expectDenied("비로그인은 읽지 못한다", () => getDoc(doc(db, "routeElevations", KEY)));
await expectDenied("비로그인은 쓰지 못한다", () =>
  setDoc(doc(db, "routeElevations", `${KEY}-anon`), payload()),
);

// ── Guest(익명 인증 완료) ────────────────────────────────────────────────
await signInAnonymously(auth);

await expectAllowed("Guest 는 읽을 수 있다", () => getDoc(doc(db, "routeElevations", KEY)));
await expectAllowed("Guest 는 새 경로를 저장할 수 있다", () =>
  setDoc(doc(db, "routeElevations", KEY), payload()),
);
await expectDenied("이미 있는 경로는 덮어쓰지 못한다", () =>
  setDoc(doc(db, "routeElevations", KEY), payload()),
);
await expectDenied("표고 값이 2개 미만이면 거부한다", () =>
  setDoc(doc(db, "routeElevations", `${KEY}-short`), {
    values: [10],
    sampleCount: 1,
    source: "open-meteo",
    createdAt: serverTimestamp(),
  }),
);
await expectDenied("sampleCount 가 실제 길이와 다르면 거부한다", () =>
  setDoc(doc(db, "routeElevations", `${KEY}-mismatch`), {
    values,
    sampleCount: 999,
    source: "open-meteo",
    createdAt: serverTimestamp(),
  }),
);
await expectDenied("정해진 필드 밖의 값은 거부한다", () =>
  setDoc(doc(db, "routeElevations", `${KEY}-extra`), { ...payload(), injected: "x" }),
);

const failed = results.filter((r) => !r.passed);
console.log(`\nrouteElevations 규칙: ${results.length - failed.length}/${results.length} 통과`);
if (failed.length > 0) process.exit(1);
process.exit(0);
