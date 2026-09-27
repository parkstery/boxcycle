import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim().replace(/\/$/, "") ?? "",
  };
}

/** P1 — RTDB peer motion. env 미설정 시 `{projectId}-default-rtdb` URL 사용 */
export function resolveFirebaseDatabaseURL(): string | null {
  const c = readConfig();
  const explicit = c.databaseURL.trim();
  if (explicit) return explicit;
  if (c.projectId.trim()) {
    return `https://${c.projectId.trim()}-default-rtdb.firebaseio.com`;
  }
  return null;
}

export function isFirebaseDatabaseConfigured(): boolean {
  return resolveFirebaseDatabaseURL() != null;
}

export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

/**
 * 로컬 에뮬레이터 사용 여부. `VITE_USE_EMULATOR=1` 일 때만 켠다(dev·e2e 전용).
 * 프로덕션 빌드엔 이 플래그가 없으므로 실 Firebase 로 붙는다.
 * 포트는 firebase.json emulators 블록과 일치시킨다.
 */
function shouldUseEmulator(): boolean {
  return import.meta.env.VITE_USE_EMULATOR === "1";
}

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORTS = { auth: 9099, firestore: 8080, database: 9000 } as const;

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let firestore: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase 설정이 없습니다. apps/web/.env.example 을 참고해 .env 를 만드세요.",
    );
  }
  if (!app) {
    const c = readConfig();
    const databaseURL = resolveFirebaseDatabaseURL();
    app = initializeApp({
      apiKey: c.apiKey,
      authDomain: c.authDomain,
      projectId: c.projectId,
      storageBucket: c.storageBucket,
      messagingSenderId: c.messagingSenderId,
      appId: c.appId,
      ...(databaseURL ? { databaseURL } : {}),
    });
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (shouldUseEmulator()) {
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
        disableWarnings: true,
      });
    }
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!isFirebaseDatabaseConfigured()) {
    throw new Error("Firebase Realtime Database URL 이 설정되지 않았습니다.");
  }
  if (!database) {
    database = getDatabase(getFirebaseApp());
    if (shouldUseEmulator()) {
      connectDatabaseEmulator(database, EMULATOR_HOST, EMULATOR_PORTS.database);
    }
  }
  return database;
}

/**
 * Firestore 싱글턴. 전까지 각 `firestore*.ts` 가 `getFirestore(getFirebaseApp())` 를
 * 직접 호출했으나, 에뮬레이터 배선(`connectFirestoreEmulator` 는 인스턴스당 1회만 허용)을
 * 한 곳에 모으기 위해 이 getter 로 통합한다. 신규 코드는 반드시 이 함수를 쓴다.
 */
export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
    if (shouldUseEmulator()) {
      connectFirestoreEmulator(firestore, EMULATOR_HOST, EMULATOR_PORTS.firestore);
    }
  }
  return firestore;
}
