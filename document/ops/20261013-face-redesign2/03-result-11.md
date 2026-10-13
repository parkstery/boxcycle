# 결과11 — 맵 뷰 창 하단 빈 공간 제거

- 변경: `apps/web/src/components/map/MapViewSheet.css` `@media (max-height: 560px)` 내 `.map-view-sheet` `align-items: stretch` → `flex-start` 1선언만 변경. `justify-content: flex-end` 및 패널/컨트롤/폰트/색/TSX/로직 무변경.
- 검증: `git diff --check` 1회 실행, 출력 없음(통과).
- 완료조건 귀속: 800x360/740x300/667x300 확인 및 창 열기·닫기·칩 선택 기능 확인은 Supervisor 담당.
