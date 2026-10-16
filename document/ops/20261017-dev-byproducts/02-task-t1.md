# 지시 T1 — 개발 부산물 삭제

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-17 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-devtools` (브랜치 `chore/dev-byproducts`, 기준 `main2`) |
| 결과 파일 | `C:\20.HDev\boxcycle-devtools\document\ops\20261017-dev-byproducts\03-result-t1.md` |
| 근거 | [01-inventory](01-inventory.md) · [02-rules](02-rules.md) · Chief "지운다" |

## 원칙

- **동작 변경 0.** 지우는 것은 아무도 부르지 않는 스크립트, DEV 빌드 전용 디버그 코드, 죽은 코드뿐이다. 운영 빌드 동작이 바뀌면 안 된다.
- 지우기 전에 파일마다 `rg` 로 참조를 다시 확인한다. 아래 목록에 없는 곳(시험·하네스·package.json·훅·`.claude`·`.cursor` 명령)에서 쓰이면 **지우지 말고 결과 파일에 보고**한다.
- 문서(`document/`)의 언급은 지울 이유가 아니다. 단 링크(`[..](경로)`)가 삭제 파일을 가리켜 `node scripts/check-document-system.mjs` 의 newErrors 가 생기면, 링크를 코드 표기 + "(2026-10-17 삭제)" 로 바꾼다. 문서 본문은 고치지 않는다.

## 삭제 목록

### A. 스크립트 (git rm)

1. `apps/web/scripts/rider-cycle-fit/` 폴더 전체
2. `apps/web/scripts/rider-preview/` 폴더 전체
3. `apps/web/scripts/peer-sync/` 의 `s3av-summarize.mjs` `s3b1-summarize.mjs` `s3b2-summarize.mjs` `s3b2r-summarize.mjs` `s3b3-summarize.mjs` `s3r-summarize.mjs` `s41-summarize.mjs` `s41r-summarize.mjs`
4. `apps/web/scripts/rider-preserve/` 의 `audit-guide-index-order.mjs` `audit-pedal-failure.mjs` `derive-foot-pitch-table.mjs` `probe-foot-contact.mjs` `probe-weight-strategies.mjs` `scan-foot-flex.mjs` `stage-app-candidate.mjs`
5. `apps/web/scripts/map/map-cut-lab-headless.mjs` `apps/web/scripts/map/ride-label-mode-headless.mjs` (`ride-label-names-headless.mjs` 는 남김)
6. `apps/web/scripts/distance-auto-route/capture-ui-circle-screenshots.mjs` `capture-ui-unification-screenshots.mjs`, `apps/web/scripts/ride-calories/capture-calorie-settings-ui-fixture.mjs`, `apps/web/scripts/next-ride/capture-resume-slot-ui-fixture.mjs`
7. `apps/web/scripts/ride-continue/phase-c-three-loop.mjs`
8. 루트 `scripts/move-lib-files.mjs` `scripts/repair-lib-imports.mjs`

### B. DEV 전용 디버그 코드 (파일 삭제 + 호출처 정리)

| 파일 | 호출처(확인됨) |
|---|---|
| `src/lib/debug/tickTestSwitches.ts`, `src/components/map/TickTestOffBadge.tsx` | `MapView.tsx`, `rideCameraFollow.ts` — 스위치 판정은 DEV 아닐 때 항상 "켜짐/기본"을 돌려주므로, 호출을 지우고 그 기본 분기만 남긴다 |
| `src/lib/debug/mapTickProbe.ts` | `MapView.tsx`, `rideCameraFollow.ts`, `mapLiveOverlayLayers.ts` |
| `src/lib/debug/installLiveRideExistsDebug.ts`, `src/lib/debug/installMotionExistsDebug.ts` | `routePublishFlight.ts`, `motionPublishFlight.ts` |
| `src/lib/debug/localFirstGeoProbe.ts` | `LocalFirstEntryCard.tsx` |
| `src/lib/debug/peerSmoothnessProbe.ts` | `PeerMotionRegistry.ts` |

각 호출처에서 운영 빌드에서 실행되던 경로가 **글자 그대로 같은 동작**이 되게 지운다(DEV 분기만 제거). 판단이 서지 않는 호출이 있으면 그 파일은 남기고 보고.

**남기는 것(지우지 말 것)**: `peerIngestDiag`·`trafficPairedCapture`·`distanceAutoRouteClickDebugMarker`(시험이 사용), `hudCompanionDiag`·`installHudCompanionDebug`(제품 코드 3곳이 사용), 계측 모듈(`*Meters`), `documentVisibilityOverride`, `mapDebugPhase`, `rideCameraLab`, perflab 묶음.

### C. 죽은 코드

- `src/lib/weather/openMeteoWeather.ts` 의 `parseWeatherOverride` (호출처 0). 이 함수만 쓰던 import·상수가 있으면 함께.

### D. 실수로 추적된 결과물

- `git rm --cached` 로 추적 해제(디스크 파일은 남김): `document/ops/20261005-ride-map-controls/.out/` 8개, `document/ops/20261006-saved-route-readability/.out/` 2개. 무시 규칙(`document/ops/**/.out/`)은 이미 있다.

### E. 등록부 정리

- `apps/web/dep-layers.json` 에서 삭제된 lib 파일 항목 제거.
- `package.json` 에 삭제 파일을 가리키는 스크립트가 있으면 보고(조사 당시 0건).

## 검증 (PowerShell, `apps/web`)

1. `npx tsc -b` 0
2. 변경 파일 eslint 0
3. 루트 `node scripts/check-dep-direction.mjs --check` — lib 도메인 지정 PASS(worktree `functions/lib` 부재로 인한 기존 실패 1건은 무관)
4. `npm run test:quick` (worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`
5. `npm run build` 0 — 빌드 결과 기본 청크 크기를 삭제 전·후로 기록
6. 루트 `node scripts/check-document-system.mjs` newErrors 0
7. `git status` — 이 목록 밖의 변경 없음

## 금지

목록 밖 파일 삭제, 운영 동작 변경, camlab·lightlab·rideCam·ridePitch·perflab 관련 코드 변경(T2 범위), commit·push·배포, 백그라운드 잔류, 브라우저 실행(필요 없음).

## 결과 파일

삭제한 파일 목록(개수), 남긴 파일과 이유, 호출처별 수정 요약, 검증 결과(명령·숫자), 빌드 청크 크기 전·후.
