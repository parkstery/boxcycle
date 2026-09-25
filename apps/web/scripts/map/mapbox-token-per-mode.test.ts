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
 * `harness` 모드는 **다른 계약**을 갖는다 — 자리표시자인 것이 의도다. 2026-09-26 까지 그
 * 의도는 커밋 메시지와 결정 로그에만 있었다. 의도가 글로만 있으면 다음 사람은 「같은 함정」과
 * 구분할 수 없으므로, 아래에서 **의도 자체를 단언**한다: 자리표시자가 맞고, **러너가 실토큰을
 * 주입한다.** 주입이 사라지면 UI smoke 의 지도가 조용히 검어진다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import fs from "node:fs";
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

  it("harness 모드는 자리표시자가 의도 — 대신 러너가 실토큰을 주입한다", () => {
    /*
     * route-token 하네스는 Directions 를 Functions Emulator 로 돌리므로 실토큰을 태울
     * 이유가 없다. 그래서 `.env.harness` 는 자리표시자를 갖는다 — **여기까지가 의도다.**
     *
     * 그런데 UI smoke 는 지도를 띄운다. 러너가 `readMapboxPkForUiSmoke()` 로 실토큰을
     * 주입해 그 간극을 메우고 있다. 이 주입이 사라지면 `.env.harness` 의 자리표시자가
     * 그대로 쓰여 **smoke 화면만 조용히 검어진다** — .env.emulator 와 정확히 같은 함정이고,
     * 다른 점은 우회로가 의도적이라는 것뿐이다. 그래서 둘을 함께 묶어 둔다.
     */
    const env = loadEnv("harness", WEB_ROOT, "VITE_");
    const token = (env.VITE_MAPBOX_ACCESS_TOKEN ?? "").trim();
    assert.doesNotMatch(
      token,
      REAL_TOKEN_RE,
      ".env.harness 에 실토큰을 넣지 않는다 — 하네스는 Emulator 경유라 태울 이유가 없다",
    );

    /*
     * 산문이 아니라 **코드**를 본다 — 주석 처리된 `// VITE_MAPBOX_ACCESS_TOKEN: mapboxPk,`
     * 에도 정규식이 걸려 주입을 꺼도 초록이었다(2026-09-26, 이 시험을 깨뜨려 보고 찾았다).
     */
    const runnerRaw = fs.readFileSync(
      path.resolve(WEB_ROOT, "scripts/route-token/run-route-token-harness.mjs"),
      "utf8",
    );
    const runner = runnerRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    assert.match(
      runner,
      /readMapboxPkForUiSmoke\(\)/,
      "러너가 UI smoke 용 실토큰을 읽어야 한다 — 없으면 smoke 지도가 검게 나온다",
    );
    assert.match(
      runner,
      /VITE_MAPBOX_ACCESS_TOKEN:\s*mapboxPk/,
      "읽은 실토큰을 Vite 환경에 실제로 주입해야 한다(읽기만 하면 자리표시자가 쓰인다)",
    );
  });

  it("역방향 검산 — 판정식이 자리표시자를 실제로 걸러낸다", () => {
    // 이 시험이 「무엇이든 통과」가 아님을 보인다.
    assert.equal(REAL_TOKEN_RE.test("pk.fake-token-for-emulator"), false);
    assert.equal(REAL_TOKEN_RE.test("pk.route-token-harness-placeholder"), false);
    assert.equal(REAL_TOKEN_RE.test(""), false);
    assert.equal(REAL_TOKEN_RE.test("pk.eyJ1IjoiZXhhbXBsZSJ9.abc"), true);
  });
});
