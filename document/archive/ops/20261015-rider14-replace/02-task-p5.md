# 지시 P5 — rider14 성능 측정 (P0 와 같은 조건)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — **Cursor Agent CLI** |
| 선행 | P4 Chief 승인 (2026-10-15 완료) |
| 기준선 | [04-review-p0.md](04-review-p0.md) — Supervisor 재측정값 |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p5.md` |

## 0. 교차 확인 (P3 감리 조건)

P3 동등성 시험 본체는 Supervisor 가 대행 작성했다. Developer 가 **시험 파일을 수정하지 않고** `npm run test:rider-preserve`(PowerShell)를 실행해 [03-result-p3.md](03-result-p3.md) 표(다리 최대 7.92–7.97e-6 m, 법선 최대 1.1118°, 중앙값 0.3623°, 강체 0)가 재현되는지 적는다. 시험 코드에서 문제를 발견하면 고치지 말고 보고한다.

## 실행기 수정 (최소)

`rider-perf-bench.run.mjs` 에 환경변수 두 개만 추가한다:
- `RTW_BENCH_OUT` — 출력 폴더 이름(기본 `p0`). 예 `p5-rider14`, `p5-s5`.
- `RTW_BENCH_MODEL` — 있으면 페이지 URL 에 `&riderModel=<값>` 을 붙인다.
기본값일 때 동작은 지금과 바이트 단위로 같은 URL·같은 폴더여야 한다.

## 측정

`RTW_BENCH_BASE=http://localhost:5040`(Supervisor 가 띄워 둔 서버 — 새로 띄우거나 끄지 않음), 단독 실행(다른 측정·빌드·브라우저 동시 실행 금지), GPU 기본 경로. 실행기가 SwiftShader 로 넘어가면 그 회차는 무효로 기록하고 다시 잰다. 각 회차는 포그라운드로 끝까지 기다린다(합계 약 40분).

1. `RTW_BENCH_OUT=p5-rider14 RTW_BENCH_MODEL=rider14` — 4줌 전체
2. 같은 세션에서 바로 `RTW_BENCH_OUT=p5-s5 RTW_BENCH_MODEL=s5` — 4줌 전체 (P0 이후 코드 변경(P2a/b)이 s5 성능을 바꾸지 않았는지 대조)
3. 순서 효과를 줄이려고 1을 한 번 더(`p5-rider14-b`).

## 판정 표 (결과 파일에)

| 지표 | P0 (s5, 기준) | P5 s5 | P5 rider14 (a/b) | G5 기준 |
|---|---|---|---|---|
| 1명당 드로우콜 | 213 | | | ≤ 14 |
| 1명당 삼각형 | 53,514 | | | ≈ 29,604 |
| ms/rider z22 · z19 · z17 · z15 | 1.45 · 1.78 · 0.75 · 0.66 | | | P0 대비 감소 |
| 자산 전송 합계 | 1,983,526 B | | | ≤ 500,000 B |
| 첫 표시 중앙값 | 3,309 ms | | | 악화 없음(+10% 이내) |

## 결과 파일 `03-result-p5.md`

위 표, 원시 `bench.json` 3개 경로, 실행기 diff, 이상 사항. **스마트폰 실기기 측정은 Supervisor·Chief 가 따로 한다** — 여기서는 하지 않는다.

## 금지

앱 코드 수정, 벤치 페이지 수정, 백그라운드 잔류, commit · push.
