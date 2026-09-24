/**
 * 에뮬레이터 포트의 단일 진실 — `firebase.json` 을 읽는다.
 *
 * 왜 — 2026-09-24 구조 감사 H5. 같은 포트(9099/8080/9000/5001)가 firebase.json ·
 * firebase.harness.json · .env.emulator · .env.harness · playwright.config.ts ·
 * vite.config.ts 에 각각 손으로 적혀 있었다. 한쪽만 고치면 **아무 에러 없이** 다른
 * 쪽이 엉뚱한 포트를 본다.
 *
 * 브라우저 번들은 이 모듈을 쓸 수 없다(파일시스템을 읽으므로) — 거기는 env 로 주입한다.
 * Node 로 도는 하네스·검증 스크립트가 이곳을 쓴다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEmulators() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
  const em = cfg?.emulators;
  if (!em || typeof em !== "object") {
    throw new Error("firebase.json 에 emulators 설정이 없다");
  }
  return em;
}

function portOf(em, name) {
  const p = em?.[name]?.port;
  if (typeof p !== "number" || !Number.isFinite(p) || p <= 0) {
    throw new Error(`firebase.json 의 emulators.${name}.port 를 읽지 못했다: ${JSON.stringify(p)}`);
  }
  return p;
}

const EM = readEmulators();

export const EMULATOR_PORTS = Object.freeze({
  auth: portOf(EM, "auth"),
  firestore: portOf(EM, "firestore"),
  database: portOf(EM, "database"),
  functions: portOf(EM, "functions"),
});

/** 하네스 UI smoke 가 띄우는 Vite 개발 서버 — firebase.json 밖이라 여기 둔다. */
export const HARNESS_DEV_PORT = 5010;

/** 하네스가 잔류 여부를 확인해야 하는 포트 전량. */
export const HARNESS_PORTS = Object.freeze([
  EMULATOR_PORTS.functions,
  HARNESS_DEV_PORT,
  EMULATOR_PORTS.firestore,
  EMULATOR_PORTS.auth,
]);

export const LOOPBACK = "127.0.0.1";

export const hostFor = (name) => `${LOOPBACK}:${EMULATOR_PORTS[name]}`;
