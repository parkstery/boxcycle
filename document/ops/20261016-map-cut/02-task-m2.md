# 지시 M2 — 주행 중 가까운 카메라에서 지도 글자 숨김 (Chief 결정 A)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-labels` (브랜치 `perf/ride-near-labels`, 기준 `main2` `3cb4b21`) |
| 결과 파일 | `C:\20.HDev\boxcycle-labels\document\ops\20261016-map-cut\03-result-m2.md` |
| 근거 | [04-review-m1.md](04-review-m1.md), Supervisor 실측(아래) |

## 실측 (운영, GTX 1660 실제 GPU, 카메라 2 · 줌 22)

| mapcut | fps | 지도 렌더 JS(라이더 제외) |
|---|---:|---:|
| 없음 | 54–57 | 8.2–8.6 ms |
| terrain / buildings / roads | 56–58 | 7.6–8.0 ms |
| **labels** | **70.5** | **4.9 ms** |

Chief 결정 **A**: 주행 중 **줌 ≥ 19**(라이더 자세를 그리는 가까운 카메라 — `RIDER_POSE_ANIMATION_MIN_ZOOM`, `riderDetailLod.ts`)에서만 **베이스맵 글자(symbol 레이어)** 를 숨긴다. 주행 전·주행 종료 후·줌 < 19 는 지금 그대로.

## 할 일

1. M1 의 `apps/web/src/lib/map/mapCut.ts` 분류(앱 레이어 제외한 `symbol` = labels)를 재사용해, 주행 상태(`running`/`paused`)이고 줌이 기준 이상이면 숨김, 아니면 복원하는 작은 모듈/함수.
   - **히스테리시스**: 줌 ≥ 19.0 에서 숨김, 18.7 미만으로 내려가야 복원(경계에서 깜빡임 방지).
   - **복원은 원래 값으로**: 숨기기 전 각 레이어의 `visibility` 를 기억했다가 그대로 돌려놓는다(원래 `none` 이던 레이어를 켜지 않기).
   - 스타일 재로드(`style.load`)·스타일 교체 후에도 같은 상태를 다시 적용.
   - 매 프레임 레이어를 건드리지 말 것 — **상태가 바뀔 때만** `setLayoutProperty` 호출(줌 이벤트·주행 상태 변화에 반응).
   - 앱 레이어(경로·정복·라이더·거리 표시 등, M1 의 제외 규칙)와 DOM 이름표는 절대 숨기지 않는다.
2. 비상 스위치: `?labels=1` 이면 이 기능을 끈다(항상 글자 표시). `?mapcut=` 은 그대로 동작.
3. perflab 패널 상단 mapcut 줄 옆에 `글자: 숨김/표시` 상태, 복사 JSON 에 `rideLabelsHidden`.

## 시험

- 상태 함수: (주행 아님 → 표시), (주행·19.2 → 숨김), (숨김 상태에서 18.8 → 숨김 유지), (18.6 → 표시), (`?labels=1` → 항상 표시).
- 원래 `visibility: none` 레이어는 복원 후에도 `none`.
- 상태가 같으면 `setLayoutProperty` 호출 0.
- 앱 레이어는 호출 대상에 없음.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` "lib 파일 전원 도메인 지정 PASS(미지정 0)"**(새 lib 파일은 `apps/web/dep-layers.json` 등록), `npm run test:quick`(worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`, `npm run build`. 브라우저는 필요 없다(Supervisor 가 배포 후 실제 GPU 로 측정).

## 금지

주행 외 화면 변경, 앱 레이어·이름표 숨김, 스타일 URL 변경, 매 프레임 레이어 호출, commit · push · 배포, 백그라운드 잔류.
