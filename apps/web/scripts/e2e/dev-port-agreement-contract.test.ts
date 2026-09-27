import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * e2e dev 서버 **포트 합의** 계약 (2026-09-27).
 *
 * 무엇을 막는가 — playwright 가 기다리는 포트와 vite 가 띄우는 포트가 어긋나면
 * e2e 가 통째로 죽는데, **증상이 원인을 전혀 말하지 않는다**:
 *
 *     Error: Timed out waiting 120000ms from config.webServer.
 *
 * 실제로 그랬다. Functions 번들을 쓰지 않는 에뮬레이터 e2e(동행 12종 전부)에서
 * vite 는 5002, playwright 는 5000 을 봤다. 2026-09-24 감사 H5 가 포트 **값**을
 * `devPort.ts` 로 모았지만, 「에뮬레이터인가」의 **판단**은 양쪽에 따로 남아 있었다.
 *
 * ⚠️ 그래서 이 계약은 「같은 상수를 쓰는가」를 보지 않는다 — 그건 이미 참이었는데도
 * 깨졌다. **두 설정을 실제로 불러 최종 포트를 맞대어 본다.**
 */

const PW_CONFIG = new URL("../../playwright.config.ts", import.meta.url).href;
const VITE_CONFIG = new URL("../../vite.config.ts", import.meta.url).href;

type WebServer = { url?: string; env?: Record<string, string> };

/** 설정은 import 시점에 env 를 읽는다 — 먼저 심고 부른 뒤 되돌린다. */
async function loadConfigs(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  // 캐시를 피해 매번 새로 부른다.
  const bust = `?t=${Date.now()}-${Math.random()}`;
  try {
    const pw = (await import(PW_CONFIG + bust)).default as { webServer?: WebServer };
    const viteFactory = (await import(VITE_CONFIG + bust)).default as unknown;
    return { pw, viteFactory };
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

function portOf(url: string | undefined): number {
  assert.ok(url, "webServer.url 이 없으면 playwright 가 무엇을 기다리는지 알 수 없다");
  return Number(new URL(url!).port);
}

/** vite 설정 factory 를 주어진 mode 로 평가해 서버 포트를 꺼낸다. */
function vitePort(factory: unknown, mode: string, injected: string | undefined): number {
  const saved = process.env.RTW_DEV_PORT;
  if (injected == null) delete process.env.RTW_DEV_PORT;
  else process.env.RTW_DEV_PORT = injected;
  try {
    const cfg = (factory as (o: { mode: string; command: string }) => { server?: { port?: number } })(
      { mode, command: "serve" },
    );
    const port = cfg.server?.port;
    assert.equal(typeof port, "number", "vite 설정에서 포트를 못 읽었다(M0)");
    return port as number;
  } finally {
    if (saved == null) delete process.env.RTW_DEV_PORT;
    else process.env.RTW_DEV_PORT = saved;
  }
}

/** playwright 가 webServer 를 띄울 때 vite 가 보게 될 mode. */
function viteModeFor(underEmulator: boolean, harness: boolean): string {
  if (harness) return "harness";
  return underEmulator ? "emulator" : "development";
}

const CASES = [
  { name: "에뮬레이터 · Functions 없음 (동행 e2e — 실제로 깨졌던 조합)", env: { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }, emu: true, harness: false },
  { name: "에뮬레이터 · Functions 포함", env: { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", RTW_E2E_WITH_FUNCTIONS: "1" }, emu: true, harness: false },
  { name: "에뮬레이터 없음 (평상시 e2e)", env: {}, emu: false, harness: false },
];

describe("playwright 가 기다리는 포트 = vite 가 띄우는 포트", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const { pw, viteFactory } = await loadConfigs({
        FIRESTORE_EMULATOR_HOST: undefined,
        RTW_E2E_WITH_FUNCTIONS: undefined,
        ROUTE_TOKEN_UI_LIVE: undefined,
        RTW_DEV_PORT: undefined,
        ...c.env,
      });

      const waitPort = portOf(pw.webServer?.url);
      const injected = pw.webServer?.env?.RTW_DEV_PORT;
      const served = vitePort(viteFactory, viteModeFor(c.emu, c.harness), injected);

      assert.equal(
        served,
        waitPort,
        `vite 는 ${served}, playwright 는 ${waitPort} — e2e 가 webServer 타임아웃으로 죽는다`,
      );
    });
  }

  it("포트를 언제나 주입한다 — 판단이 갈려도 vite 가 따르게", async () => {
    /*
     * 값을 공유하는 것만으로는 부족하다. 실제로 `devPort.ts` 를 공유하고도 깨졌다.
     * 한쪽이 정하고 다른 쪽이 **따라야** 한다.
     */
    for (const c of CASES) {
      const { pw } = await loadConfigs({
        FIRESTORE_EMULATOR_HOST: undefined,
        RTW_E2E_WITH_FUNCTIONS: undefined,
        ROUTE_TOKEN_UI_LIVE: undefined,
        RTW_DEV_PORT: undefined,
        ...c.env,
      });
      assert.ok(
        pw.webServer?.env?.RTW_DEV_PORT,
        `${c.name}: RTW_DEV_PORT 를 안 넘기면 vite 가 제 나름대로 포트를 고른다`,
      );
    }
  });

  it("M0 — 포트를 실제로 읽고 있다 (둘 다 0 이면 전부 공짜로 통과한다)", async () => {
    const { pw, viteFactory } = await loadConfigs({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
    assert.ok(portOf(pw.webServer?.url) > 0);
    assert.ok(vitePort(viteFactory, "emulator", undefined) > 0);
  });
});
