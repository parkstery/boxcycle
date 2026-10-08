/**
 * 이름 없는 라이더가 달리지 않는다 (2026-10-09 Chief).
 * - 게스트→Google 연결 직후 닉네임 확인을 다시 돈다(B)
 * - 주행 시작 직전 마지막 확인(C)
 * - 로그인 때 Auth displayName 을 저장된 닉네임으로 맞춘다(C 가 예전 계정을 잘못 막지 않게)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { memberNeedsNickname } from "../../src/lib/identity/riderName.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const AUTH = read("../../src/hooks/useAppAuth.ts");
const APP = read("../../src/App.tsx");

test("닉네임이 필요한 사람: 닉네임 규칙을 통과한 이름이 없는 회원만", () => {
  assert.equal(memberNeedsNickname({ isAnonymous: false, displayName: null }), true);
  assert.equal(memberNeedsNickname({ isAnonymous: false, displayName: "ster pin" }), true);
  assert.equal(memberNeedsNickname({ isAnonymous: false, displayName: "a@b.com" }), true);
  assert.equal(memberNeedsNickname({ isAnonymous: false, displayName: "RidingMan" }), false);
  assert.equal(memberNeedsNickname({ isAnonymous: true, displayName: null }), false);
});

test("B: Google 연결 성공 → 닉네임 확인 effect 를 다시 돈다", () => {
  const linkAt = AUTH.indexOf("await linkWithPopup(current, provider);");
  assert.ok(linkAt >= 0, "linkWithPopup 호출을 찾지 못함");
  const afterLink = AUTH.slice(linkAt, linkAt + 200);
  assert.match(afterLink, /setAuthLinkRev\(/, "연결 직후 신호를 올리지 않는다");
  const effectAt = AUTH.indexOf("const stored = await getUserProfileNickname(user.uid);");
  assert.ok(effectAt >= 0, "닉네임 확인 effect 를 찾지 못함");
  const depsAt = AUTH.indexOf("}, [", effectAt);
  const deps = AUTH.slice(depsAt, AUTH.indexOf("]", depsAt) + 1);
  assert.match(deps, /authLinkRev/, `닉네임 확인 effect 의존 배열 ${deps}`);
});

test("C: 주행 시작은 닉네임 확인부터", () => {
  const fnAt = APP.indexOf("function handleStartRide(");
  assert.ok(fnAt >= 0, "handleStartRide 를 찾지 못함");
  const head = APP.slice(fnAt, APP.indexOf("rideInputReady", fnAt));
  assert.match(head, /if \(memberNeedsNickname\(user\)\) \{\s*requestNicknameEntry\(\);\s*return;/);
});

test("로그인 때 Auth 이름을 저장된 닉네임으로 맞춘다", () => {
  const at = AUTH.indexOf("await claimNicknameTransaction(user, stored);");
  assert.ok(at >= 0);
  const okAt = AUTH.indexOf('setFsSync({ state: "ok" })', at);
  assert.match(AUTH.slice(at, okAt), /updateProfile\(user, \{ displayName: stored \}\)/);
});
