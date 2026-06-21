import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "",
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

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;

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
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!isFirebaseDatabaseConfigured()) {
    throw new Error("Firebase Realtime Database URL 이 설정되지 않았습니다.");
  }
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }
  return database;
}
