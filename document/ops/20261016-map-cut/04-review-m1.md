# 감리 M1 — 지도 구성 측정 스위치

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark**(한도 없음) |
| 판정 | **APPROVED** — 측정 도구만, Chief 지시("끝나면 배포해")로 병합·운영 배포 |

- 미니맵은 별도 Map 이 아니라 정지 지도 이미지 1장 + SVG → 이중 렌더 아님(가설 기각).
- `?mapcut=terrain,buildings,labels,poi,sky,minimap,roads`: 쿼리 있을 때만, 앱 레이어(`boxcycle-`/`route`/`distance-`/`debug-`) 제외를 시험으로 고정, 쿼리 없으면 지도 호출 0. `style.load`·3D 토글 뒤 재적용.
- 헤드리스는 대기 화면(주행 아님)이라 지형·건물·미니맵 효과가 안 잡힘, 개별 키 차이 오차 범위 → **실기기 주행 중 비교가 판단 근거**. 스타일은 98 레이어(line 73, symbol 20).
- 검증: tsc 0, check-dep 미지정 0(M0 는 기존 `functions/lib` 부재 — stash 대조로 입증), test:quick worktree 3건 외 0(map 91/0, 신규 15), rider-preserve 44+6, build 0.
