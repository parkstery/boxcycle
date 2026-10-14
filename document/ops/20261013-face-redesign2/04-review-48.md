# 검수48 — PC 카메라 행 보정 필요(REWORK)

2026-10-15 지시48 실제CSSdiff는허용한MapViewSheet.css끝17줄만추가. 폰3viewport의지도설정상태는통과했으나 `node document/ops/20261013-face-redesign2/map-settings-48-qa.cjs`가PC1366×768의카메라행overflow에서exit1. 기존CSS8px→48수정후2px(개선이지만기준미달). panel전체overflow는0이며버튼/font크기는전후동일. 실패를PASS로간주하지않음.

해결: 창폭/버튼/font를바꾸지않고inline칩간격0.24rem→0.2rem(8버튼사이합계4.48px확보)만보정. [재지시49](02-task-49.md)로Cursor별도지시. 이후전체24상태·모든콜백·overflow0재검증. 최종판정은[감리49](04-review-49.md).
