/**
 * 앱 부트스트랩용 sessionStorage 키·리더.
 * (Phase 1: App.tsx 에서 분리)
 *
 * 2026-09-26 (Phase 6-D3): 맵 스타일 프리셋(`MAP_STYLE_OPTIONS`·`DEFAULT_MAP_STYLE`)이
 * 여기 얹혀 있어 **저장소 도메인이 지도를 올려다보고** 있었다. `map/rtwMapConfig` 로
 * 옮겼다 — App.tsx 를 쪼갤 때 「같이 나온 것」이 「같은 곳에 사는 것」이 돼 있었다.
 */
/** 명시적 로그아웃 후 자동 익명 진입을 막는 플래그(브라우저 전체 — 아래 read 주석). */
export const USER_SIGNED_OUT_SESSION_KEY = "boxcycle_user_signed_out_v1";

/** 최초 1회 Guest(익명) 진입 안내 수락 — [tier 정책 §3.2](document/reference/product/260519-사용자-tier-및-진입-정책.md) */
export const GUEST_ENTRY_ACCEPTED_SESSION_KEY = "boxcycle_guest_entry_v1";

export function readGuestEntryAccepted(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_ENTRY_ACCEPTED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuestEntryAccepted(): void {
  try {
    sessionStorage.setItem(GUEST_ENTRY_ACCEPTED_SESSION_KEY, "1");
  } catch {
    /* noop */
  }
}

const LEGACY_POST_SIGNOUT_MAP_SESSION_KEY = "boxcycle_post_signout_map_v1";

/*
 * 「로그아웃함」 은 **브라우저 전체**(localStorage)에 둔다(2026-10-09). 로그인 상태는 탭들이 함께 쓰는데
 * 이 표시만 탭마다(sessionStorage) 있으면, A 탭 로그아웃을 본 B 탭이 「게스트로 시작함」 만 보고 새 게스트를
 * 자동으로 만든다. 새 게스트는 사람이 버튼을 누를 때만 만든다. 옛 sessionStorage 값도 읽는다.
 */
export function readUserSignedOutSessionFlag(): boolean {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(USER_SIGNED_OUT_SESSION_KEY) === "1") {
      return true;
    }
  } catch {
    /* noop */
  }
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (sessionStorage.getItem(USER_SIGNED_OUT_SESSION_KEY) === "1") return true;
    if (sessionStorage.getItem(LEGACY_POST_SIGNOUT_MAP_SESSION_KEY) === "1") {
      sessionStorage.setItem(USER_SIGNED_OUT_SESSION_KEY, "1");
      sessionStorage.removeItem(LEGACY_POST_SIGNOUT_MAP_SESSION_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function setUserSignedOutSessionFlag(): void {
  try {
    localStorage.setItem(USER_SIGNED_OUT_SESSION_KEY, "1");
  } catch {
    /* noop */
  }
}

export function clearUserSignedOutSessionFlag(): void {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      store?.removeItem(USER_SIGNED_OUT_SESSION_KEY);
    } catch {
      /* noop */
    }
  }
}

/** 시작 화면에 한 번 보여 줄 안내(같은 탭) — 탈퇴·게스트 초기화 직후 */
export const START_SCREEN_NOTICE_SESSION_KEY = "boxcycle_start_notice_v1";

export type StartScreenNotice = "account-deleted";

/**
 * 탈퇴·게스트 초기화 직후 — 처음 들어온 사람과 같은 시작 화면(GuestEntryCard)으로 돌린다(2026-10-09 Chief).
 * 「게스트로 시작함」 표시가 sessionStorage 에 남아 있어, 새로고침하면 아무것도 묻지 않고 **새 게스트를
 * 자동으로 만들어** 지도로 들어갔다. 새 게스트는 사람이 「시작」 을 누를 때만 만든다.
 */
export function prepareStartScreen(notice: StartScreenNotice): void {
  try {
    sessionStorage.removeItem(GUEST_ENTRY_ACCEPTED_SESSION_KEY);
    sessionStorage.setItem(START_SCREEN_NOTICE_SESSION_KEY, notice);
  } catch {
    /* noop */
  }
  clearUserSignedOutSessionFlag();
}

export function readStartScreenNotice(): StartScreenNotice | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const v = sessionStorage.getItem(START_SCREEN_NOTICE_SESSION_KEY);
    return v === "account-deleted" ? v : null;
  } catch {
    return null;
  }
}

export function clearStartScreenNotice(): void {
  try {
    sessionStorage.removeItem(START_SCREEN_NOTICE_SESSION_KEY);
  } catch {
    /* noop */
  }
}
