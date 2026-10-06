# 검수 06 — 시계 우하단 · 맵 스타일/줌 상시

- Supervisor: Claude · 판정: **REWORK_REQUIRED** (→ [지시 06-2](02-task-06b.md))

| 항목 | 판정 | 근거 |
|---|---|---|
| 1000×640 idle/riding 배치·시계 우하단 | PASS | 캡처 직접 확인 |
| 690 idle `[야외 − +][계정]`, 시계 우하단 | PASS | 캡처 |
| idle ± 지도 줌 | PASS | before/after 캡처·계측 |
| **690 riding — TR 줄이 상단 계기판(새 도로 칸)을 가림** | **FAIL** | 캡처 `690x275-riding.png`: 카메라 「1」 이 「새 도로 +0.00」 위. 결과의 overflow=false 는 TR 컨테이너 내부만 잼 — 계기판과의 교차를 재지 않았다 |
| tsc | 정정 | 결과의 「기존 tsc 2건」은 c641497·b2379e9 의 실제 오류. `tsc --noEmit -p .` 가 빈 검사였다. 16e7237 로 수정, `tsc -b` 0 |
