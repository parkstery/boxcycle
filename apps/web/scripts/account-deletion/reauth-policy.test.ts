/**
 * 탈퇴 재인증 정책 (2026-10-09 Chief): 이미 로그인한 계정을 탈퇴하므로 「어느 계정?」 을 묻지 않는다.
 * - 방금(4분 이내) 로그인했으면 Google 창을 띄우지 않는다.
 * - 띄울 때도 계정 선택 화면(select_account) 없이 이 계정(login_hint)으로 확인만 한다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  REAUTH_SKIP_MAX_AGE_MS,
  needsReauthForDeletion,
} from "../../src/lib/account/accountDeletion.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const API_SOURCE = read("../../src/lib/account/repo/accountDeletionApi.ts");
const SERVER_CORE = read("../../../../functions/src/accountDeletionCore.ts");

const NOW = Date.parse("2026-10-09T03:00:00Z");

test("방금 로그인 → 재인증 창 없음", () => {
  assert.equal(needsReauthForDeletion(NOW - 30_000, NOW), false);
  assert.equal(needsReauthForDeletion(NOW - REAUTH_SKIP_MAX_AGE_MS, NOW), false);
});

test("오래전 로그인·시각 모름·미래 시각 → 재인증", () => {
  assert.equal(needsReauthForDeletion(NOW - REAUTH_SKIP_MAX_AGE_MS - 1, NOW), true);
  assert.equal(needsReauthForDeletion(NOW - 3 * 3600_000, NOW), true);
  assert.equal(needsReauthForDeletion(null, NOW), true);
  assert.equal(needsReauthForDeletion(Number.NaN, NOW), true);
  assert.equal(needsReauthForDeletion(NOW + 120_000, NOW), true);
});

test("건너뛰는 창은 서버 허용 창보다 짧다 — 길면 서버가 requires-recent-login 으로 거절한다", () => {
  const m = SERVER_CORE.match(/ACCOUNT_DELETION_MAX_AUTH_AGE_SEC\s*=\s*([\d_*\s]+);/);
  assert.ok(m, "서버 상수 ACCOUNT_DELETION_MAX_AUTH_AGE_SEC 를 찾지 못함");
  const serverSec = Function(`return (${m[1].replace(/_/g, "")})`)() as number;
  assert.ok(REAUTH_SKIP_MAX_AGE_MS < serverSec * 1000, `${REAUTH_SKIP_MAX_AGE_MS}ms ≥ 서버 ${serverSec}s`);
});

test("재인증 팝업은 계정 선택을 띄우지 않고 이 계정을 지정한다", () => {
  const fnAt = API_SOURCE.indexOf("export async function reauthenticateWithGoogle");
  assert.ok(fnAt >= 0, "reauthenticateWithGoogle 를 찾지 못함");
  const body = API_SOURCE.slice(fnAt, API_SOURCE.indexOf("\n}\n", fnAt));
  assert.doesNotMatch(body, /select_account/);
  assert.match(body, /login_hint:\s*user\.email/);
});
