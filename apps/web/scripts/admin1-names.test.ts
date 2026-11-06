import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import zlib from "node:zlib";
import {
  ADMIN1_NAMES_RETRY_MS,
  admin1Label,
  loadAdmin1Names,
  resetAdmin1NamesCache,
} from "../src/lib/geo/admin1Names.ts";

const webDir = path.resolve(import.meta.dirname, "..");
const boundaryDir = path.resolve(webDir, "../../functions/geo-data/v1/admin1");
const namesDir = path.join(webDir, "public/geo-names/v1");

type NameTable = Record<string, { ko?: string; en?: string }>;
const table = (cc: string): NameTable => JSON.parse(fs.readFileSync(path.join(namesDir, `${cc}.json`), "utf8"));

function boundaryCodes(): string[] {
  const codes: string[] = [];
  for (const f of fs.readdirSync(boundaryDir).filter((n) => n.endsWith(".json.gz")).sort()) {
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(boundaryDir, f))).toString("utf8")) as { admin1: { a: string }[] };
    for (const r of j.admin1) codes.push(r.a);
  }
  return codes;
}

describe("행정구역 이름 표 계약", () => {
  const codes = boundaryCodes();
  it("경계 데이터의 모든 코드가 이름 표에 있고 영어 이름이 비어 있지 않다", () => {
    assert.equal(codes.length, 3813);
    const bad = codes.filter((c) => {
      const cc = c.slice(0, 2);
      if (!fs.existsSync(path.join(namesDir, `${cc}.json`))) return true;
      return !table(cc)[c]?.en?.trim();
    });
    assert.deepEqual(bad, []);
  });
  it("고정값", () => {
    assert.equal(table("KR")["KR-11"].ko, "서울특별시");
    assert.ok(table("FR")["FR-IDF"].ko?.trim());
    assert.equal(table("GB")["GB-ENG"].ko, "잉글랜드");
  });
});

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("loadAdmin1Names", () => {
  it("같은 국가는 한 번만 요청(진행 중 요청도 공유)", async () => {
    resetAdmin1NamesCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return jsonRes({ "KR-11": { ko: "서울특별시", en: "Seoul" } });
    }) as typeof fetch;
    const [a, b] = await Promise.all([loadAdmin1Names("KR", { fetchImpl }), loadAdmin1Names("KR", { fetchImpl })]);
    const c = await loadAdmin1Names("KR", { fetchImpl });
    assert.equal(calls, 1);
    assert.equal(a["KR-11"].en, "Seoul");
    assert.equal(b, a);
    assert.equal(c, a);
  });
  it("404·HTML·예외·형식 오류는 빈 객체, 60초 안에는 재요청 안 하고 뒤에는 재시도", async () => {
    resetAdmin1NamesCache();
    let calls = 0;
    let mode: "404" | "html" | "throw" | "ok" = "404";
    let t = 1_000;
    const opts = {
      now: () => t,
      fetchImpl: (async () => {
        calls += 1;
        if (mode === "404") return new Response("nope", { status: 404 });
        if (mode === "html") return new Response("<!doctype html><html></html>", { status: 200 });
        if (mode === "throw") throw new Error("offline");
        return jsonRes({ "FR-IDF": { ko: "일드프랑스" } });
      }) as typeof fetch,
    };
    assert.deepEqual(await loadAdmin1Names("FR", opts), {});
    assert.equal(calls, 1);
    mode = "html";
    t += ADMIN1_NAMES_RETRY_MS - 1;
    assert.deepEqual(await loadAdmin1Names("FR", opts), {});
    assert.equal(calls, 1);
    t += 1;
    assert.deepEqual(await loadAdmin1Names("FR", opts), {});
    assert.equal(calls, 2);
    mode = "throw";
    t += ADMIN1_NAMES_RETRY_MS;
    assert.deepEqual(await loadAdmin1Names("FR", opts), {});
    assert.equal(calls, 3);
    mode = "ok";
    t += ADMIN1_NAMES_RETRY_MS;
    assert.equal((await loadAdmin1Names("FR", opts))["FR-IDF"].ko, "일드프랑스");
    assert.equal(calls, 4);
  });
  it("국가코드 형식 오류는 요청 없이 빈 객체", async () => {
    resetAdmin1NamesCache();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return jsonRes({});
    }) as typeof fetch;
    for (const bad of ["", "kr", "KOR", "../x", "K1"]) assert.deepEqual(await loadAdmin1Names(bad, { fetchImpl }), {});
    assert.equal(calls, 0);
  });
});

describe("admin1Label", () => {
  const names = { "A-1": { ko: "가", en: "A" }, "A-2": { en: "B" }, "A-3": { ko: "다" } };
  it("요청 언어 → 영어 → 한국어 → 코드", () => {
    assert.equal(admin1Label("A-1", names), "가");
    assert.equal(admin1Label("A-1", names, "en"), "A");
    assert.equal(admin1Label("A-2", names), "B");
    assert.equal(admin1Label("A-3", names, "en"), "다");
    assert.equal(admin1Label("Z-9", names), "Z-9");
  });
});
