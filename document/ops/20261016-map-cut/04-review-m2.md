# 감리 M2 — 주행 중 가까운 카메라 글자 숨김 (Chief 결정 A)

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark**(한도 없음) |
| 판정 | **APPROVED** — 병합·운영 배포, 배포 후 Supervisor 실제 GPU 측정 |

- 주행(running/paused) + 줌 ≥ 19 에서만 베이스맵 symbol 숨김, 18.7 미만 복원(히스테리시스), 원래 `none` 유지, 상태 변화 때만 `setLayoutProperty`, `style.load` 재적용, 앱 레이어·DOM 이름표 제외, `?labels=1` 비상 표시. `?mapcut=` 공존.
- 검증: tsc 0, check-dep 미지정 0, test:quick(worktree `functions/lib` 3건 외) — map 102/0(신규 11), rider-preserve 44+6, build 0.

## 배포 후 Supervisor 실측 (운영 index-C6Ocm1hM.js, GTX 1660 실제 GPU, 화면 표시 브라우저, 카메라 2 · 줌 22.2)

| 회차 | 글자 | fps | 프레임 p50 | 지도 JS(라이더 제외) | 틱 | 라이더 | GPU |
|---|---|---:|---:|---:|---:|---:|---:|
| 기본-a | **숨김(자동)** | **71.6** | 11.0 ms | **4.92 ms** | 2.97 | 2.63 | 5.24 |
| `?labels=1`-a | 표시 | 57.1 | 21.5 ms | 7.82 ms | 3.05 | 2.68 | 6.54 |
| 기본-b | **숨김(자동)** | **72.4** | 11.0 ms | **5.00 ms** | 2.90 | 2.63 | 7.23 |
| `?labels=1`-b | 표시 | 57.8 | 21.2 ms | 7.86 ms | 3.06 | 2.66 | 6.33 |

자동 숨김이 동작(`rideLabelsHidden: true`)하고 지도 JS −2.9 ms, fps 57 → 72. 오늘 아침 같은 조건(46 fps, 프레임 21.7 ms, 틱 7.4 ms)과 비교하면 틱 다이어트와 합쳐 약 1.55배. 측정 스크립트: `apps/web/scripts/rider-preserve/.out/mapcut/run-mapcut.mjs`(git 제외).

## Chief 폰 실측 (운영 index-C6Ocm1hM.js, Adreno 730·DPR 3, 카메라 2·줌 21.8)

| | 오후(31 fps 측정) | 지금 |
|---|---:|---:|
| fps | 31.4 | **56.5** |
| 프레임 p50 / p95 | 33.3 / 50 ms | **16.7 / 16.8 ms**(60 Hz 한도) |
| >33 ms | 83% | 4.4% |
| 틱 | 8.7 | 3.4 ms |
| 지도 JS(라이더 제외) | 10.7 | 5.2 ms |
| 대기(GPU·합성) | 10.3 | 6.9 ms |
| 라이더 | 2.1 | 2.2 ms |

`mapPixelRatio` 2·`rideLabelsHidden` true 확인. 폰이 화면 주사율 한도에 도달 → 이 기기에서 추가 성능 작업의 체감 이득은 작다. GPU 스키닝은 계속 보류(동행 인원 증가·저사양 대응 시 재검토).
