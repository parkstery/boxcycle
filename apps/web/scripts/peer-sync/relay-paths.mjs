/**
 * 동행(peer-sync) 산출물이 나가고 들어오는 자리 — **한 곳에서 정한다.**
 *
 * 왜 (2026-09-27) — 스펙과 요약 스크립트가 `document/ops/sync-relay/` 에 직접 썼다.
 * **한 번 돌리면 13만 줄이 바뀐다.** 돌리면 저장소가 더러워지니 아무도 안 돌리게 되고,
 * 그래서 동행 e2e 12개가 한 달 넘게 red 인 줄도 몰랐다 — 방치의 원인 중 하나다.
 *
 * 기본은 추적되지 않는 `apps/web/.out/sync-relay/`. 다만 이 산출물은 **보고서 증거로
 * 쓰인 이력**이 있어, 필요할 때만 켠다:
 *
 *   PEER_SYNC_EVIDENCE=1   → `document/ops/sync-relay/` (증거를 남길 때)
 *   (기본)                  → `apps/web/.out/sync-relay/`
 *
 * ⚠️ 읽기는 **`.out/` 을 먼저 보고, 없으면 커밋본으로 폴백한다.** 폴백할 때는 반드시
 * 그렇다고 말한다 — 조용히 낡은 데이터를 요약하면 숫자가 거짓말을 한다.
 * (`REPORT-S1-raw-logs.json` 처럼 애초에 커밋된 입력도 이 폴백으로 잡힌다.)
 *
 * 스펙 쪽 같은 규칙: `e2e/rideEntryHelpers.ts` 의 `PEER_SYNC_OUT_DIR`.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 커밋된 릴레이 폴더 — 증거 보관용 */
export const RELAY_COMMITTED_DIR = resolve(HERE, "../../../../document/ops/sync-relay");

/** 추적되지 않는 작업 폴더 (gitignore: `apps/web/.out/`) */
export const RELAY_SCRATCH_DIR = resolve(HERE, "../../.out/sync-relay");

export const EVIDENCE_MODE = process.env.PEER_SYNC_EVIDENCE === "1";

/** 쓰는 자리 */
export const RELAY_OUT_DIR = EVIDENCE_MODE ? RELAY_COMMITTED_DIR : RELAY_SCRATCH_DIR;

/**
 * 산출물 경로. **폴더가 없으면 만든다** — 쓰는 자리가 여기 하나뿐이므로 여기서 보장한다.
 * (안 만들면 첫 실행이 ENOENT 로 죽는다. 2026-09-27 에 실제로 그랬다.)
 */
export function relayOutput(name) {
  mkdirSync(RELAY_OUT_DIR, { recursive: true });
  return resolve(RELAY_OUT_DIR, name);
}

/**
 * 입력 경로 — 작업 폴더를 먼저 보고, 없으면 커밋본.
 * @param {string} name 파일 이름
 * @param {string} who 폴백을 알릴 때 쓸 호출자 이름
 */
export function relayInput(name, who = "peer-sync") {
  const fresh = resolve(RELAY_OUT_DIR, name);
  if (existsSync(fresh)) return fresh;
  const committed = resolve(RELAY_COMMITTED_DIR, name);
  if (existsSync(committed)) {
    if (!EVIDENCE_MODE) {
      console.warn(
        `[${who}] ${name} 이 .out/ 에 없어 **커밋된 과거 산출물**을 읽는다. ` +
          `최신이 필요하면 해당 e2e 를 먼저 돌려라.`,
      );
    }
    return committed;
  }
  // 없는 파일도 경로는 돌려준다 — 여는 쪽이 자기 말로 실패하게 둔다.
  return fresh;
}
