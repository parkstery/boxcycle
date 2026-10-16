# 감리 T2 — 측정·조절 패널 분리

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-17 · Supervisor (Claude) |
| 대상 | [03-result-t2](03-result-t2.md) — Cursor Agent |
| 판정 | **APPROVED** (Supervisor 보정 1건 포함) |

## 확인

- 세 패널 `React.lazy` 분리, 스위치 없으면 청크 요청 0(Developer 헤드리스 확인).
- 창구(`perfLabFacade.ts`)의 `export let` 바인딩 교체 방식 — 꺼진 상태 비용은 빈 함수 1회. 계측 모듈들은 내부에서 다시 `isPerfLabEnabled()` 로 막혀 있어 이중 안전.
- 기본 청크 3,731.24 → **3,692.34 kB**(−39 kB). 기본 청크에 `결과 복사`·`성능 펼치기`·`캠 조절`·`조명 조절판` 없음(Supervisor 재확인).
- 시험 파일 무수정, `tsc -b` 0, eslint 0, `test:rider-preserve` 57 + 6.

## Supervisor 보정

- **회귀**: DEV 빌드에서 쿼리 없이 `installRiderRenderCostProbe` 가 빈 함수로 끝나 `window.__rtwRiderCost` 가 설치되지 않음 → `rider-perf-bench` 페이지(G1 측정에 사용)가 조용히 값을 못 읽게 됨.
- **수정**: 창구가 DEV 빌드에서는 쿼리 없이도 계측 청크를 불러오고(운영 빌드에서는 `import.meta.env.DEV` 가 false 상수라 조건이 `?perflab=1` 만 남음), 청크 도착 전에 온 설치 요청은 기억했다가 도착 후 실행.

## 남은 것

- 효과는 −39 kB(약 1 %)로 작다. 기본 청크 3.7 MB 의 대부분은 지도·three.js·앱 본체 — 번들 크기 자체는 별도 과제.
