/**
 * guest-lifecycle spec 의 정적 계약과, 확인되지 않은 복원 실패의 캐시 정책.
 * 에뮬레이터는 띄우지 않는다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, String(value)),
    removeItem: (key: string) => void memory.delete(key),
  },
});

const restore = await import("../../src/lib/identity/authRestore.ts");
const guest = await import("../../src/lib/identity/lastVerifiedGuest.ts");
const cache = await import("../../src/lib/identity/uidLocalCache.ts");

const specPath = fileURLToPath(new URL("../../e2e/guest-lifecycle.spec.ts", import.meta.url));
const spec = readFileSync(specPath, "utf8");

test("demo 가 아니고 로컬 에뮬레이터가 아니면 spec 은 실행하지 않는다", () => {
  assert.match(spec, /demo-boxcycle-guest/);
  assert.match(spec, /127\\.0\\.0\\.1\|localhost/);
  assert.match(spec, /demo localhost emulator is not configured/);
  assert.match(spec, /non-localhost emulator host or a project other than demo-boxcycle-guest/);
  assert.equal(spec.includes("boxcycle-dc2df"), false);
  assert.equal(spec.includes("test.skip(true"), false);
  assert.equal(spec.includes("test.fixme"), false);
});

test("spec 은 실제 UI 진입과 demo REST 만 쓰고 SDK 를 모킹하지 않는다", () => {
  for (const title of [
    "최초 진입은 명시 Guest 한 명이고 새로고침해도 같은 계정이다",
    "종료를 반복해도 같은 Guest 한 명을 재사용하고 계정 추가·활동 핑·presence 를 만들지 않는다",
    "삭제된 Guest 는 만료 안내로 돌아오고 명시 시작만 새 계정을 만든다",
    "offline 게스트 시작은 새 계정을 만들지 않고 복구 뒤 같은 Guest 에 돌아온다",
  ]) {
    assert.equal(spec.includes(title), true, title);
  }
  assert.match(spec, /guestStart/);
  assert.match(spec, /readGuestUid/);
  assert.match(spec, /context\(\)\.newPage/);
  assert.match(spec, /from '\.\/open-meteo-stub'/);
  assert.match(spec, /accounts:batchGet\?\$\{query\}/);
  assert.match(spec, /maxResults: '1000'/);
  assert.match(spec, /nextPageToken/);
  assert.match(spec, /accounts:delete/);
  assert.match(spec, /method: 'POST'/);
  assert.match(spec, /localId/);
  assert.equal(spec.includes("emulator/v1/projects"), false);
  assert.match(spec, /Bearer owner/);
  assert.match(spec, /guestLifecycle/);
  assert.match(spec, /blocked\.json\?ns=\$\{ns\}/);
  assert.match(spec, /headers: ownerHeaders\(\)/);
  assert.equal(spec.includes("auth=owner"), false);
  for (const banned of ["console.", "signInAnonymously", "page.route", "vi.mock", "jest.mock", "browser.newContext"]) {
    assert.equal(spec.includes(banned), false, banned);
  }
});

test("종료/동일 Guest 복귀 계약 — 종료는 signOut 대신 시작 메뉴로 돌아온다(02-task-17)", () => {
  // 10-25 Chief: 게스트에겐 로그아웃 버튼이 없다 — spec 은 버튼 부재를 확인하고, 옛 빌드가 남긴
  // 「이용 종료」 표시(localStorage)로 종료 상태를 만든다. 버튼을 누르는 종료 계약(옛 「종료」)은 없다.
  assert.match(spec, /name: '로그아웃', exact: true \}\)\)\.toHaveCount\(0\)/);
  assert.match(spec, /boxcycle_app_use_ended_v1/);
  assert.equal(spec.includes("name: '종료'"), false);
  assert.match(spec, /종료를 반복해도 같은 Guest/);
  // 종료 뒤/만료 뒤 시작 메뉴는 로그인/게스트로 시작 둘뿐이다 — 옛 2단계 로그아웃 확인 계약은 없다.
  assert.equal(spec.includes("로그아웃 확인"), false);
  assert.match(spec, /로그인', exact: true/);
  assert.match(spec, /게스트로 시작/);
  // 종료 반복 3회 + 같은 UID + Auth 한 명 기대
  assert.match(spec, /round <= 3/);
  assert.match(spec, /uid changed after explicit start/);
  // heartbeat 종료 검증(GLM19) — 8s soak 비교가 아니다: 실제 요청 카운터 + page.clock 가속.
  assert.equal(spec.includes("ACTIVITY_SOAK_MS"), false);
  assert.match(spec, /GUEST_HEARTBEAT_MS/);
  assert.match(spec, /clock\.install\(\)/);
  assert.match(spec, /fastForward\(GUEST_HEARTBEAT_STEP_MS\)/);
  assert.match(spec, /guestActivityHttp/);
  assert.match(spec, /guestActivityPosts/);
  // heartbeat 샘플은 서버 기록 lastActivityAtMs 이고 non-null 기대다.
  assert.match(spec, /lastActivityAtMs/);
  assert.match(spec, /lastActivityAtMs\)이 문서에 남아 있어야 한다/);
  // membership·presence 결핍 검증(REST group query + RTDB motion + livePresence)
  assert.match(spec, /collectionId: 'members', allDescendants: true/);
  assert.match(spec, /documents:runQuery/);
  assert.equal(spec.includes(":runQuery'"), false); // 문서 경로에 runQuery 를 못 붙인 오표기 금지
  assert.match(spec, /trails\.json\?shallow=true/);
  // motion 부재는 JSON 결과 실검사다 — 무조건 true 로 돌려놓는 계약 금지.
  assert.match(spec, /json === null \|\| json === undefined/);
  assert.equal(spec.includes("directly/users"), false); // 표준 doc name 대비 오타 흔적 금지
  // UID 는 오류 문구와 로그에 남지 않는다 — 문구에 uid/trailId 를 직접 보간하지 않는다.
  assert.equal(spec.includes("motion/${uid} 는"), false);
  assert.equal(spec.includes("`read ${path}") || spec.includes("`delete ${path}"), false);
});

test("offline 게스트 시작 — 실제 network 차단과 복구후 같은 UID, 확정은 서버 계정 목록으로", () => {
  assert.match(spec, /setOffline\(true\)/);
  assert.match(spec, /setOffline\(false\)/);
  assert.match(spec, /offline 게스트 시작이 새 계정을 만들었다/);
  // 확정응답 요구 — UI 텍스트가 아닌 REST 계정 목록으로 결론짓는다.
  assert.match(spec, /listLocalIds/);
  assert.match(spec, /uid changed after recovery/);
  // GLM19 — 증가 비교 기준은 생성 후 snapshot(afterCreated)이다. 생성 전 기준으로 0 을 기대하지 않는다.
  assert.match(spec, /생성 후 snapshot/);
  assert.match(spec, /addedCount\(afterCreated, await listLocalIds\(\)\)/);
  // 과도한 UI 안정성 추측 금지 — force·skip 계약 없음.
  for (const banned of ["force:", "test.fixme", "test.skip(true"]) {
    assert.equal(spec.includes(banned), false, banned);
  }
});

test("확인되지 않은 null 은 만료 안내만 하고 캐시를 지우지 않는다", () => {
  memory.clear();
  memory.set("boxcycle_calorie_profile_v1_google-other", "preserve");
  memory.set("boxcycle_calorie_profile_v1_guest-old", "keep");
  guest.rememberVerifiedGuestUid("guest-old");
  const state = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "guest-restore-unconfirmed" });
  assert.equal(state.phase, "expired");
  assert.equal(state.expiryKind, "guest-expired");
  assert.equal(state.blockAutoAnonymous, true);
  assert.equal(memory.get("boxcycle_calorie_profile_v1_google-other"), "preserve");
  assert.equal(memory.get("boxcycle_calorie_profile_v1_guest-old"), "keep");
  assert.equal(guest.readLastVerifiedGuestUid(), "guest-old");
  cache.clearUidLocalCache("guest-old");
  assert.equal(memory.get("boxcycle_calorie_profile_v1_google-other"), "preserve");
  assert.equal(memory.get(guest.LAST_VERIFIED_GUEST_UID_KEY), "guest-old");
});

test("네트워크 실패와 토큰 재매핑은 삭제로 보지 않는다", () => {
  const offline = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "restore-wait-failed" });
  assert.equal(offline.phase, "offline");
  assert.equal(offline.expiryKind, null);
  assert.equal(offline.blockAutoAnonymous, true);
  assert.equal(restore.expiryClearsUidCache(null), false);
  assert.equal(restore.expiryClearsUidCache("auth/user-token-expired"), false);
  assert.equal(restore.expiryClearsUidCache("auth/network-request-failed"), false);
  assert.equal(restore.expiryClearsUidCache("auth/user-not-found"), true);
  const verifying = restore.reduceAuthExposure(restore.INITIAL_AUTH_EXPOSURE, { type: "candidate", uid: "held" });
  const ignored = restore.reduceAuthExposure(verifying, { type: "guest-restore-unconfirmed" });
  assert.equal(ignored.phase, "verifying");
  assert.equal(ignored.expiryKind, null);
});
