# 지시 F2 — 프레임 시간 항목별 분해 (perflab)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 작업 위치 | `C:\20.HDev\boxcycle-frame` (브랜치 `feat/perflab-breakdown`, 기준 `main2` `0c09202`) |
| 결과 파일 | `C:\20.HDev\boxcycle-frame\document\ops\20261016-frame-breakdown\03-result-f2.md` |
| 참고 | `document/ops/20261016-rider-perf/`(F1 perflab), `apps/web/src/lib/debug/perfLab.ts`, `riderRenderCostProbe.ts`, `riderJitterProbe.ts`, `components/perfLab/PerfLabPanel.tsx` |

## 배경 (실측)

운영 `?perflab=1`: PC(GTX 1660) 20–30 ms/프레임(33–53 fps), 폰(Adreno 730, 갤럭시 S22급) 33–50 ms(26–27 fps, 33 ms 초과 99%). 그중 라이더 렌더는 약 3 ms(10%). **나머지 약 27 ms 가 어디인지** 모른다. 앱에 의도적 fps 제한은 없다.

## 만들 것 — `?perflab=1` 에서만, 쿼리 없으면 비용 0 (F1 규칙)

10 s 창에서 프레임당 평균·p95 를 항목별로:

1. **앱 주행 틱 JS**: `MapView` `tickBody` 전체 실행 시간(시작·끝 `performance.now()`), 그 안의 큰 덩어리(본인 샘플·카메라 추종·페이서·동행 step·spec 생성·`syncRiderPreservedModels`·네임태그 마커 갱신)를 따로.
2. **Mapbox 렌더 CPU**: 지도 한 프레임 렌더에 쓰인 JS 시간. 공개 이벤트(`render`, `idle`)와 필요하면 내부 렌더 함수 래핑(perflab 일 때만, 실패해도 앱은 정상) — 구현 방식과 한계를 결과에 적기. 커스텀 라이더 레이어 시간(이미 있음)은 빼서 "지도 자체" 시간도 같이.
3. **React**: perflab 일 때만 루트 근처 `<Profiler>` 로 초당 커밋 수·커밋 시간 합. 주행 중 HUD 등이 매 프레임 다시 그려지는지 보는 것이 목적.
4. **Long Animation Frames**(`PerformanceObserver` type `long-animation-frame`, 지원 시): 10 s 동안 긴 프레임 수, 총 blocking, `styleAndLayoutDuration` 합, **스크립트 출처(sourceURL/함수명)별 시간 상위 5개**.
5. **GPU 시간**(지원 시): WebGL2 `EXT_disjoint_timer_query_webgl2` 로 지도 프레임 GPU 시간 표본(매 프레임 아니고 몇 프레임마다). 미지원이면 "미지원" 표시.
6. **합산 표시**: 프레임 간격 ≈ JS(틱+지도+React+기타 LoAF) + 대기(GPU/컴포지터 추정) 로 한 줄 요약. 패널에 항목별 한 줄씩, 복사 JSON 에 `breakdown` 객체.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` 에서 "미지정 lib 파일 0"**(새 lib 파일은 `apps/web/dep-layers.json` 등록 — `functions/lib` 부재로 인한 M0 실패는 worktree 환경), `npm run test:quick`(route 3건 `functions/lib` 부재 외 0), `npm run test:rider-preserve`, `npm run test:peer-spacing`, `npm run build`. 단위 시험: 집계 함수(평균·p95·상위 N), 쿼리 없으면 모든 훅이 즉시 반환(`performance.now()` 0회).

데스크톱 헤드리스로 한 번(dev 서버 5070, 브라우저 1개, 끝나면 종료): 게스트 → 입문 코스 주행 → 카메라 2 → 10 s 후 복사 JSON 을 결과에 붙이고, 그 수치로 **27 ms 가 어디로 가는지 1차 해석**을 쓴다(헤드리스는 GPU 가 달라 실기기와 다를 수 있음을 명시).

## 금지

쿼리 없는 운영 동작 변경, 앱 로직·렌더 변경(계측 훅만), 서버 전송, commit · push · 배포, 백그라운드 잔류.
