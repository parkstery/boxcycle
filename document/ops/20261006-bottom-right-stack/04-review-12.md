# 검수 12 — 우하단 스택 · 고도/축척 고정

- Supervisor: Claude · 판정: **REWORK_REQUIRED** (→ [12-2](02-task-12b.md))

| 항목 | 판정 | 근거 |
|---|---|---|
| 카드∩시계 0, 카드→시계 8px, 시계→고도/축척 4~5px | PASS | 계측 3폭 |
| 고도 박스 폭 고정(tabular-nums) | PASS | Δw 0 |
| **축척 박스 고정** | **FAIL** | `.mapboxgl-ctrl-scale` 자체를 `width:120px !important` — 막대 길이가 고정되고 라벨만 바뀌어 **축척이 거짓**이 된다(결과 78행이 스스로 한계로 적음). 지시는 「바깥 박스 고정, 막대는 박스 안에서 변함」 |
| **690×275 하단 잘림** | **FAIL** | 캡처 `690x275-riding-zoom.png`: 고도/축척 줄이 화면 아래로 절반 잘림 |
| e2e 단언 교체(card.bottom < clock.top − 8) | 수용 | Chief 요구 우선, 다른 단언 유지 |
| 지시 11 후속: 690 퀵 카메라 칩 hit-test 가림 | 미판정 | 12-2 에서 계측 |
