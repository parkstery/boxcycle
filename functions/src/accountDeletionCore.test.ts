/**
 * 계정 탈퇴 계약 — 「탈퇴 누락」 방지 게이트 + 순수 판정.
 * 실행: `npm test` (functions). `node --test lib/accountDeletionCore.test.js`
 *
 * firestore.rules 의 최상위 `match /<collection>/{...}` 를 전부 읽어, 각 컬렉션이
 * ACCOUNT_DELETION_POLICY 에 분류돼 있는지 본다. 새 컬렉션을 만들고 탈퇴 분류를 빠뜨리면 실패한다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ACCOUNT_DELETION_POLICY,
  isDeletionConfirmPhrase,
  isRecentSignIn,
} from "./accountDeletionCore.js";

function topLevelCollectionsFromRules(rules: string): string[] {
  // `match /databases/{database}/documents {` 바로 안쪽(들여쓰기 4칸) 의 match 만 최상위다.
  const names = new Set<string>();
  for (const m of rules.matchAll(/^ {4}match \/([A-Za-z_][A-Za-z0-9_]*)\//gm)) {
    names.add(m[1]);
  }
  return [...names].sort();
}

test("firestore.rules 의 모든 최상위 컬렉션이 탈퇴 정책에 분류돼 있다", () => {
  const rulesPath = path.resolve(process.cwd(), "..", "firestore.rules");
  const rules = readFileSync(rulesPath, "utf8");
  const collections = topLevelCollectionsFromRules(rules);
  assert.ok(collections.length >= 15, `규칙 파싱 실패 의심: ${collections.join(",")}`);
  const missing = collections.filter((c) => !(c in ACCOUNT_DELETION_POLICY));
  assert.deepEqual(
    missing,
    [],
    `탈퇴 정책(ACCOUNT_DELETION_POLICY)에 분류되지 않은 컬렉션: ${missing.join(", ")} — accountDeletionCore.ts 에 delete/anonymize/none 을 넣어라`,
  );
});

test("사용자 개인 데이터 컬렉션은 삭제, 퍼블릭 경로는 익명화(Chief 결정)", () => {
  for (const c of ["users", "nicknames", "rides", "savedRoutes", "conquest", "routeTokenLedger", "livePresence", "publicRouteRequests"]) {
    assert.equal(ACCOUNT_DELETION_POLICY[c], "delete", c);
  }
  assert.equal(ACCOUNT_DELETION_POLICY.routePublications, "anonymize");
});

test("최근 로그인 판정 — 5분 이내만", () => {
  const now = 1_800_000_000_000;
  const nowSec = now / 1000;
  assert.equal(isRecentSignIn(nowSec - 60, now), true);
  assert.equal(isRecentSignIn(nowSec - 299, now), true);
  assert.equal(isRecentSignIn(nowSec - 301, now), false);
  assert.equal(isRecentSignIn(undefined, now), false);
  assert.equal(isRecentSignIn(Number.NaN, now), false);
});

test("확인 문구 — 「탈퇴」 만 통과(앞뒤 공백 허용)", () => {
  assert.equal(isDeletionConfirmPhrase("탈퇴"), true);
  assert.equal(isDeletionConfirmPhrase(" 탈퇴 "), true);
  assert.equal(isDeletionConfirmPhrase("탈 퇴"), false);
  assert.equal(isDeletionConfirmPhrase(""), false);
  assert.equal(isDeletionConfirmPhrase(undefined), false);
});
