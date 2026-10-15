# 검수52 — 주행 설정 입력·버튼과 빈 공간 축소

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. Chief가 지명 검색51을 승인하고 첨부 화면의 주행 설정 공간·높은 버튼 축소를 명시 요청했다. 검색은 이미 `ca56e9b`로 커밋돼 중복 커밋하지 않았다. 이번 주행 설정 변경은 `6e89efa`(face-redesign2)로 커밋했다. Developer Cursor Auto session `baaf38a9-4608-43fd-a1b5-91abc3998e80`.

## 변경 범위

- RideSettingsSheet.css 끝에 24줄 추가만 했다. `.ride-settings-sheet[aria-label="주행 설정"]` 아래로 한정해 공용 스타일 사용처를 보존했다.
- 체중 입력과 강도 버튼 3개의 height/min-height를 **22px**로 설정하고 세로 padding을 제거했다. 기존 프로필의 같은 크기를 참고한, 이번 Chief 지시에 따른 주행 설정 한정 예외다. 공간밀도 원칙에도 이 예외를 기록했다.
- 패널 폭 상한32→26rem, padding과 제목/본문/그룹 간격을 줄였다. 글자 크기·문구·설명·체크박스와 기존 선택/저장 정책은 유지했다. 임의 고정 높이나 설명 숨김은 없다.
- TSX·칼로리 계산·센서·검색·지도·펄스·다음 주행 카드 변경은 없다. 원본 CSS prefix가 동일하며 앱 diff는 CSS 한 파일뿐이다.

## 실행 증거

- `node document/ops/20261013-face-redesign2/settings-52-qa.cjs`: exit0. 실제 RideSettingsSheet/Panel, 지도 없는 index fixture, 기존5013·browser 1개/page 1개로 순차 검증했다. [결과](settings-52-results.json) · [740 전](settings-52-740-before.png) · [740 후](settings-52-740.png) · [1020 전](settings-52-1020-before.png) · [1020 후](settings-52-1020.png).
- 667×300/740×300/844×390/1020×460/1366×768 × 칼로리 있음/없음·BGM 미설정·고도 로딩 =20상태 PASS. 모든 상태 가로·세로 스크롤0, 화면 안 표시, 본문·폰트·disabled 동일, 입력과 3강도 높이22px 확인, pageerror0.
- 폰 가로 및1020×460: 432×172.58→351×135.72px. 높이 약21%, 패널 면적 약36% 감소. PC:512×192.45→416×152.84px.
- 체중75 입력·강도선택·코칭/TTS/BGM/페이서·Escape/배경 닫기 콜백 PASS. 다른 profile/account용 모의 DOM computed style 전후 동일. 이 검증은 실제 계정/프로필의 전체 기능 시험은 아니다.
- `git diff --check` exit0. 원본 CSS prefix 보존 확인 PASS. 정상 pre-commit 완료. CSS 전용 변경이므로 tsc/전체 suite는 불필요 미실행했다.

실기기 터치·키보드·실주행 전체 e2e는 미검증이다. 첨부 이미지의 물리 픽셀과 CSSviewport를 동일하다고 단정하지 않는다. push/merge/deploy는 하지 않았다. 5013의 주행 설정에서 사용 확인한다. 다음 디자인 후속은 HUD·안내 팝업이며, 이번 보정 확인 전에는 추가 변경하지 않았다.
