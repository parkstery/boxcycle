# 감리23 — 퍼블릭 목록 1차

2026-10-14 Supervisor Codex. REWORK_REQUIRED(헤더 예약폭 마감). Muse 지시23 구현 CSS 한 파일100줄append,base/TSX불변. tsc/diff exit0. 740에서20단순행은완전표시3→5,목록/검색/정렬/닫기겹침없음,11상태밀도검증진행.

QA 기능검증의distance순서기대값을오름차순으로잘못작성해assert실패. 실제SoT routeListSort.ts는긴거리우선,앱변경없음. harness기대값을distance19/name00/recent19로정정. [초기JSON](public-23-shots/results-initial-23.json)에부분결과보존,이를전체PASS로보고하지않음.

740헤더실측검색오른쪽495.11/정렬왼쪽540.14로빈간격45.03px. 예약margin9rem이실제정렬폭76.47px보다과대. [재지시24](02-task-24.md)로이한선언만6.5rem으로조정. 다른CSS/state/동작보존. 모델세션은실행로그23에서기록.
