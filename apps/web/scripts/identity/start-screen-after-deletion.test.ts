/**
 * 탈퇴 뒤의 첫 화면과 게스트 로그아웃(2026-10-19: 세션만 종료).
 * 종전: 「게스트로 시작함」 표시가 탭에 남아 새로고침하면 새 게스트가 자동으로 만들어졌다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
  };
}
const session = memoryStorage();
const local = memoryStorage();
(globalThis as { sessionStorage?: unknown }).sessionStorage = session;
(globalThis as { localStorage?: unknown }).localStorage = local;

const keys = await import("../../src/lib/storage/appSessionKeys.ts");
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

for (const notice of ["account-deleted"] as const) {
  test(`${notice} 정리 후: 게스트 자동 진입 안 함 · 로그아웃 화면도 아님 · 안내 1회`, () => {
    keys.setGuestEntryAccepted();
    keys.setUserSignedOutSessionFlag();
    keys.prepareStartScreen(notice);
    assert.equal(keys.readGuestEntryAccepted(), false, "남아 있으면 새 게스트가 자동 생성된다");
    assert.equal(keys.readUserSignedOutSessionFlag(), false, "남아 있으면 「로그아웃되었습니다」 화면이 뜬다");
    assert.equal(keys.readStartScreenNotice(), notice);
    keys.clearStartScreenNotice();
    assert.equal(keys.readStartScreenNotice(), null);
  });
}

test("로그아웃 표시는 localStorage — 새 탭에서도 로그아웃 화면(새 게스트 자동 생성 안 함)", () => {
  keys.setUserSignedOutSessionFlag();
  session.clear(); // 새 탭
  assert.equal(keys.readUserSignedOutSessionFlag(), true);
  keys.clearUserSignedOutSessionFlag();
  assert.equal(keys.readUserSignedOutSessionFlag(), false);
});

test("로그아웃 표시 키는 게스트 초기화가 지우는 앱 키에 속한다 — 그래서 초기화 **뒤에** 세워야 한다", async () => {
  const { listAppLocalStorageKeys } = await import("../../src/lib/identity/guestAccountReset.ts");
  keys.setUserSignedOutSessionFlag();
  assert.ok(listAppLocalStorageKeys().includes(keys.USER_SIGNED_OUT_SESSION_KEY));
  keys.clearUserSignedOutSessionFlag();
});

test("탈퇴 성공 → 정리 → 새로고침 순서", () => {
  const sheet = read("../../src/components/ProfileEditSheet.tsx"); // 10-23: 탈퇴는 프로필 수정 안으로 옮겼다
  assert.match(sheet, /await deleteMyAccount\([^)]*\);\s*prepareStartScreen\("account-deleted"\);\s*location\.reload\(\);/);
});

test("이용 종료는 Firebase signOut 없이 시작 메뉴로 돌아간다", () => {
  const app = read("../../src/App.tsx");
  const at = app.indexOf("async function handleServiceExit()");
  assert.ok(at >= 0);
  const body = app.slice(at, app.indexOf("\n  }\n", at));
  assert.ok(!body.includes("resetGuestAccount"));
  assert.ok(!body.includes("location.reload"));
  assert.ok(!body.includes("completeFirebaseSignOut"));
  assert.ok(!body.includes("signOut("));
  assert.match(body, /endAppUse\(\)/);
});

test("Google 성공만 종료 표시를 풀고 팝업은 서버 확인보다 먼저 연다", () => {
  const hook = read("../../src/hooks/useAppAuth.ts");
  const at = hook.indexOf("const handleGoogleSignIn");
  assert.ok(at >= 0);
  const body = hook.slice(at, hook.indexOf("const handleCompleteNickname", at));
  const reuseAt = body.indexOf("if (currentSession && !currentSession.isAnonymous)");
  const popupAt = body.indexOf("await signInWithPopup(auth, provider)");
  const revealAt = body.lastIndexOf("await revealVerifiedGoogleUser()");
  assert.ok(reuseAt >= 0 && popupAt > reuseAt);
  assert.match(body.slice(reuseAt, popupAt), /return;/);
  assert.ok(revealAt > popupAt);
  assert.match(body, /if \(outcome === "cancelled"\) return;/);
  assert.match(body, /if \(outcome === "linked" && revealed\) setAuthLinkRev/);
  assert.match(body, /clearAppUseEnded\(\)/);
});

test("10-25 Chief — 로그아웃 버튼은 정식 계정에만, 게스트에겐 없다", () => {
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  const code = sheet.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.match(code, /const showLogout = props\.user != null && !props\.isGuest;/);
});

test("이용 종료 버튼은 같은 Guest 포기를 말하지 않는다", () => {
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  const code = sheet.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(code.includes("로그아웃")); // 10-23 Chief: 「종료」 → 「로그아웃」
  assert.ok(code.includes("진행 중인 주행이 여기서 끝납니다"));
  assert.ok(!code.includes("같은 게스트로 돌아오지 못할 수 있습니다"));
  assert.ok(!code.includes("모든 데이터가 삭제됩니다"));
  assert.ok(!code.includes("게스트로 새로 시작"));
});

test("시작 화면이 탈퇴 안내를 받는다", () => {
  const app = read("../../src/App.tsx");
  const at = app.indexOf("<GuestEntryCard");
  assert.ok(at >= 0);
  const card = app.slice(at, app.indexOf("/>", at));
  assert.match(card, /startScreenNotice === "account-deleted"/);
});

/** 게스트는 로그아웃이 곧 삭제 — 같은 일을 하던 별도 버튼은 없앴다(2026-10-09 Chief) */
test("게스트 「이 기기 데이터 지우기」 버튼이 없다", () => {
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  // 주석은 빼고 본다 — 「없앴다」는 설명이 걸리지 않게
  const code = sheet.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!code.includes("이 기기 데이터 지우기"));
  assert.ok(!sheet.includes("resetGuestAccount"));
});
