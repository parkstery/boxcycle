/**
 * 인터벌 코칭 음성 = 영어 문구 + 자연스러운 영어 음성 (2026-11-03 Chief).
 * 주행 코칭(useRideCoaching → speakRideText 기본 en-US·pickEnVoice)은 그대로다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { INTERVAL_SPEECH_EN } from "../../src/lib/ride/rideMoments.ts";
import { naturalEnVoiceScore, pickNaturalEnVoice } from "../../src/lib/ride/rideSpeech.ts";

const v = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

test("인터벌 음성 문구는 모두 영어(한글 없음)", () => {
  for (const [k, line] of Object.entries(INTERVAL_SPEECH_EN)) {
    assert.ok(line.trim().length > 0, k);
    assert.doesNotMatch(line, /[가-힣]/, `${k}: ${line}`);
  }
});

test("rideMoments 의 인터벌 이벤트는 speech(영어)를 싣고, useRideMoments 는 speech 를 영어로 읽는다", () => {
  const moments = readFileSync(fileURLToPath(new URL("../../src/lib/ride/rideMoments.ts", import.meta.url)), "utf8");
  for (const kind of ["intervalStart", "intervalHigh", "intervalLow", "intervalRest", "intervalCooldown", "intervalWarn", "intervalComplete"]) {
    const at = moments.indexOf(`kind: "${kind}"`);
    assert.ok(at >= 0, kind);
  }
  const speechLines = moments.match(/speech: [^\n]*INTERVAL_SPEECH_EN\./g) ?? [];
  assert.ok(speechLines.length >= 8, `speech 줄 ${speechLines.length}`);
  const hook = readFileSync(fileURLToPath(new URL("../../src/hooks/useRideMoments.ts", import.meta.url)), "utf8");
  assert.match(hook, /speakIntervalCoachText\(resolved\.event\.speech/);
  assert.doesNotMatch(hook, /"ko-KR"/);
});

test("자연스러운 영어 음성을 고른다 — 브라우저별 고품질 이름이 구식·장난 음성보다 앞", () => {
  // Edge(Windows)
  assert.equal(
    pickNaturalEnVoice([v("Microsoft David - English (United States)", "en-US"), v("Microsoft Heami - Korean", "ko-KR"), v("Microsoft Aria Online (Natural) - English (United States)", "en-US", false)])?.name,
    "Microsoft Aria Online (Natural) - English (United States)",
  );
  // Chrome(데스크톱)
  assert.equal(
    pickNaturalEnVoice([v("Microsoft Zira - English (United States)", "en-US"), v("Google UK English Female", "en-GB", false), v("Google US English", "en-US", false)])?.name,
    "Google US English",
  );
  // Safari(iOS·macOS) — 장난 음성(Albert·Bubbles) 제외, Enhanced 우선
  assert.equal(
    pickNaturalEnVoice([v("Albert", "en-US"), v("Bubbles", "en-US"), v("Fred", "en-US"), v("Samantha", "en-US"), v("Ava (Enhanced)", "en-US")])?.name,
    "Ava (Enhanced)",
  );
  assert.equal(pickNaturalEnVoice([v("Albert", "en-US"), v("Samantha", "en-US")])?.name, "Samantha");
  // Android Chrome — 이름이 언어명뿐이어도 en-US 가 다른 영어보다 앞, eSpeak 은 뒤
  assert.equal(pickNaturalEnVoice([v("eSpeak English", "en-US"), v("English India", "en-IN"), v("English United States", "en_US")])?.name, "English United States");
  // 영어가 없으면 고르지 않는다(브라우저 기본으로 읽음)
  assert.equal(pickNaturalEnVoice([v("Microsoft Heami - Korean", "ko-KR")]), null);
  assert.equal(naturalEnVoiceScore(v("Yuna", "ko-KR")), -Infinity);
});
