/**
 * 라이더 이름 규칙 (2026-10-09 Chief) — riderName 한 곳.
 * 같은 사람은 계정 시트·지도 이름표·접속 목록·관전 점에서 같은 이름이고,
 * 어떤 경우에도 이메일·실명이 이름으로 나가지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  presenceRiderDisplayName,
  riderDisplayName,
  selfRiderDisplayName,
} from "../../src/lib/identity/riderName.ts";
import { mapNametagForMember } from "../../src/lib/identity/guestNametag.ts";

const GUEST_UID = "tHQb0YxxGuestUid";
const MEMBER_UID = "TugL0ZOpMiYImember";

test("게스트 → 게스트-uid앞4자", () => {
  assert.equal(riderDisplayName({ uid: GUEST_UID, isGuest: true }), "게스트-tHQb");
  // 게스트에게 닉네임 후보가 있어도 게스트 규칙
  assert.equal(riderDisplayName({ uid: GUEST_UID, isGuest: true, nickname: "RidingMan" }), "게스트-tHQb");
});

test("회원 → 닉네임, 닉네임이 아니면 라이더-uid앞4자 (이메일·실명 금지)", () => {
  assert.equal(riderDisplayName({ uid: MEMBER_UID, isGuest: false, nickname: "RidingMan" }), "RidingMan");
  for (const bad of ["idengoodeg@gmail.com", "ster pin", "With Win", "", "   ", null, undefined, "ab"]) {
    assert.equal(
      riderDisplayName({ uid: MEMBER_UID, isGuest: false, nickname: bad }),
      "라이더-TugL",
      `후보 ${JSON.stringify(bad)}`,
    );
  }
});

test("내가 presence 에 싣는 이름을 남이 읽으면 내가 보는 이름과 같다", () => {
  for (const user of [
    { uid: GUEST_UID, isAnonymous: true, displayName: null },
    { uid: MEMBER_UID, isAnonymous: false, displayName: "RidingMan" },
    { uid: MEMBER_UID, isAnonymous: false, displayName: "ster pin" },
  ]) {
    const mine = selfRiderDisplayName(user);
    const written = mine; // getPresenceDisplayName(user) === selfRiderDisplayName(user)
    const memberType = user.isAnonymous ? "guest" : "user";
    assert.equal(mapNametagForMember(user.uid, memberType, written), mine);
    // memberType 이 없는 행(live 행만 있음)으로 읽어도 같다
    assert.equal(presenceRiderDisplayName(user.uid, null, written), mine);
  }
});

test("옛 클라이언트가 써 둔 값도 읽을 때 걸러진다", () => {
  assert.equal(presenceRiderDisplayName(GUEST_UID, null, "guest-tHQb0Y"), "게스트-tHQb");
  assert.equal(presenceRiderDisplayName(GUEST_UID, null, "guest1"), "게스트-tHQb");
  assert.equal(presenceRiderDisplayName(MEMBER_UID, null, "idengoodeg@gmail.com"), "라이더-TugL");
  assert.equal(presenceRiderDisplayName(MEMBER_UID, "user", "idengoodeg@gmail.com"), "라이더-TugL");
});

test("게스트 이름은 다른 게스트의 접속과 무관하다(순번 guest1·guest2 폐지)", () => {
  assert.equal(mapNametagForMember.length, 3, "접속 목록 인자를 다시 받으면 순번 이름이 되살아난다");
  const src = readFileSync(fileURLToPath(new URL("../../src/lib/identity/guestNametag.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /`guest\$\{/);
});

/**
 * `.email` 을 읽는 곳은 본인에게만 보이는 자리로 한정한다. 새 파일이 이메일을 읽기 시작하면 여기서 멈추고,
 * 그것이 남에게 보이는 이름이 아닌지 사람이 확인한 뒤 목록에 넣는다.
 */
test("이메일을 읽는 파일은 허용 목록뿐", () => {
  const ALLOWED = new Set([
    "components/UserInfoSheet.tsx", // 본인 계정 시트 둘째 줄
    "lib/account/accountDeletion.ts", // 본인에게 보이는 탈퇴 오류 문구
    "lib/account/repo/accountDeletionApi.ts", // Google 재인증 login_hint
  ]);
  const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
    });
  const offenders = walk(srcRoot)
    .filter((f) => /\.email\b/.test(readFileSync(f, "utf8")))
    .map((f) => relative(srcRoot, f).split(sep).join("/"))
    .filter((rel) => !ALLOWED.has(rel));
  assert.deepEqual(offenders, []);
});

/** users/{uid} 는 로그인한 누구나 읽는다 — 그 문서를 쓰는 파일은 이메일을 읽지도 않는다(2026-10-09 Chief) */
test("공개 프로필(users) 쓰기 파일은 이메일을 다루지 않는다", () => {
  const src = readFileSync(fileURLToPath(new URL("../../src/lib/identity/repo/firestoreUser.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(src, /\.email\b|\bemail\s*:/);
});

/** Google 사진 주소도 같은 이유로 공개 문서(users·동행 members)에 쓰지 않는다(2026-10-09 Chief) */
test("앱 코드는 photoURL 을 공개 문서에 쓰지 않는다", () => {
  const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
    });
  const writers = walk(srcRoot)
    .filter((f) => /\bphotoURL\s*:/.test(readFileSync(f, "utf8")))
    .map((f) => relative(srcRoot, f).split(sep).join("/"));
  assert.deepEqual(writers, []);
});
