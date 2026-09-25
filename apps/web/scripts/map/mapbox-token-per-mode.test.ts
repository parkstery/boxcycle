/**
 * 모드별 Mapbox 토큰 계약.
 *
 * 무엇을 막는가 (2026-09-25) — `.env.emulator` 에 `pk.fake-token-for-emulator` 가 박혀 있어
 * `npm run dev:emulator` 로 손수 띄우면 **지도가 통째로 검게** 나왔다. Firebase 에뮬레이터·
 * 경로 탐색·표고는 멀쩡해서 **앱 결함으로 오인**하기 쉽다.
 *
 * 더 나쁜 것은 e2e 가 그것을 **우회하고 있었다**는 점이다 — `playwright.config.ts` 의
 * `resolveEmulatorMapboxToken()` 이 가짜 토큰을 감지해 실토큰으로 갈아끼운다. 그래서
 * **자동 시험은 늘 초록이고 사람이 띄울 때만 깨졌다.** 우회로가 있으면 결함은 영영 안 보인다.
 *
 * `harness` 모드는 제외한다 — route-token 하네스는 지도를 쓰지 않고, 실토큰을 태우지
 * 않으려는 의도가 분명하다(별건으로 기록).
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { loadEnv } from "vite";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** 실제 Mapbox 퍼블릭 토큰은 `pk.` + base64 JWT 다. 자리표시자는 이 형태가 아니다. */
const REAL_TOKEN_RE = /^pk\.eyJ/;

describe("Mapbox 토큰 — 사람이 띄우는 모드는 실토큰이어야 한다", () => {
  for (const mode of ["", "emulator"] as const) {
    const label = mode === "" ? "기본(npm run dev)" : `${mode}(npm run dev:emulator)`;
    it(`${label} 모드가 실토큰을 본다`, () => {
      const env = loadEnv(mode, WEB_ROOT, "VITE_");
      const token = (env.VITE_MAPBOX_ACCESS_TOKEN ?? "").trim();
      assert.ok(token.length > 0, `${label}: 토큰이 비었다 — 지도가 검게 나온다`);
      assert.match(
        token,
        REAL_TOKEN_RE,
        `${label}: 자리표시자 토큰(${token.slice(0, 8)}…)이다 — 지도가 검게 나온다. ` +
          `모드별 .env 에서 이 키를 지워 .env 의 실토큰을 상속하게 하라`,
      );
    });
  }

  it("역방향 검산 — 판정식이 자리표시자를 실제로 걸러낸다", () => {
    // 이 시험이 「무엇이든 통과」가 아님을 보인다.
    assert.equal(REAL_TOKEN_RE.test("pk.fake-token-for-emulator"), false);
    assert.equal(REAL_TOKEN_RE.test("pk.route-token-harness"), false);
    assert.equal(REAL_TOKEN_RE.test(""), false);
    assert.equal(REAL_TOKEN_RE.test("pk.eyJ1IjoiZXhhbXBsZSJ9.abc"), true);
  });
});
