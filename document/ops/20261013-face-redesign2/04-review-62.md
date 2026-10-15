# 검수62 — 얇은 단일 캐럿

2026-10-15 Supervisor Codex. APPROVED / Chief 확인 대기. 추천1 적용 요청에 따라 Cursor 교대 구현. mapPopupElements.ts 캐럿SVG와 관련주석만 변경, CSS/기능/펄스/다음주행카드 불변.

단일 path12×6px, stroke1.5px, 파랑/round 유지, SVG20×14px. 행16.8px유지. 거리보조펼침은아래/접기는위, 위치보조펼침은위/접기는아래로기존방향규칙보존.

`node document/ops/20261013-face-redesign2/pick-62-qa.cjs` exit0: 실제 buildPickPopup DOM48상태,667×300/740×300/844×390/1366×768. 모든상태path1개/stroke1.5/viewBox/아이콘20×14/방향·행높이16.796875(CSS반올림)/overflow0 확인. 기존접기펼치기·Enter/Space·목표거리값보존·수단·삭제·phase/차단상태콜백PASS. 740-distance스크린샷전후시각확인, 더단순한단일캐럿·기존배치유지.

`npx eslint src/components/map/mapPopupElements.ts` exit0, `npx tsc -b --pretty false` exit0, `git diff --check -- apps/web/src/components/map/mapPopupElements.ts` exit0. 실기기/실지도미검증. 서버5013재사용,main스크립트차단fixture. merge/push/deploy없음.

코드커밋 d9071d7 style(route): use thin single disclosure chevrons.

