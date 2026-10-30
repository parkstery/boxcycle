# 톱니·작은 구름 시안

Chief 10-30: RouteDock 설정 톱니가 찌그러졌다 → 균형 잡힌 톱니로. 지도 선택·확대·축소 구름이 뾰족하다 → 계정 구름처럼 둥글게. 시안 먼저.

Claude Code 직접 제작·구현. Chief 「제안 수용」 후 구현, 구현 중 추가 지시 「RouteDock 접기 버튼은 캐럿만」 함께 반영.

- 구름이 뾰족한 원인: `CloudMapControls.css` 의 구름 한 장(120×32 비율, 혹 7개)을 `mask-size:100% 100%` 로 32px 정사각 버튼에 눌러 넣음 → 가로 1/3.75 압축. 제안: 작은 세 버튼 전용 정사각 구름(원 7개 합집합, blur .5). 계정·카메라는 기존 넓은 구름 유지.
- 톱니가 찌그러진 원인 ①: 폭 700px 이하에서 `.route-dock__tool` 이 26×30px → 접힘 상태 흰 원 바탕이 세로 타원. ② 손으로 그린 6이빨 경로. 제안: ≤700px 26×26 정원·톱니 20px, 경로는 `gen-gear.mjs` 로 계산한 8이빨 균등 톱니.
- 그림: `mockup.png`(원본 `mockup.html`).
- 승인되면: CloudMapControls.css 작은 구름 변수 추가, RouteDock.tsx 톱니 경로·RouteDock.css ≤700px 높이, 고정 목록 56·42 갱신, toolbar-trail-style·route-dock-tools e2e 확인 후 커밋·푸시·배포.

## 구현 결과 (10-30, Claude Code)

- 파일: CloudMapControls.css(`--map-control-cloud-sm`)·RouteDock.tsx(톱니 경로)·RouteDock.css(≤700px 26×26·20px)·RouteOverviewFoldToggle.tsx(펼침=캐럿만, 두 종류 공통)·e2e route-dock-tools·toolbar-trail-style·고정59.
- 검증: tsc 0·eslint 0. toolbar-trail-style·route-dock-tools·address-minimap-width·sensor-dock 35/36(남은 1 = sensor-dock 종료 후 펼침, 기존 실패). ui-800x360 20/23(남은 3 = 시작·센서·접기·고정14·목록11, 기존 실패와 같음). 사보타주: 높이 26 제거·작은 구름 제거 시 새 계약 5건 실패 확인 후 원복.
- 캡처: `evidence/closed-*.png`(접힘: 구름·톱니), `evidence/open-*.png`(펼침: 캐럿) 800×360·699×273, `capture.mjs` 로 재현.
