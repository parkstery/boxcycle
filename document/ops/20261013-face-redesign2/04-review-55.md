# 검수55 — 시작 인증 카드

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. 주행설정54 Chief승인·93d9284 커밋 확인 후 다음 가입/인증의 첫 진입 카드를 진행했다. Developer Cursor Auto session `9081f252-9f15-4d0a-b325-f9854f17bd64`. 앱 코드 `9c8a761`(face-redesign2).

- GuestEntryCard.css 끝6줄만 추가. 카드/제목/설명 여백 축소, safe-area 패딩·max-height·overflow:auto로 짧은 화면과 장문 안내의 접근을 보완했다. 폭 상한·문구·폰트·버튼 높이/패딩·인증 함수·busy 정책·TSX는 불변이다. 버튼 폭은 카드 내부 패딩 감소에 따라 자연 확장된다.
- `node scripts/ride-verify/verify-selectors.mjs`: exit0,15단계 PASS.
- `node document/ops/20261013-face-redesign2/guest-55-qa.cjs`: exit0. 실제GuestEntryCard/AuthGoogleMark, App.css/index/tokens/theme, 기존5013·지도없는 fixture·headless browser1/page1. [JSON](guest-55-results.json) · [캡처](guest-55.png).
- 667×300/740×300/844×390/1366×768/740×180 × 기본/busy/notice/긴error/둘다=25상태 PASS. 문구/font/버튼높이·padding·disabled 보존,가로overflow0·카드viewport내표시. 긴안내의마지막행과버튼스크롤접근 PASS. 시작/Google콜백 각각20회,pageerror0.
- 폰 기본297×205.48→297×176.45px(높이약14%감소). PC352×242.80→352×208.39px. 높이180 근사화면에서는 기존카드205.48px가viewport를넘었고,최종162.47px 카드내14px스크롤로접근한다.
- `git diff --check` exit0,정상pre-commit완료. CSS만변경해tsc/전체suite불필요미실행. 다른앱파일변경없음.

실제익명/Google인증·실기기키보드·실주행은미검증이다. 740×180은키보드로줄어든가용높이의근사일뿐실제키보드시험이아니다. push/merge/deploy없음. 5013 최초시작카드사용확인;사용자확인을위해기존로그인상태를강제로해제하지않았다. 다음은Google로그인/닉네임등록카드다. 주행설정54승인은기록하며해당코드변경없음.
