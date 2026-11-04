/**
 * 대표 국가 — 시간대 미리 채우기·목록·30일 제한·화면 연결 계약.
 * 실행: node --experimental-strip-types --test scripts/identity/home-country.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  guessHomeCountryFromTimeZone,
  homeCountryChangeBlockedUntilMs,
  isValidHomeCountry,
  listHomeCountryOptions,
} from "../../src/lib/identity/homeCountry.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.resolve(HERE, rel), "utf8");
const DAY = 86_400_000;

describe("시간대 → 국가", () => {
  it("현재 이름과 옛 이름(브라우저가 돌려주는 링크) 모두", () => {
    assert.equal(guessHomeCountryFromTimeZone("Asia/Seoul"), "KR");
    assert.equal(guessHomeCountryFromTimeZone("Asia/Calcutta"), "IN");
    assert.equal(guessHomeCountryFromTimeZone("Asia/Kolkata"), "IN");
    assert.equal(guessHomeCountryFromTimeZone("Europe/Paris"), "FR");
    assert.equal(guessHomeCountryFromTimeZone("America/New_York"), "US");
    assert.equal(guessHomeCountryFromTimeZone("Australia/Sydney"), "AU");
  });
  it("나라가 없는 시간대는 null — 사용자가 고른다", () => {
    assert.equal(guessHomeCountryFromTimeZone("UTC"), null);
    assert.equal(guessHomeCountryFromTimeZone("Etc/GMT+9"), null);
    assert.equal(guessHomeCountryFromTimeZone(""), null);
    assert.equal(guessHomeCountryFromTimeZone(null), null);
  });
});

describe("국가 목록", () => {
  it("한국어 이름순, 코드는 대문자 2글자", () => {
    const rows = listHomeCountryOptions("ko");
    assert.ok(rows.length >= 240);
    assert.equal(rows.find((r) => r.code === "KR")?.label, "대한민국");
    for (const r of rows) assert.match(r.code, /^[A-Z]{2}$/);
    const labels = rows.map((r) => r.label);
    assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "ko")));
  });
  it("검사", () => {
    assert.equal(isValidHomeCountry("KR"), true);
    assert.equal(isValidHomeCountry("kr"), false);
    assert.equal(isValidHomeCountry("XX"), false);
    assert.equal(isValidHomeCountry(null), false);
  });
});

describe("30일 제한", () => {
  it("처음은 언제든, 바꾼 뒤 30일 동안 잠김", () => {
    const now = 100 * DAY;
    assert.equal(homeCountryChangeBlockedUntilMs(null, now), null);
    assert.equal(homeCountryChangeBlockedUntilMs(now - DAY, now), now + 29 * DAY);
    assert.equal(homeCountryChangeBlockedUntilMs(now - 31 * DAY, now), null);
  });
});

describe("화면 연결 계약", () => {
  it("가입 카드: 닉네임과 국가가 한 줄(같은 묶음)이고 국가는 필수", () => {
    const card = read("../../src/components/auth/SignUpNicknameCard.tsx");
    assert.match(card, /signup-nickname__pair[\s\S]*signup-nickname-input[\s\S]*HomeCountrySelect[\s\S]*signup-nickname__pair-help/);
    assert.match(card, /homeCountry == null[\s\S]{0,80}국가를 골라 주세요/);
    const css = read("../../src/components/auth/SignUpNicknameCard.css");
    assert.match(css, /\.signup-nickname__pair \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  });
  it("프로필 수정: 게스트 줄 없음, 고른 적 있을 때만 저장, 잠김이면 끔", () => {
    const sheet = read("../../src/components/ProfileEditSheet.tsx");
    assert.match(sheet, /!isGuest && \([\s\S]{0,200}국가/);
    assert.match(sheet, /countryTouched && homeCountry != null/);
    assert.match(sheet, /disabled=\{saving \|\| countryLockedUntilMs != null\}/);
  });
  it("국가 확인 카드: 정식 계정·국가 없음·대기 화면에서만", () => {
    const app = read("../../src/App.tsx");
    assert.match(
      app,
      /stage === "idle" && user && !user\.isAnonymous && userTier\.homeCountryLoaded && userTier\.homeCountry == null[\s\S]{0,40}<HomeCountryConfirmCard/,
    );
  });
});
