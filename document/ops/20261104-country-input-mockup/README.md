# 국가 입력 시안 (G3-2 선행)

작성 2026-11-04 Supervisor Claude Code(Opus 5.5) 직접 · 상태: **A안 승인(11-04)·구현·미배포** · 근거 [00-plan](../20261103-global-geo-data/00-plan.md) §4.2·D13·D15(Q3·Q4)

Chief 11-04 「시안 먼저 보자」.

## 무엇을 보나

`mockup.png` 한 장(폰 가로 800×360, 주황 점선 = 새로 넣는 곳). 원본 `mockup.html`은 **앱 CSS 파일을 그대로 읽어** 그린다(가입 카드·프로필 수정 창 모양이 실제와 같다). 재현: (apps/web) `node ../../document/ops/20261104-country-input-mockup/capture.mjs` — 각 화면 `a0·a·a2·b·c-800x360.png`·`-699x273.png`.

| 화면 | 내용 | 실측(800×360) |
|---|---|---|
| 현재(a0) | 지금 가입 카드 | 카드 315px, 스크롤 없음 |
| **A안(a2, 추천)** | 닉네임과 국가를 **한 줄에 반씩**. 아래 한 줄 설명 | 339px, 스크롤 없음 |
| B안(a) | 닉네임 아래 「국가 [선택]」 줄 따로 | 32px 넘쳐 스크롤 |
| 프로필 수정(b) | 닉네임 줄과 같은 꼴의 「국가」 줄. 30일 잠김이면 끄고 날짜 안내 | 247px |
| 기존 Google(c) | 다음 접속 때 한 번 「국가 확인」 카드 | 186px |

공통: 국가는 기기 시간대(IANA `zone1970.tab`)로 미리 고른다. 이름은 화면 언어로 표시(`Intl.DisplayNames`), 저장은 ISO 2글자(`users/{uid}.homeCountry`)·`homeCountryChangedAt`. 게스트는 묻지 않는다(프로필 줄도 없음). 선택 상자 높이 44px(공간밀도 원칙 터치 하한).

699×273(작은 폰)에서는 **현재 카드도 이미 57px 스크롤**된다. A안 81px, B안 119px.

## Chief 결정

1. A안(한 줄) / B안(따로 줄)
2. 기존 Google 사용자 카드에 「나중에」를 둘까 — 두면 확인 전까지 전세계 순위에만 들어가고 다음 접속에 다시 묻는다. 빼면 확인해야 지도로 들어간다
3. 설명 문구(「국가 = 지역 순위 기준 · 기기 시간대로 골랐어요 · 30일에 한 번 변경」)

승인되면: 가입 카드·프로필 수정·확인 카드 구현, Rules(`homeCountry` 형식·30일 제한), 고정 목록 표 갱신, e2e. 그 뒤 G3-2 국가 범위 순위.

## Chief 결정 (11-04)

「A안으로 하자. 모든 창, 패널, 버튼은 가독성과 편의성을 고려하되 배경맵을 가리는 면적을 최소화하도록 디자인하라. 불필요한 긴 설명을 자제하고 간단한 문구로 내용을 전달하라. 그런 차원에서 2줄을 쓰지 않기 위해 아이디와 국가를 한 줄에 넣는 것이다.」
- 원칙은 [공간밀도 원칙](../../reference/product/260924-RTW-UI-공간밀도-원칙.md) 개정 이력·[결정 로그](../../260707-RTW-결정-로그.md)·고정75에 남겼다.
- 결정 2(「나중에」)·3(문구)은 원칙을 따라 Supervisor가 정했다: 확인 카드는 「확인」 하나(미리 채워 대개 한 번이면 끝, 「나중에」는 매 접속 다시 묻는 방해가 된다). 문구는 더 짧게.

## 구현 결과 (11-04, Claude Code 클라우드 세션 직접 · 미배포)

| 바뀐 것 | 파일 |
|---|---|
| 시간대→국가 표(시간대 542·국가 247, tzdata 2026e, 옛 이름 링크 포함) | `apps/web/scripts/identity/gen-home-country-zones.mjs` → `src/lib/identity/homeCountryZones.ts` |
| 국가 모듈(미리 채우기·목록·30일) | `src/lib/identity/homeCountry.ts` |
| 저장 `saveHomeCountry`(같으면 안 씀) · 구독 `homeCountry`·`homeCountryChangedAtMs`·`homeCountryLoaded` | `lib/identity/repo/firestoreUser.ts` · `hooks/useUserTier.ts` |
| 가입 카드 A안 · 국가 선택 상자 · 국가 확인 카드 | `components/auth/SignUpNicknameCard.*` · `HomeCountrySelect.tsx` · `HomeCountryConfirmCard.tsx` |
| 프로필 수정 국가 줄(고른 적 있을 때만 저장, 잠김이면 끔, 설명은 잠겼을 때만) | `components/ProfileEditSheet.tsx` |
| Rules: 정식 계정만·대문자 2글자·변경 시각=요청 시각·30일·시각만 고치기 금지 | `firestore.rules` users |

가입 순서: 국가 저장 → 닉네임 확정. 국가 저장이 실패해도 가입은 진행되고, 국가가 없으면 대기 화면에서 확인 카드가 묻는다.

검증: web tsc 0, eslint 0(경고는 기존), 단위 `home-country.test.ts` 8/8, Rules 에뮬레이터 `npm run test:home-country:rules` 11/11(사보타주: 30일 조건 제거 → H2 FAIL). 실제 컴포넌트 렌더(임시 화면, 삭제) `impl-*.png`: 가입 카드 800×360 343px 스크롤 없음(699×273은 85px — 현재 카드도 57px), 프로필 699×273 2px 스크롤은 국가 줄 없이도 같음(기존).

배포: Rules(`firestore:rules`) + Hosting. Rules 먼저 — 앱이 먼저 오르면 국가 저장이 거절되고(가입은 진행) 확인 카드가 남는다. 남은 것: G3-2 순위가 `homeCountry`를 읽기.

## 후속 (11-04 Chief 「내 국가도 확인할 수 있도록 해」)

- 사용자 정보 창 이름 아래 줄(지금 이메일 자리)에 `대한민국 · 이메일`로 보인다 — 줄을 늘리지 않는다. 게스트는 그대로 「게스트로 이용 중」. 바꾸기는 프로필 수정.
- 국가 이름 함수 `homeCountryLabel` 을 순위 범위 버튼과 함께 쓴다. 시험: `home-country.test.ts` 10/10, `leaderboard-scope` e2e 3/3.
