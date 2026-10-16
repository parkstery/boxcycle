# 지시 F3 — 주행 틱 다이어트 (7–8 ms → ≤ 2 ms)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 작업 위치 | `C:\20.HDev\boxcycle-tick` (브랜치 `perf/ride-tick-diet`, 기준 `main2` `38fc81f`) |
| 결과 파일 | `C:\20.HDev\boxcycle-tick\document\ops\20261016-ride-tick-diet\03-result-f3.md` |
| 참고 | `document/ops/20261016-frame-breakdown/04-review-f2.md`, perflab `breakdown`(`lib/debug/frameBreakdownProbe.ts`) |

## 실측 (운영 perflab, 라이더 3명, 원거리 LOD2)

| 틱 구간 | PC ms | 폰 ms |
|---|---:|---:|
| 전체 | 6.64 | 7.79 |
| sync (`syncRiderPreservedModels`/GLB sync) | 2.00 | 2.02 |
| markers (동행 DOM 마커) | 1.48 | 1.84 |
| spec (라이더 spec 생성) | 1.43 | 1.47 |
| camera (`tickRideCameraFollow`) | 1.02 | 1.84 |
| self · peer · pacer · nametag | 0.43 · 0.13 · 0.09 · 0.05 | 0.33 · 0.09 · 0.09 · 0.10 |

지도 렌더 JS 7.6 ms, GPU 3.5 ms(PC). 메인 스레드 JS 가 병목이다. 라이더 3명에 틱 7 ms 는 과하다.

## 할 일

1. **원인 측정 먼저**: 각 구간 안에서 무엇이 시간을 먹는지 Node 마이크로벤치(실제 입문 코스 경로 크기 — 예: 폰델파크 2 km 의 꼭짓점 수 — 와 같은 합성 경로) 또는 perflab 세분 표시로 확인. Supervisor 가설:
   - H1 **경로 검색 O(N)**: `getPointOnRouteByDistance`·`smoothedRoutePoint`(구간 평균)·`smoothedHeadingAtRouteDistanceMeters`·`lineStringLengthMeters`·`distanceOnRouteByProjectedPoint` 가 호출마다 경로 전체를 처음부터 훑고, 라이더·프레임마다 여러 번 불린다.
   - H2 **마커 DOM 쓰기**: 값이 같아도 매 프레임 `setLngLat`/style/transform 을 쓴다.
   - H3 **sync**: `syncRiderPreservedModels` 가 매 프레임 배열·객체 재생성, 비교, `triggerRepaint` 를 무겁게 한다.
   - H4 **카메라**: 경로 검색·`map.jumpTo`/`easeTo` 호출 비용.
2. **고치기**:
   - 경로 기하에 대해 **누적거리 색인(Float64Array)을 한 번 만들어 캐시**(geometry 객체 WeakMap 키)하고, 거리→선분은 **이진 탐색**. 구간 평균은 색인으로 겹치는 선분만 순회. 같은 프레임 같은 (geometry, d) 반복 호출은 캐시 재사용 가능. 반환값은 지금과 **수치상 같아야** 한다(시험으로 기존 구현과 1e-9 비교).
   - 마커: 직전 값과 같으면 DOM 을 건드리지 않기.
   - sync·spec·camera: 측정 결과에 따라 불필요한 재생성·중복 계산 제거. **동작(위치·방향·카메라 움직임)은 바꾸지 않는다.**
3. 목표: perflab 틱 **≤ 2 ms**(PC 기준 — 헤드리스로 같은 시나리오 전후 비교), 각 구간 전후 표.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` 미지정 lib 0**(새 lib 파일은 `apps/web/dep-layers.json` 등록), `npm run test:quick`(worktree route 3건 `functions/lib` 부재 외 0), `npm run test:peer-spacing`, `npm run test:pacer`, `npm run test:rider-preserve`, `npm run build`. 신규: 색인 검색 = 기존 선형 검색(무작위 거리 1만 개, 1e-9), 마이크로벤치 전후 수치. 데스크톱 헤드리스 perflab 1회(dev 5070, 브라우저 1개, 끝나면 종료)로 틱 전후.

## 금지

라이더·카메라·동행·페이서의 **화면 결과 변경**, 동기화 정책 변경, 기존 시험 완화, commit · push · 배포, 백그라운드 잔류.
