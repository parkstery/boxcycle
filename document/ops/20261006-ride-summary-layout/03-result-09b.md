# 결과 09-2 — 주행 결과 ✕ 닫기 · 보조 줄 한 줄화

- 담당: Developer(Cursor CLI) · 지시: [02-task-09b.md](02-task-09b.md)
- 커밋: 하지 않음
- 허용 파일만 수정: `apps/web/src/components/ride/RideSummarySheet.tsx` · `.css`
- 병행 금지 준수: `MapView.tsx` · `rideCameraFollow.ts` · `lib/map/rideEndNorthUp.ts` 미수정

## 변경 요약

1. **✕ 닫기** — 저장할 것이 없을 때만(`!adhocSaveAvailable`) `ride-summary__close` 를 ✕ 아이콘으로. `aria-label="닫기"` · `title="닫기"` 유지. 시트 우상단 absolute(1.9rem 원형, 투명 배경) — `oc-modal__close` 동형. 터치 44px 는 `::after`. 헤더에 `ride-summary__head--with-close` 로 오른쪽 여백 2.2rem.
2. **닫는 버튼 단일** — `adhocSaveAvailable` 이면 ✕ DOM 없음(「저장 안 함」만).
3. **보조 줄 한 줄화** — 시간·평속·칼로리 칸 `white-space: nowrap` · 시간/평속 `flex: 0 0 auto`(축소로 2줄 깨짐 방지) · 「체중·강도 설정」은 `min-height: 44px` 제거 후 `::after` 터치 확장(D2). 버튼 문구 유지.

## 촬영

루트: `document/ops/20261006-ride-summary-layout/shots-09b/`  
임시 spec `_tmp-ride-summary-09b.spec.ts` — 촬영 후 **삭제**.

| 시나리오 | 690×275 | 1000×640 | 메트릭 |
|---|---|---|---|
| ① 저장 없음(✕ 보임) | [01-no-save-690x275.png](shots-09b/01-no-save-690x275.png) · [sheet](shots-09b/01-no-save-690x275-sheet.png) | [01-no-save-1000x640.png](shots-09b/01-no-save-1000x640.png) | `closeVisible: true` · 시간/평속/칼로리 **lines=1** |
| ② 저장 있음(✕ 없음) | [02-with-save-690x275.png](shots-09b/02-with-save-690x275.png) · [sheet](shots-09b/02-with-save-690x275-sheet.png) | [02-with-save-1000x640.png](shots-09b/02-with-save-1000x640.png) | `closeVisible: false` · `skipVisible: true` · 보조 줄 **lines=1** |

평속 예: `29.4 km/h` height≈18.58 / lh≈18.58 → **lines=1**(검수 09 잔여 「24.4 km/h 2줄」 해소).

## 검증

| 항목 | 결과 |
|---|---|
| `cd apps/web && npx tsc -b --noEmit` | **0** |
| `npx eslint src/components/ride/RideSummarySheet.tsx` | **0** error (css ignore warning만) |
| 컴팩트 시트 (`ride-summary-compact` 시트 describe) | **통과** (스위트 3/5) |
| `npm run test:e2e:ride-summary` 전체 | **미통과** 2건 — 아래(허용 파일 밖, 기대값 완화 없음) |

## 스위트 실패 판정 (추가 §6)

명령: `npm run test:e2e:ride-summary` · `--workers=1` · 8080 LISTENING 해제 후 실행.  
결과: **3 passed · 2 failed**.

### 1) 다음 주행 카드가 `mapboxgl-ctrl-zoom-in` 을 가림

- spec: `ride-summary-compact.spec.ts` 「다음 주행 카드 자리」
- 증상: `elementFromPoint` 기준 `mapboxgl-ctrl-zoom-in` unreachable
- **worktree 비교** (`git stash` 없음):

| 체크아웃 | 커밋 | 같은 spec |
|---|---|---|
| `C:\20.HDev\boxcycle-wt-pre-a275e3a` | `a275e3a^` = `34f8dbe` | **PASS** (37s) |
| `C:\20.HDev\boxcycle-wt-a275e3a` | `a275e3a` | **FAIL** — `mapboxgl-ctrl-zoom-in` 가림 |

- **원인 커밋: `a275e3a`** (`feat(hud): clock above scale bar, map style/zoom controls always visible`)
- **원인 파일:** `apps/web/src/components/maphud/MapHud.tsx` · `MapHud.css` · `App.tsx`  
  (idle에서도 맵 스타일·± 상시 → `.map-hud__tr` 기하 변화. 카드는 tr 오른쪽 끝에 맞추므로 폰 가로에서 Mapbox `MapZoomGlobeControl` 열과 겹침이 재현됨.)
- RideSummarySheet·지시 09-2 변경과 무관. 허용 파일 밖이라 **미수정**.

### 2) RouteDock 「센서 안내 깜빡임」

- spec: 같은 파일 「RouteDock 레이아웃」 — `hud-cadence--attention` 미부여
- received: `hud-cadence hud-cadence--dock`
- **worktree `a275e3a^` 에서도 동일 FAIL** → **`a275e3a` 원인이 아님**
- `sensorAttention={Boolean(routeGeometry) && !routeLoading && !rideInputReady}` 배선은 `bb9bd45` 이후 유지. 이번 트리·에뮬 환경에서 `rideInputReady` 등이 이미 true 이거나 attention이 안 붙는 회귀로 보이나, 원인 커밋 확정은 추가 bisect 필요.
- RideSummarySheet 무관 · 허용 파일 밖 · **미수정**.

## 범위 밖·비고

- 지시 10 병행 파일(`MapView` / `rideCameraFollow` / `rideEndNorthUp`) 미수정. (비교 중 HEAD가 `7e396a5` 로 진행됨 — 지시 10 커밋 반영.)
- worktree 비교 후 Windows junction+`worktree remove` 로 `apps/web` 작업 트리가 한 번 비워짐 → `git restore apps/web` 후 시트 09+09b 변경을 재적용·`tsc -b` 재확인. 촬영·스위트 판정은 재적용 전 실행 증거를 유지.
- 에뮬레이터 포트 8080 은 병행 에이전트와 충돌이 잦아 LISTENING 해제 폴링 후 실행.

## 상태

- ✕ 닫기 · 보조 줄 한 줄 · tsc · 촬영: **완료**
- `test:e2e:ride-summary` 전체 그린: **BLOCKED by 범위 밖** — (1) `a275e3a` MapHud/App, (2) RouteDock attention( a275e3a 이전부터 재현)
