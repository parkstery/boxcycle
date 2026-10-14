# 검수50 — 시작 버튼 펄스 2회

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief의 “블링크가 아닌 pulsing으로 2회” 지시에 따라 시작 안내 효과를 변경했다. Developer Cursor Auto, 실제 로그 session `93b8c2d3-eaa2-4b92-8c62-0223859ed159`. 결과50의 session 미확인 표기는 이 로그로 보완한다. 코드 커밋 `81dcce6`(face-redesign2).

## 변경

- RouteDock.css 시작 안내 구간만 수정했다. 900ms 주기·ease-in-out·2회 반복이다.
- 배경색과 불투명도는 고정한다. 버튼이 scale 1→1.12→1로 부드럽게 커졌다 돌아오며 광륜이 퍼졌다 사라진다. 색상 점멸은 제거했다.
- 트리거·종료·동일 경로 무재시작·새 경로·접기·disabled 동작은 그대로다. reduced-motion의 1200ms 정적 강조도 유지했다. 다음 주행 카드·지도 설정·주행 설정은 변경하지 않았다.

## 검증

- `node document/ops/20261013-face-redesign2/pulse-50-qa.cjs`: exit0, pageerror0. 실제 RouteDock와 StrictMode, 기존 5013 서버 및 headless browser 1개/page 1개를 사용했다. [결과](pulse-50-results.json) · [최고점 캡처](pulse-50.png).
- 실제 Web Animation의 duration900/iterations2, 일정한 배경색·불투명도, scale 복귀와 광륜 변화를 확인했다.
- 667×300·740×300·844×390·1366×768의 최고점에서 인접 버튼 겹침이 없고 화면 안에 표시된다. 레이아웃 크기는 유지되며 효과 종료 후 전후 버튼 위치·크기·font가 동일하다.
- 종료, 동일 경로/센서 재렌더 무재시작, 새 경로·로딩 완료·disabled, 접기 시 종료/재펼침 무재시작, 새 경로 시 펼침, 시작/재개 콜백, reduced-motion 정적 강조를 통과했다.
- `node scripts/ride-verify/verify-selectors.mjs`: 진입 계약 15단계 PASS. `git diff --check`: exit0. 정상 pre-commit 완료. CSS 전용 변경으로 tsc/전체 suite는 미실행했다.
- 첫 fixture 실행은 기준 CSS의 저장 위치 차이로 ENOENT 실패했다. 이미 보존된 원본을 canonical ops 경로에 복사해 재실행했고 최종 PASS를 확인했다. 실패를 통과로 보고하지 않는다.

실기기 터치·실주행 전체 e2e는 미검증이다. push/merge/deploy는 하지 않았다. 5013에서 경로 설정 후 시작 버튼 펄스 2회를 사용 확인한다. 지도 설정49는 기존 확인 대기 상태를 유지하고, 디자인 후속은 지명 검색이다.
