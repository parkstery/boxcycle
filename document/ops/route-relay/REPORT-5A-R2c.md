# 5A-R2c 보고 — 도넛 폐기 · 원 하나(반지름 = D)

| 항목 | 값 |
|---|---|
| 지시서 | 260904-5A-R2 작업지시서 (§2 Chief 재작성) |
| 선행 | REPORT-5A-R2b.md · 1e591ab / 29da1e1 |
| 분기 | fix/autoroute-overlap-5a (main2 merge 없음) |
| 결론 | UI 도넛 폐기. 파선 원 하나(반지름=D) + 동적 안내. 서버 hard gate(road < D-5m)·A/C/D 불변. §5.2 분포 R2b와 동일. |


﻿## 1 API
resolveDistanceAutoRouteGuideRadiusKm => D
remove donut/inner

## 2 sec5.2
failed 8 exact 5 offered 11 detoured 0 (same as R2b)

## 3 sec5.3
radius===D; straight>=D never fail; N updates

## 4 sec5.4
[0.9D,1.0D] 24/24 100% 3wp=0; >=D 16/16 3wp=0

## 5 tests
141 pass distance-auto-route; 61 next-ride; replay ok; tsc/build ok

## 6 verify
npm run dev:localhost -> http://127.0.0.1:5000

## 7 open
R1 sec3.4 penalty OOS

