# 검수53 — HUD 중앙 안내 카드

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief 계속 진행에 따라 주행설정52를 보존하고 다음 HUD·안내를 검토했다. Developer Cursor Auto session `5c9aa1fe-ce0b-440e-923c-3935d9532ecc`. 코드 `9bcc219`(face-redesign2).

- MapHud.css 끝에 `.map-hud__mc .hud-action` 한 규칙만 추가했다. padding0.4rem/0.6rem, gap0.3rem으로 중앙 일시정지·경로오류 카드의 바깥 여백을 줄였다. 버튼 크기·글자·문구·앵커·콜백과 계기·코칭 스타일은 그대로다.
- `node scripts/ride-verify/verify-selectors.mjs`: exit0, 진입 셀렉터15단계 PASS.
- `node document/ops/20261013-face-redesign2/hud-53-qa.cjs`: exit0. 실제MapHud 모듈, 지도 없는 fixture, 기존5013·browser1/page1. 667×300/740×300/844×390/1366×768 × 일시정지/짧은오류/긴오류/주행코칭 =16상태 PASS. [결과](hud-53-results.json) · [캡처](hud-53.png).
- 폰 일시정지 카드173.77×72→169.70×62.55px, 높이 약13%·면적 약15% 감소. PC198.25×84.59→193.44×73.39px. 긴 오류도 전체 문구가 화면 안에 표시되고 가로·세로 넘침0이다.
- 전후 본문·버튼 크기/font 동일. 계기·코칭의 rect/text/font/background/text-shadow 동일. 재개/변경/종료/핀초기화 콜백을 각4회 확인했고 pageerror0이다.
- `git diff --check` exit0, 정상 pre-commit 완료. CSS 전용 한 규칙으로 tsc/전체 suite는 불필요 미실행했다. 다른 앱 파일 변경 없음.

실기기/실주행/실지도 배경에서 모든 카메라별 가독성 검증은 미실행이다. 본 검수는 중앙 카드 밀도와 기존 HUD 표시 보존 범위다. 주행 계기·코칭은 이미 배경 없는 기존 방식을 사용하므로 이번에 추가 변경하지 않았다. push/merge/deploy 없음. 5013에서 일시정지 카드를 사용 확인한다. 디자인 후속은 가입·인증 창이다.
