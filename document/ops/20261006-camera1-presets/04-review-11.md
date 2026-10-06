# 검수 11 — 카메라 1번 경로전체/500m/20m · 위성 기본

- Supervisor: Claude · 판정: **APPROVED**

| 항목 | 판정 | 근거 |
|---|---|---|
| 순환 routeFit→aerial500→aerial20, 옛 값 → routeFit 이관 | PASS | 결과 11 · 계약 테스트(사보타주 포함) |
| 진입 위성 · 1번 안 토글 존중 · 이탈 복원(토글 시 유지) | PASS | metrics `restoredToBefore: true`, 순수 함수 단위 |
| `tsc -b` 0 · framing 96 pass · menu-a · camera-quick-capture | PASS | 결과 11 |

## 후속
- 690×275 에서 퀵 카메라 칩 hit-test 가 다른 요소에 가려졌다(결과 63행, 촬영은 DOM click). 병행 레이아웃(06-4/12) 영향 의심 — **검수 12 에서 판정**.
- `camera-qc1-200m`·`camera-qc1-hold` 샷 파일명 옛 표기(LIVE 전용).
