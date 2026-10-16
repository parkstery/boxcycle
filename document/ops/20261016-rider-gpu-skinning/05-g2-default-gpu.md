# G2 — 기본값 gpu 전환

| 항목 | 내용 |
|---|---|
| 결정 | 2026-10-17 Chief — 폰 추가 측정 없이 기본 gpu |
| 수행 | Supervisor (Claude) 직접 — 기본값 한 줄·시험·주석 |

## 근거

- 동등성: 정점 위치 차 ≤ 6e-8 m, 화면 4위상 픽셀 차 0 (G1).
- PC 실측(GTX 1660): 라이더 비용 2.4–2.6 → 0.4 ms/프레임.
- 폰(Adreno 730) 운영 `?skin=gpu` 1회: 정상 동작(`skinMode: gpu`, 자세 비율 13 %, 떨림 0). 폰은 GPU 타이머 미지원이라 fps A/B 는 잡음이 커 결정에 쓰지 않음.
- GPU 추가 부담은 다리 정점 약 4,200 × 라이더 수로 지도 대비 미미.

## 변경

- `riderSkinMode.readRiderSkinModeSearch`: `?skin=cpu` 만 cpu, 그 외 gpu.
- `readRequestedRiderSkinMode`: Node(시험)에서는 cpu — 옵션 없이 만드는 리그(기존 `rider14-equivalence` 등)가 CPU 경로를 그대로 시험.
- 안전장치 그대로: GPU 조건 미달·셰이더 컴파일 실패 시 자동 cpu, `?skin=cpu` 로 즉시 비교·회피.

## 되돌리기

`readRiderSkinModeSearch` 를 `=== "gpu" ? "gpu" : "cpu"` 로 한 줄 복원.
