import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// test:quick 은 TSX 로더 없이 돌므로 직접 등록한 뒤 컴포넌트를 불러온다.
await import("./auth-session-gate-tsx-register.mjs");
const { AuthSessionGate } = await import("../../src/components/auth/AuthSessionGate.tsx");

const FAILURE = "서비스에 연결할 수 없습니다.";
const CHOICE = "시작 방법을 선택해 주세요.";
const CONNECTING = "연결 중…";
const SIGNING_IN = "로그인 중…";

function props(overrides = {}) {
  const calls = { guest: 0, google: 0 };
  const value = {
    configured: true,
    authInitialized: true,
    authSigningIn: false,
    userSignedOut: false,
    busy: false,
    error: null,
    onStartGuest: () => {
      calls.guest += 1;
    },
    onGoogleSignIn: () => {
      calls.google += 1;
    },
    ...overrides,
  };
  return { calls, value };
}

function buttonsOf(value) {
  const found = [];
  const visit = (node) => {
    if (node == null || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.type === "function") {
      visit(node.type(node.props));
      return;
    }
    if (node.type === "button") found.push(node);
    visit(node.props?.children);
  };
  visit(createElement(AuthSessionGate, value));
  return found;
}

function labelOf(button) {
  const parts = [];
  const visit = (node) => {
    if (node == null || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.type === "function") {
      visit(node.type(node.props));
      return;
    }
    visit(node.props?.children);
  };
  visit(button.props.children);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function htmlOf(value) {
  return renderToStaticMarkup(createElement(AuthSessionGate, value));
}

function click(buttons, label) {
  const button = buttons.find((item) => labelOf(item) === label);
  assert.ok(button, `button missing: ${label}`);
  assert.equal(button.props.disabled, false);
  button.props.onClick();
}

test("부트 → busy Google/게스트 → idle 취소 → error → 다시 pending 이면 stale error 를 숨긴다", () => {
  const stale = "stale-popup-cancel";
  const boot = props({ authInitialized: false, error: stale });
  const bootHtml = htmlOf(boot.value);
  assert.match(bootHtml, new RegExp(CONNECTING));
  assert.doesNotMatch(bootHtml, new RegExp(SIGNING_IN));
  assert.equal(bootHtml.includes('role="status"'), true);
  assert.equal(bootHtml.includes(FAILURE), false);
  assert.equal(bootHtml.includes(CHOICE), false);
  assert.equal(bootHtml.includes(stale), false);
  assert.equal(bootHtml.includes("<button"), false);
  assert.equal(buttonsOf(boot.value).length, 0);
  assert.equal(boot.calls.guest, 0);
  assert.equal(boot.calls.google, 0);

  for (const phase of [
    { busy: true, authInitialized: true, error: stale },
    { busy: true, authInitialized: true, authSigningIn: false, error: null },
  ]) {
    const busy = props(phase);
    const html = htmlOf(busy.value);
    assert.match(html, new RegExp(SIGNING_IN));
    assert.doesNotMatch(html, new RegExp(CONNECTING));
    assert.equal(html.includes(FAILURE), false);
    assert.equal(html.includes(CHOICE), false);
    assert.equal(html.includes("<button"), false);
    assert.equal(html.includes(stale), false);
    assert.equal(buttonsOf(busy.value).length, 0);
    assert.equal(busy.calls.guest, 0);
    assert.equal(busy.calls.google, 0);
  }

  const idle = props();
  const idleHtml = htmlOf(idle.value);
  assert.match(idleHtml, new RegExp(CHOICE));
  assert.equal(idleHtml.includes(FAILURE), false);
  assert.equal(idleHtml.includes(CONNECTING), false);
  assert.equal(idleHtml.includes(SIGNING_IN), false);
  const idleButtons = buttonsOf(idle.value);
  click(idleButtons, "로그인");
  click(idleButtons, "게스트로 시작");
  assert.equal(idle.calls.google, 1);
  assert.equal(idle.calls.guest, 1);

  const detail = "익명 로그인 실패: offline";
  const failed = props({ error: detail });
  const failedHtml = htmlOf(failed.value);
  assert.match(failedHtml, new RegExp(FAILURE));
  assert.equal(failedHtml.includes(detail), true);
  assert.equal(failedHtml.split(detail).length - 1, 1);
  assert.equal(failedHtml.includes(CHOICE), false);
  const failedButtons = buttonsOf(failed.value);
  assert.equal(failedHtml.includes("다시 시도"), false);
  assert.equal(failedHtml.includes("Google로 로그인"), false);
  click(failedButtons, "로그인");
  click(failedButtons, "게스트로 시작");
  assert.equal(failed.calls.guest, 1);
  assert.equal(failed.calls.google, 1);

  const again = props({ busy: true, error: detail });
  const againHtml = htmlOf(again.value);
  assert.match(againHtml, new RegExp(SIGNING_IN));
  assert.equal(againHtml.includes('role="status"'), true);
  assert.equal(againHtml.includes(FAILURE), false);
  assert.equal(againHtml.includes(detail), false);
  assert.equal(againHtml.includes(CHOICE), false);
  assert.equal(buttonsOf(again.value).length, 0);
  assert.equal(again.calls.guest, 0);
  assert.equal(again.calls.google, 0);
});

test("authSigningIn 은 로그인 중이고 버튼과 실패 문구가 없다", () => {
  const signing = props({ authSigningIn: true, authInitialized: false, error: "stale-signing-error" });
  const html = htmlOf(signing.value);
  assert.match(html, new RegExp(SIGNING_IN));
  assert.doesNotMatch(html, new RegExp(CONNECTING));
  assert.equal(html.includes("stale-signing-error"), false);
  assert.equal(html.includes(FAILURE), false);
  assert.equal(buttonsOf(signing.value).length, 0);
});

test("이용 종료 뒤 시작 메뉴는 로그인과 게스트로 시작만 둔다", () => {
  const detail = "signed-out-detail";
  const signedOut = props({ userSignedOut: true, error: detail });
  const html = htmlOf(signedOut.value);
  assert.equal(html.includes("로그아웃되었습니다."), false);
  assert.equal(html.includes("게스트로 새로 시작"), false);
  assert.equal(html.includes("새 게스트는 이전 게스트의 기록을 이어받지 않습니다."), false);
  assert.match(html, new RegExp(CHOICE));
  assert.equal(html.includes(detail), true);
  assert.equal(html.includes(FAILURE), false);
  const buttons = buttonsOf(signedOut.value);
  click(buttons, "로그인");
  click(buttons, "게스트로 시작");
  assert.equal(signedOut.calls.google, 1);
  assert.equal(signedOut.calls.guest, 1);
});

test("복원 전 오프라인은 재시도만 둔다", () => {
  let retries = 0;
  const offline = props({
    authOffline: true,
    error: "offline-detail",
    onRetryAuth: () => {
      retries += 1;
    },
  });
  const html = htmlOf(offline.value);
  assert.match(html, /연결을 확인하지 못했습니다/);
  assert.equal(html.includes("로그인"), false);
  assert.equal(html.includes("게스트로 시작"), false);
  assert.equal(html.includes("offline-detail"), false);
  const buttons = buttonsOf(offline.value);
  click(buttons, "재시도");
  assert.equal(retries, 1);
  assert.equal(offline.calls.google, 0);
  assert.equal(offline.calls.guest, 0);
});

test("Firebase 설정 없음은 초기화 전에도 연결 중·실패 제목으로 바뀌지 않는다", () => {
  const missing = props({
    configured: false,
    authInitialized: false,
    busy: true,
    error: "config-detail",
  });
  const html = htmlOf(missing.value);
  assert.match(html, /Firebase 설정 필요/);
  assert.equal(html.includes(CONNECTING), false);
  assert.equal(html.includes(SIGNING_IN), false);
  assert.equal(html.includes(FAILURE), false);
  assert.equal(html.includes("config-detail"), true);
  assert.equal(html.includes("<button"), false);
  assert.equal(buttonsOf(missing.value).length, 0);
  assert.equal(missing.calls.guest, 0);
  assert.equal(missing.calls.google, 0);
});
