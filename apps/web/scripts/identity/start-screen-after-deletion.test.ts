/**
 * 탈퇴 후에는 처음 들어온 사람과 같은 시작 화면 (2026-10-09 Chief).
 * 종전: 「게스트로 시작함」 표시가 탭에 남아 새로고침하면 새 게스트가 자동으로 만들어졌다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const store = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

const keys = await import("../../src/lib/storage/appSessionKeys.ts");
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("탈퇴 정리 후: 게스트 자동 진입 안 함 · 로그아웃 화면도 아님 · 완료 안내 1회", () => {
  keys.setGuestEntryAccepted();
  keys.setUserSignedOutSessionFlag();
  keys.prepareStartScreenAfterAccountDeletion();
  assert.equal(keys.readGuestEntryAccepted(), false, "남아 있으면 새 게스트가 자동 생성된다");
  assert.equal(keys.readUserSignedOutSessionFlag(), false, "남아 있으면 「로그아웃되었습니다」 화면이 뜬다");
  assert.equal(keys.readAccountDeletedNotice(), true);
  keys.clearAccountDeletedNotice();
  assert.equal(keys.readAccountDeletedNotice(), false);
});

test("탈퇴 성공 → 정리 → 새로고침 순서", () => {
  const sheet = read("../../src/components/UserInfoSheet.tsx");
  assert.match(
    sheet,
    /await deleteMyAccount\([^)]*\);\s*prepareStartScreenAfterAccountDeletion\(\);\s*location\.reload\(\);/,
  );
});

test("시작 화면이 탈퇴 안내를 받는다", () => {
  const app = read("../../src/App.tsx");
  const at = app.indexOf("<GuestEntryCard");
  assert.ok(at >= 0);
  assert.match(app.slice(at, app.indexOf("/>", at)), /notice=\{accountDeletedNotice \?/);
});
