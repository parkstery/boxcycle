/**
 * S3 픽스처 게이트 산출물의 자리 — **추적되지 않는 `.out/`**.
 *
 * 2026-09-26: 게이트가 `document/ops/sync-relay/S3-fixture-gate.json` 에 직접 썼다.
 * 매 실행마다 `generatedAt` 이 바뀌어 **돌리기만 해도 `git status` 가 더러워진다**
 * — 감사 P2 와 같은 계열이고, e2e 두 스펙이 `.out/` 으로 옮겨 간 것과 같은 처방이다.
 * 코드만 읽으면 경로 상수는 그냥 상수로 보인다는 것이 이 결함의 성질이다.
 *
 * 읽는 쪽은 `.out/` 을 먼저 보고, 없으면 **커밋된 과거 산출물**로 폴백한다.
 * 폴백을 쓸 때는 반드시 그렇다고 말한다 — 조용히 낡은 숫자를 읽으면 안 된다.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY_DIR = resolve(HERE, "../../../../document/ops/sync-relay");

/** 게이트가 쓰는 자리 (gitignore: `document/ops/**\/.out/`) */
export const FIXTURE_GATE_OUT = resolve(RELAY_DIR, ".out/S3-fixture-gate.json");

/** 2026-09-26 이전 실행이 남긴 커밋 사본 — 읽기 전용 폴백 */
export const FIXTURE_GATE_LEGACY = resolve(RELAY_DIR, "S3-fixture-gate.json");

/**
 * 읽을 픽스처 게이트 산출물을 고른다.
 * @param {string} who 폴백을 알릴 때 쓸 호출자 이름
 */
export function resolveFixtureGateInput(who) {
  if (existsSync(FIXTURE_GATE_OUT)) return FIXTURE_GATE_OUT;
  if (existsSync(FIXTURE_GATE_LEGACY)) {
    console.warn(
      `[${who}] .out/S3-fixture-gate.json 이 없어 커밋된 과거 산출물을 읽는다. ` +
        `최신 수치가 필요하면 먼저: node scripts/peer-sync/s3-fixture-gate.mjs`,
    );
    return FIXTURE_GATE_LEGACY;
  }
  throw new Error(
    "S3-fixture-gate.json 이 없다 — 먼저 node scripts/peer-sync/s3-fixture-gate.mjs 를 돌려라",
  );
}
