# 순위 범위 선택 시안 (G3-2 화면)

작성 2026-11-04 Supervisor Claude Code(Opus 5.5) 직접 · 상태: **A안 승인(11-04)·구현·미배포** · 서버 [00-plan §4.3.1](../20261103-global-geo-data/00-plan.md)

Chief 11-04 「시안을 만들어 줘」. 원칙(11-04): 지도 가림 최소·짧은 문구.

## 무엇을 보나

`mockup.png`(800×360). **실제 순위 창**(미리보기 `preview.html?state=leaderboard`)을 띄우고 머리줄의 「세계」 자리만 바꿔 그렸다. 재현: `capture.cjs`(맨 위 주석).

| 안 | 내용 | 실측 |
|---|---|---|
| 현재 | 「세계」 글자 | 24px |
| **A안(추천)** | 기간 버튼(「이번 주 ▾」)과 같은 꼴. 누를 때마다 세계 → 아시아 → 대한민국 | 51~75px, 창 크기·줄 수 그대로 |
| B안 | 세 칸 분할 | 158px, 닫기와 37px |

A안 공통 규칙(제안):
- 개척 탭, 국가 없는 사람(게스트 포함)은 ▾ 없이 「세계」 글자만 — 지금과 같다(개척 지역 순위는 도로 기준이라 G5 뒤).
- 이름은 화면 언어(대륙: 아시아·유럽·아프리카·북아메리카·남아메리카·오세아니아·남극, 국가: `Intl.DisplayNames`).
- 마지막으로 고른 범위를 기억한다(기기 저장).
- 미니 순위(지도 위 요약)는 그대로 세계.

## Chief 결정

1. A안 / B안
2. 처음 열 때 범위: 세계(지금과 같음) / 내 국가

## Chief 결정 (11-04)

「A안」. 처음 열 때 범위는 답이 없어 Supervisor가 **세계(지금과 같음) + 마지막 범위 기억**으로 정했다. 고정76.

## 구현 결과 (11-04, Claude Code 클라우드 세션 직접 · 미배포)

- `apps/web/src/components/leaderboard/leaderboardScope.ts`(순환·표시 조건·이름·기기 저장 `rtw.leaderboard.scope`) · `LeaderboardSheet.tsx`(버튼, `homeCountry` 받음) · `App.tsx`(`userTier.homeCountry` 전달) · 미리보기 `scripts/ui-800x360/preview.tsx`(`?country=KR`, 요청 범위를 `body[data-lb-last-scope]`에 남김).
- 대륙 이름은 서버 응답의 `scopeCode`로 정한다(앱에 대륙 표를 두지 않는다). 응답 전에는 「대륙」.
- 시험 `e2e/leaderboard-scope.spec.ts` 3건(800×360·699×273 순환·요청 범위·머리줄 28px·버튼 높이=기간 버튼·닫기와 간격·다시 열면 기억 / 개척 판·국가 없음은 글자만·요청 세계). 사보타주(버튼 조건 끔) → 3 FAIL. 기존 `compact-controls` 순위 시험과 함께 14/14.
- 구현 화면 `impl-country-800x360.png`.
- 배포: Hosting. 서버(`getLeaderboard` 범위 인자)가 먼저 올라가야 한다 — 앱이 먼저면 대륙·국가 요청이 400(세계는 그대로).
