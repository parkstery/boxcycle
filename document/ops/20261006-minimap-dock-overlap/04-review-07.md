# 검수 07 — PC 미니맵·RouteDock 겹침

- Supervisor: Claude · 판정: **APPROVED**

| 항목 | 판정 | 근거 |
|---|---|---|
| before 재현 | PASS | PC 3종 overlap 65.3px, 폰 0.8px — Chief 현상과 일치 |
| 원인 | PASS | `RouteMinimap.tsx` 가 접힘 dock top 만 기억 → 주행 중 펼침 기본이라 ref null → CSS 폴백(3.4rem) 이 펼친 dock 보다 낮음 |
| after | PASS | 4 뷰포트 모두 overlap 0 · gap 8px, 미니맵 크기 불변, TL 겹침 0. 캡처 1280×720 직접 확인 |
| 접힘/펼침 추적 | PASS | 펼침 gap 8 → 접힘 gap 8 → 재펼침 원위치 |
| tsc · eslint · menu-a | PASS | 결과 07 |

- 정책 변화(수용): 20260923-minimap 지시06 「dock 펼침 때 미니맵 위치 고정」 → 이제 dock 높이를 따라 움직인다. Chief 요구(겹치지 않게)가 우선.
- 폰 가로는 8.8px 위로 이동(간격 확보) — 의도된 차이.
