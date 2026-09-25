import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { encodePayload } from "../../src/lib/trail/repo/rtdbTrailMotion.ts";
import type { TrailLiveRidePhase } from "../../src/lib/trail/repo/firestoreTrailLivePublicationRides.ts";

/**
 * peer-sync 패킷과 RTDB 보안 규칙의 계약을 고정한다.
 *
 * 왜 필요한가 — 2026-09-24 구조 감사 위험 R8. `database.rules.json` 의 `.validate` 가
 * 패킷 스키마(`p,d,v,ph,t`)를 하드코딩하는데 코드와 연결 고리가 없었다. 필드를 바꾸거나
 * `ridePhase` 에 값을 하나 더하면 RTDB write 가 **조용히 거부**된다 — 타입 에러도,
 * 런타임 예외도 없다. 화면에서는 **동행 라이더만 안 보이고 앱은 정상으로 보인다.**
 *
 * 그래서 규칙 파일에서 조건을 **읽어와** 대조한다. 여기에 값을 다시 적으면 중복이
 * 하나 더 생길 뿐이다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.resolve(__dirname, "../../../../database.rules.json");

type Rules = {
  rules: {
    trails: {
      $trailId: {
        motion: {
          $uid: { ".validate": string; ".write": string };
        };
      };
    };
  };
};

function readValidate(): string {
  const raw = fs.readFileSync(RULES_PATH, "utf8");
  const rules = JSON.parse(raw) as Rules;
  const v = rules?.rules?.trails?.$trailId?.motion?.$uid?.[".validate"];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error("database.rules.json 에서 motion/$uid 의 .validate 를 읽지 못했다");
  }
  return v;
}

/** `.validate` 의 `hasChildren(['p','d',...])` 에서 필수 필드를 뽑는다. */
function requiredFieldsFromRules(validate: string): string[] {
  const m = validate.match(/hasChildren\(\[([^\]]+)\]\)/);
  if (!m) throw new Error(".validate 에서 hasChildren([...]) 을 찾지 못했다");
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** `.validate` 의 `child('ph').val() == 'live'` 들에서 허용 phase 를 뽑는다. */
function allowedPhasesFromRules(validate: string): string[] {
  return [...validate.matchAll(/child\('ph'\)\.val\(\)\s*==\s*'([^']+)'/g)].map((x) => x[1]);
}

/** `.validate` 의 `child('p').val().length <= N` 에서 상한을 뽑는다. */
function publicationIdMaxLenFromRules(validate: string): number {
  const m = validate.match(/child\('p'\)\.val\(\)\.length\s*<=\s*(\d+)/);
  if (!m) throw new Error(".validate 에서 p 길이 상한을 찾지 못했다");
  return Number(m[1]);
}

const VALIDATE = readValidate();

/** 코드가 쓰는 phase 전량. 타입에서 값을 얻을 수 없으므로 여기 적되, M0 가 누락을 잡는다. */
const CODE_PHASES: TrailLiveRidePhase[] = ["live", "paused", "completed"];

function sampleSnapshot(overrides: Partial<Parameters<typeof encodePayload>[0]> = {}) {
  return {
    uid: "u-test",
    publicationId: "pub-abc",
    distM: 1234.56,
    speedMps: 7.89,
    ridePhase: "live" as TrailLiveRidePhase,
    ...overrides,
  } as Parameters<typeof encodePayload>[0];
}

describe("M0 · 시험 자가 검산", () => {
  it("규칙 파일을 실제로 읽었다 — 못 읽으면 이하 판정이 공허하다", () => {
    assert.ok(VALIDATE.length > 50, `.validate 가 너무 짧다: ${VALIDATE.length}자`);
    assert.match(VALIDATE, /hasChildren/);
  });

  it("규칙에서 뽑아낸 값이 비어 있지 않다", () => {
    assert.ok(requiredFieldsFromRules(VALIDATE).length > 0, "필수 필드 0개");
    assert.ok(allowedPhasesFromRules(VALIDATE).length > 0, "허용 phase 0개");
    assert.ok(publicationIdMaxLenFromRules(VALIDATE) > 0, "p 길이 상한 0");
  });

  it("encodePayload 가 실제로 객체를 만든다", () => {
    const p = encodePayload(sampleSnapshot());
    assert.equal(typeof p, "object");
    assert.ok(Object.keys(p).length > 0);
  });
});

describe("R8 고정 · 패킷이 RTDB 규칙을 만족한다", () => {
  it("규칙이 요구하는 필드를 빠짐없이 담는다", () => {
    const required = requiredFieldsFromRules(VALIDATE);
    const payload = encodePayload(sampleSnapshot()) as Record<string, unknown>;
    for (const f of required) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(payload, f),
        `패킷에 '${f}' 가 없다 — RTDB 가 write 를 거부하고, 화면에서는 동행 라이더만 사라진다`,
      );
    }
  });

  it("규칙의 필수 필드와 패킷의 필드가 정확히 일치한다 — 한쪽만 바뀌면 여기서 갈라진다", () => {
    const required = [...requiredFieldsFromRules(VALIDATE)].sort();
    // `s` 는 DEV 진단용 선택 필드라 계약에서 뺀다(규칙도 추가 필드를 막지 않는다).
    const sent = Object.keys(encodePayload(sampleSnapshot()) as Record<string, unknown>)
      .filter((k) => k !== "s")
      .sort();
    assert.deepEqual(
      sent,
      required,
      `패킷 [${sent.join(",")}] 과 규칙 [${required.join(",")}] 이 다르다. ` +
        "규칙이 더 많으면 write 가 거부되고, 코드가 더 많으면 검증되지 않는 필드가 흘러간다.",
    );
  });

  it("`p` 는 비어 있지 않은 문자열이고 길이 상한 안이다", () => {
    const max = publicationIdMaxLenFromRules(VALIDATE);
    const payload = encodePayload(sampleSnapshot());
    assert.equal(typeof payload.p, "string");
    assert.ok(payload.p.length > 0, "규칙은 length > 0 을 요구한다");
    assert.ok(payload.p.length <= max, `규칙 상한 ${max} 초과`);
  });

  it("`d`·`v` 는 0 이상의 수다 — 음수 입력도 규칙을 넘지 않게 눌러야 한다", () => {
    const payload = encodePayload(sampleSnapshot({ distM: -50, speedMps: -3 }));
    assert.equal(typeof payload.d, "number");
    assert.equal(typeof payload.v, "number");
    assert.ok(payload.d >= 0, "음수 거리가 그대로 나가면 규칙이 거부한다");
    assert.ok(payload.v >= 0, "음수 속도가 그대로 나가면 규칙이 거부한다");
  });

  it("`t` 는 0 보다 큰 수다", () => {
    const payload = encodePayload(sampleSnapshot());
    assert.equal(typeof payload.t, "number");
    assert.ok(payload.t > 0);
  });

  it("코드가 쓰는 모든 ridePhase 가 규칙의 허용 목록에 있다", () => {
    const allowed = allowedPhasesFromRules(VALIDATE);
    for (const phase of CODE_PHASES) {
      assert.ok(
        allowed.includes(phase),
        `phase '${phase}' 가 규칙에 없다 — 그 상태로 달리는 라이더의 패킷이 전부 거부된다. ` +
          `database.rules.json 의 ph 조건에 추가하고 배포하라.`,
      );
    }
  });

  it("규칙이 허용하는 phase 에 코드가 모르는 값이 없다 — 있으면 한쪽만 바뀐 것이다", () => {
    const allowed = allowedPhasesFromRules(VALIDATE);
    for (const phase of allowed) {
      assert.ok(
        (CODE_PHASES as string[]).includes(phase),
        `규칙은 '${phase}' 를 허용하는데 코드에는 없다 — 규칙과 타입이 갈라졌다`,
      );
    }
  });

  it("각 phase 로 만든 패킷이 모두 규칙을 통과한다", () => {
    const allowed = allowedPhasesFromRules(VALIDATE);
    for (const phase of CODE_PHASES) {
      const payload = encodePayload(sampleSnapshot({ ridePhase: phase }));
      assert.ok(allowed.includes(payload.ph), `${phase} 패킷의 ph 가 규칙 밖이다`);
    }
  });
});
