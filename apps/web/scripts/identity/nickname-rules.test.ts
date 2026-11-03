/**
 * 닉네임 규칙 (2026-11-03 Chief: 15자까지, 특수 문자는 `-` `_` 만).
 * 앱(nickname.ts)과 서버(firestore.rules)가 같은 규칙이어야 한다 — 한쪽만 넓히면 앱은 받고 서버가 거절한다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isValidNickname,
  isValidNicknameKeyNormalized,
  NICKNAME_MAX_LENGTH,
  normalizeNicknameKey,
} from "../../src/lib/identity/nickname.ts";

test("4~15자, 영문 시작, 영문·숫자·-·_ 만", () => {
  for (const ok of ["Abcd", "ride_man", "ride-man", "R1d3r", "a_-_", "Abcdefghijklmno", "spin-atlas_01"]) {
    assert.equal(isValidNickname(ok), true, ok);
    assert.equal(isValidNicknameKeyNormalized(normalizeNicknameKey(ok)), true, `key ${ok}`);
  }
  for (const bad of [
    "abc", // 3자
    "Abcdefghijklmnop", // 16자
    "_ride", // 영문 시작 아님
    "-ride",
    "1ride",
    "ride man", // 공백
    "ride.man",
    "ride@man",
    "ride!man",
    "라이더abc",
    "idengoodeg@gmail.com",
  ]) {
    assert.equal(isValidNickname(bad), false, bad);
  }
  assert.equal(NICKNAME_MAX_LENGTH, 15);
});

test("firestore.rules 의 닉네임 키 규칙이 앱과 같다", () => {
  const rules = readFileSync(fileURLToPath(new URL("../../../../firestore.rules", import.meta.url)), "utf8");
  const patterns = [...rules.matchAll(/matches\('(\^\[a-z\][^']*)'\)/g)].map((m) => m[1]);
  assert.equal(patterns.length, 2, "users.nicknameKey 와 nicknames/{key} 두 곳");
  for (const p of patterns) {
    assert.equal(p, "^[a-z][a-z0-9_-]{3,14}$");
    const re = new RegExp(p);
    for (const key of ["abcd", "ride_man", "ride-man", "abcdefghijklmno"]) assert.equal(re.test(key), true, key);
    for (const key of ["abc", "abcdefghijklmnop", "_ride", "ride.man"]) assert.equal(re.test(key), false, key);
  }
});
