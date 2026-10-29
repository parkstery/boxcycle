# 미니맵 접기·펼치기 표시 — 지시

2026-10-29 Chief 직접 요청: 접혀 있을 때 지도 모양만, 펼쳐져 있을 때 캐럿만 표시한다.

- 공통 RouteOverviewFoldToggle의 map 종류에만 조건부 표시 적용·단독 도안을 중앙 정렬.
- 28×28px 버튼·위치·접근성·독립 접힘 유지. RouteDock 표시는 기존 그대로.
- 기존 address-minimap-width 계약에 상태별 도안 확인을 반영하고 가로 화면에서 전환·중앙·경계 확인.
- [결과102](102-result-minimap-fold-icons.md)에 검증 기록. 커밋·푸시·배포 없음.
