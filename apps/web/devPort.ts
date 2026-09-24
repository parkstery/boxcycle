/**
 * Vite 개발 서버 포트의 단일 진실.
 *
 * 왜 — 2026-09-24 구조 감사 H5. `RTW_DEV_PORT ?? (에뮬레이터면 5002 아니면 5000)` 이라는
 * **같은 규칙이 `vite.config.ts` 와 `playwright.config.ts` 에 따로 구현**돼 있었다.
 * 한쪽 포트만 바꾸면 e2e 가 서버를 못 찾는데, 증상은 「webServer 타임아웃」으로만 나와
 * 원인을 짚기 어렵다.
 *
 * 「에뮬레이터인가」를 판단하는 방법은 둘이 다르다(vite 는 `mode`, playwright 는 주입된
 * env 를 본다) — 그건 각자의 맥락이므로 여기서 통일하지 않는다. 공유하는 것은 **값**뿐이다.
 */

/** 평상시 dev 서버 포트. */
export const DEV_PORT_DEFAULT = 5000;

/** 에뮬레이터 모드 — Functions Emulator(5001)와 충돌하지 않도록 비켜 쓴다. */
export const DEV_PORT_EMULATOR = 5002;

/**
 * `RTW_DEV_PORT` 가 있으면 그것이 이긴다 — 다른 worktree 가 5000 을 잡고 있을 때
 * e2e 를 나란히 돌리기 위한 우회로다.
 */
export function resolveDevPort(isEmulator: boolean, envPort?: string | undefined): number {
  const raw = envPort ?? process.env.RTW_DEV_PORT;
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return isEmulator ? DEV_PORT_EMULATOR : DEV_PORT_DEFAULT;
}
