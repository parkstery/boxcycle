# 02-result-cursor — 왼쪽 메뉴 승인안 구현

Cursor. 2026-10-29. [01-task](01-task.md) 승인 시안 구현. 커밋·푸시·배포·worktree/restore/clean/stash/브랜치 없음. 기존 dirty와 공존. HANDOFF·고정목록·ops README는 지시대로 미수정.

## 제품 동작

1. **MenuPanel 헤더** — Spinatlas 오른쪽에 텍스트 없는 지명검색 아이콘(`aria-label`/`title` = 지명 검색). 닫기는 한국어 `메뉴 닫기`. 헤더 drag는 `button`을 건너뛰어 검색·닫기와 충돌하지 않음. 검색은 기존 `openPlaceSearchPanel` 콜백.
2. **RideRoutePanel** — 「경로 선택」은 중간 제목. 한 줄 `내 경로` / `퍼블릭` / `입문`이 `selectSource("saved"|"public"|"intro")`로 기존 목록 모달을 바로 연다. 순위 행·지명검색 행 제거. 오른쪽 에지 순위 전체보기는 App 연결 유지.
3. **인터벌** — 메뉴에서 주행 설정 위 행으로 이동해 기존 인터벌 설정 창을 연다(메뉴는 닫힘). 주행 설정의 인터벌 스위치/요약/운동 설정 제거. 사용 켜기/끄기는 인터벌 창 `role=switch` `aria-label="인터벌"`에 보존. RouteDock INT·저장·적용·주행 중 잠금·경로시간 경고는 기존 경로 유지. 새 전역 상태·저장 키 없음.
4. **툴팁** — EdgePanelHandle `title`은 열림 상태에 따라 메뉴 열기/닫기·순위 목록 열기/닫기. 기존 `aria-label`(메뉴 열기/순위 열기) 유지. Trail/계정/로그인, 카메라, 줌, RouteDock LED·접기·삭제·교체, 주행 재생/일시정지/종료 등 관련 아이콘에 native `title` 보완. 영어 Trail menu/Account/Sign in 제거.

고정14 반달·고정16 브랜드·고정5/6 흰 목록은 코드 경로를 바꾸지 않음. 고정18/42 위치만 이번 승인으로 대체(정본은 Supervisor).

## 변경 파일

제품

- `apps/web/src/components/MenuPanel.tsx` · `MenuPanel.css`
- `apps/web/src/components/ride/RideRoutePanel.tsx` · `RideRoutePanel.css`
- `apps/web/src/components/ride/RideSettingsPanel.tsx` · `RideSettingsSheet.tsx` · `RideSettingsSheet.css`
- `apps/web/src/components/ride/RideIntervalSettingsSheet.tsx` · `RideIntervalSettingsSheet.css`
- `apps/web/src/components/ui/EdgePanelHandle.tsx`
- `apps/web/src/App.tsx` — MenuPanel 검색, RideRoutePanel 인터벌, RideSettingsSheet 인터벌 props 제거, 인터벌 시트 `enabled`/`onEnabled`
- `apps/web/src/components/route-dock/RouteDock.tsx` · `RouteOverviewFoldToggle.tsx`
- `apps/web/src/components/ride/RideControlBar.tsx`
- `apps/web/src/components/maphud/MapHud.tsx` · `CadenceHudChip.tsx` · `CameraViewMenu.tsx`

프리뷰·계약

- `apps/web/scripts/ui-800x360/preview.tsx`
- `apps/web/scripts/ui-redesign-batch1/preview.tsx`
- `apps/web/scripts/ride-verify/entry-contract.mjs` — `open-basic-courses` 앵커를 입문 직접 열기로 갱신

e2e — 단일 「경로 선택」 버튼을 `내 경로`/`입문` 출처 버튼으로 치환. 인터벌은 메뉴 「인터벌」·에디터 스위치로 진입. 주행 설정 switch 6→5.

- `e2e/left-menu-supervisor.spec.ts`(기존 지시 스펙, 미커밋)
- `e2e/ride-interval-settings.spec.ts` · `compact-controls.spec.ts` · `ui-redesign-batch4.spec.ts` · `ride-ui-moments.spec.ts` · `ui-redesign-batch1.spec.ts` · `ui-800x360.spec.ts` · `menu-declutter-a.spec.ts` · `ride-entry.spec.ts` · `rideEntryHelpers.ts` 및 입문 로드 헬퍼를 쓰는 관련 spec

`functions/` · Rules · dep-layers · `.out/` · `cdbox.bat` · 3000/3001 미터치.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 **5031 LISTENING 보존**(pid 13960). UI 시험은 **5042**.

증거 `C:\20.HDev\boxcycle\document\ops\20261029-left-menu\evidence\` (기존 다른 묶음 증거 경로 미사용).

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS exit 0 |
| `npx eslint` 변경 TS(제품·프리뷰·관련 spec) | 오류 0 · `App.tsx` 기존 hooks 경고 7 |
| `node scripts/ride-verify/verify-selectors.mjs` | **20/20 PASS** (`open-basic-courses` 입문 직접 열기) |
| `npm run build` | PASS exit 0 (청크 크기 경고 기존) |
| Playwright workers=1 retries=0 `RTW_DEV_PORT=5042` 관련 spec | 아래 |

Playwright (프리뷰, Firebase 불필요)

- `left-menu-supervisor.spec.ts` — 배치 5뷰포트 + 출처 왕복·인터벌 이동 + 에지 툴팁 **7 PASS**
- `ui-redesign-batch1.spec.ts` — 메뉴 2행·세 출처·목록 왕복 **5 PASS**
- `ui-redesign-batch4.spec.ts` 「주행 설정은 체중…」 **1 PASS** (switch 5, 인터벌은 에디터)
- `ui-800x360.spec.ts` 「경로 모달에서 세 출처…」 **1 PASS**
- `ride-interval-settings.spec.ts` 관련 전부 **PASS** (재실행 포함)
- `compact-controls.spec.ts` 주행 설정 기하·왕복·스트레스 **PASS**
- `ride-ui-moments.spec.ts` 좌우 탭·인터벌 에디터 **PASS** (프리셋 option 9는 기존 인터벌 계약과 동일)

같은 증상 5분 정체 없음. 전체 e2e·에뮬레이터 `ride-entry` live는 지시대로 미실행.

## 하네스 사용법 (Supervisor 독립검증)

셀렉터 계약(Firebase 불필요):

```
cd C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
```

실주행 진입 e2e는 에뮬레이터 전제. CI 기본으로 `RIDE_VERIFY_LIVE=1`을 켜지 말 것. 준비되면:

```
cd C:\20.HDev\boxcycle\apps\web
npm run test:e2e:ride
```

관련 프리뷰 재실행 예(5031 보존, 별도 포트):

```
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5042'
$env:COMPACT_CONTROLS_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261029-left-menu\evidence'
$env:INTERVAL_SETTINGS_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261029-left-menu\evidence'
$env:BATCH1_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261029-left-menu\evidence'
npx playwright test e2e/left-menu-supervisor.spec.ts e2e/ui-redesign-batch1.spec.ts e2e/ride-interval-settings.spec.ts e2e/ui-redesign-batch4.spec.ts --workers=1 --retries=0
```

접속: `http://127.0.0.1:5042/scripts/ui-800x360/preview.html?state=menu`  
확인 순서: 헤더 돋보기·닫기 툴팁 → 경로 선택 아래 세 버튼 → 인터벌이 주행 설정 위 → 인터벌 창 사용 스위치 → 주행 설정에 인터벌/운동 설정 없음 → 좌 에지 메뉴 열기/닫기 title.

## 범위 밖·참고

- `scripts/perf/run-real-gpu.mjs` · `scripts/ride-continue/phase-a-verify.mjs`는 지시 범위(preview/e2e/entry-contract) 밖이라 미수정. 옛 「경로 선택」 단일 버튼 클릭이 남아 있음.
- 에뮬레이터 live spec(`ride-entry`, `menu-declutter-a`, camera/minimap 등)은 셀렉터만 갱신, 이번 세션에서 미실행.
- MapHud.css·RouteOverviewFoldToggle 기하 등 기존 dirty는 되돌리지 않음. 이번 작업은 `title` 등 관련 속성만 추가.
- 인터벌 사용 스위치는 기존 min-target 32px 계약을 맞추려고 32×32로 키움. 저장 경로·프리셋 로직은 그대로.

## 남은 일

Codex 독립검증. 정본(고정18/42) 갱신은 Supervisor. Chief 실폰·배포·커밋은 별도 지시. live `npm run test:e2e:ride`는 에뮬레이터가 있을 때.
