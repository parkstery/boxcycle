# 검수 01 — 경로 생성 팝업

Supervisor: Codex. 날짜 2026-10-13. Chief 화면 확인 전 다음 패널 진행 금지.

## 독립 확인 증거

- 대상 worktree face-redesign2, 기준 e3c4fcc. 앱 코드 변경 대상 MapView.css의 경로 생성 팝업 전용 셀렉터. 공통 테마/다른 패널/TSX 변경 없음.
- 실제 앱 http://127.0.0.1:5013 에서 Guest 진입 → 지도 지점 클릭 → Start 선택 → 거리 체크 동작 확인. 거리 체크 후 stepEnabled=true. 기능 범위 밖 주행/배포 없음.
- 800×360 및 667×300에서 같은 실제 앱 상태에 git show e3c4fcc:apps/web/src/components/map/MapView.css를 브라우저 style로 임시 덮어써 원본을 비교. 이는 목업/fixture가 아니라 동일 실행 DOM의 컬러 전후 비교. 원본 style 제거 후 변경본 캡처.
- 팝업 및 자식 57개 요소의 tag/class/x/y/width/height/scrollWidth/scrollHeight 모두 전후 동일. 800×360 패널 x591/y140/w201.25/h212.40000915527344. 667×300 패널 x235.5/y80/w224.84375/h212.
- 원본·변경 CSS의 색상 리터럴/currentColor를 제외한 텍스트 동일 검사를 독립 확인. 색상 외 속성 변경 0.
- 독립 실행: apps/web cwd에서 node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false → exit 0.
- 실제 스크린샷 시각 확인: 흰 패널, 짙은 제목/주소, 파란 Start/End/선택 이동수단, 중립색 보조 버튼. 센서 HUD 등 팝업 밖 기존 색 유지.
- 증거: before-800x360.png / after-800x360.png / before-667x300.png / after-667x300.png (이 검수와 같은 폴더).
- 실기기 Bluetooth·터치 체감은 미검증. PC Chromium 모바일 viewport 검증이며 실기기 합격 주장 없음.

판정: REWORK_REQUIRED. 구조 보존·일반 화면은 통과하나, 선택된 이동수단 hover에서 background rgb(239,246,255) / color rgb(255,255,255)로 흰 아이콘이 흐려짐을 실제 앱에서 독립 재현했다. 기존 hover 규칙 specificity가 active 규칙보다 높다. 이 상태를 PASS로 처리하지 않는다. [재지시 02](02-task-02.md)로 색상만 보정 후 재검수한다.
