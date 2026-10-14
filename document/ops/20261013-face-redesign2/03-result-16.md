# 결과16 — 지정문구·주소 폰트 축소

- LocalFirstEntryCard.css: `.local-first__card:has(> .local-first__title) > .local-first__title` font-size `calc(1em - 1pt)` → `calc(1em - 2pt)` (지시15 대비 1pt 추가 감소)
- MapView.css: `.map-view__pick-address` font-size `0.82rem` → `calc(0.82rem - 2pt)`
- 금지영역 미변경: 좌표/고도 작은문구, 창제목, 버튼, Ready카드·지도주소레이블, 높이/색/배치/TSX/로직
- 검증: `git diff --check` 1회 통과 (출력 없음)
