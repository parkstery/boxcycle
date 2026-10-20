# 결과04 — 지시04 감리 결함 재작업

- 날짜: 2026-10-20. 담당: Cursor CLI (Composer). 지시: [02-task-04.md](02-task-04.md). 이전: [03-result-03-interrupted.md](03-result-03-interrupted.md) 인계·03 구현 diff 보존.
- 범위: 감리에서 **재현된** (1) 취소/반대/수직 드래그·pointercancel 후 의도치 않은 열기, (2) 결과 시트 진행 숫자 클립, (3) 가장자리 핸들 노출·겹침만 수정. 커밋·푸시·배포·운영 API 없음.

## 03에서 이어받은 구현(요약·유지)

App 첫 지역 카드·가장자리 결선, MenuPanel/MapViewSheet 포커스·헤더 드래그·목록 scrim, 경로 출처 통합, Ready Ride 힌트, 설정·Guest·결과 시트 카피, `EdgePanelHandle` / `usePanelHeaderCloseDrag` / `useDialogFocus`, GLM MapHud·RouteDock 보완. 본 턴에서 위 세 결함만 추가 패치.

## 지시04 수정 내역

| # | 내용 |
|---|---|
| 1 | `usePanelHeaderCloseDrag.ts`: `EDGE_DRAG_TAP_SLOP_PX`(6), `EDGE_DRAG_MIN_INTENT_PX`(24), `shouldCommitAxisGesture`(48px 또는 24px+속도). 반대/수직/취소 시 열기·닫기 확정 안 함. 헤더 드래그에 resize 정리·`isPrimary`·reject 플래그. |
| 2 | `EdgePanelHandle.tsx`: 탭은 이동 ≤6px만 `onOpen`(pointerup). 그 외 미확정 드래그·반대방향·reject는 열지 않음. `pointercancel`/`lostpointercapture`/resize 시 `clearSession(true)`로 click 억제. 멀티터치 non-primary 무시. pointerup과 click 이중 열기 방지 유지. |
| 3 | `RideSummarySheet.css`: `.ride-summary__progress` 고정 `height:2.5rem` 제거 → `min-height`+패딩, `.ride-summary__progress-text` `min-height`·`line-height`·`flex-shrink:0`·`overflow:visible`. conquest hero 동일 `min-height` 패턴. `story-detail` 11px. |
| 4 | `App.tsx`: `edgePanelHandlesVisible` — 인트로·위치 선택·게스트/인증·닉네임 게이트·결과 시트·메뉴/맵뷰/검색·계정·주행설정·센서·퍼블릭 요청·프로필 편집 중 핸들 미렌더. |
| 5 | `EdgePanelHandle.css`: 히트 44×44, 세로 `clamp`로 HUD·RouteDock 사이(667×300 `@max-height:560px` 보정). |

## 변경 파일(이번 턴)

- `apps/web/src/components/ui/usePanelHeaderCloseDrag.ts`
- `apps/web/src/components/ui/EdgePanelHandle.tsx`
- `apps/web/src/components/ui/EdgePanelHandle.css`
- `apps/web/src/App.tsx` (가장자리 표시 조건만)
- `apps/web/src/components/ride/RideSummarySheet.css`
- `document/ops/20261020-ui-800x360/03-result-04.md`

`MenuPanel.tsx` / `MapViewSheet.tsx`는 import 경로만 `usePanelHeaderCloseDrag` 분리 파일 유지(로직은 공유 모듈 갱신).

## 검증 (Developer)

실행 위치: `C:\20.HDev\boxcycle\apps\web`

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
npx tsc -b --pretty false
npm run lint
```

| 명령 | 결과 |
|---|---|
| `verify-selectors.mjs` | exit **0** — 19/19 |
| `npx tsc -b --pretty false` | exit **0** |
| `npm run lint` | exit **1** — 기존 경고 37 + **Supervisor 소유** `scripts/ui-800x360/preview.tsx` `react-refresh/only-export-components` 1건(수정 안 함). 이번 허용 파일 신규 lint 오류 0. |

미실행: Playwright `ui-800x360` e2e, 실주행, 운영 접속 — Supervisor 감리(취소 제스처·결과 숫자 DOM·핸들 hit) 담당.

## 완료 / 미완

- **완료(코드)**: 지시04 §1–§5 제품 패치, 정적 selector·타입.
- **미완(감리)**: Supervisor 브라우저에서 취소 드래그·pointercancel 후 미열림·진행 22px 클립 해소·667/800 핸들 hit 재확인 필요.

## Chief 확인(로컬)

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 — 뷰포트 800×360·667×300, 강력 새로고침. 결과 시트·가장자리 드래그·인트로/설정 열림 시 핸들 숨김 확인.
