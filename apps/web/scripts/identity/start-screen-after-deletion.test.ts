/**
 * 탈퇴·게스트 초기화·게스트 로그아웃 뒤의 첫 화면 (2026-10-09 Chief).
 * 종전: 「게스트로 시작함」 표시가 탭에 남아 새로고침하면 새 게스트가 자동으로 만들어졌다.
 * 게스트 로그아웃은 데이터 삭제다 — 서버가 지운 뒤에만 로그아웃 화면으로 간다.
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
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  assert.match(sheet, /await deleteMyAccount\([^)]*\);\s*prepareStartScreen\("account-deleted"\);\s*location\.reload\(\);/);
});

test("게스트 로그아웃 = 서버 삭제 → 로그아웃 표시 → 새로고침, 실패하면 로그아웃하지 않는다", () => {
  const app = read("../../src/App.tsx");
  const at = app.indexOf("async function handleServiceExit()");
  assert.ok(at >= 0);
  const body = app.slice(at, app.indexOf("\n  }\n", at));
  const guest = body.slice(body.indexOf("if (user?.isAnonymous)"));
  assert.match(
    guest,
    /await resetGuestAccount\(user\);\s*if \(!result\.deletedAuth\) \{\s*setError\([\s\S]*?\);\s*return;\s*\}\s*setUserSignedOutSessionFlag\(\);\s*location\.reload\(\);\s*return;/,
  );
  assert.ok(
    body.indexOf("resetGuestAccount") < body.indexOf("completeFirebaseSignOut"),
    "게스트는 그냥 로그아웃(signOut)으로 빠지면 안 된다",
  );
});

test("게스트 로그아웃 확인 문구", () => {
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  assert.ok(sheet.includes('"게스트는 로그아웃하면 모든 데이터가 삭제됩니다."'));
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
