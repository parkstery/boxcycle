# 04-result-cursor — compact-controls 승인 v2 구현

상태: LOCAL_VERIFIED(관련 기능) / 미배포. Cursor AI. 커밋·푸시·배포 없음.

## 구현 요지

Chief 승인 4항목만 제품 컴포넌트에 반영했다. 시안의 예시 기록·가짜 지도는 이식하지 않았고, 실제 `fetchLeaderboard`·설정 토글·카메라 콜백을 유지한다.

1. **LeaderboardSheet** — 740×324 좌우 분할을 버리고 오른쪽 내용형 창 440×236. 큰 좌측 요약을 상단 한 줄(내 순위·값·차이)로 합침. 목록은 행 24px, `grid-auto-flow: column`으로 왼쪽 1~5 / 오른쪽 6~10. 10명 미만은 있는 행만, 가짜 행 없음. 10명 초과·내 주변은 `10위 이후 · 내 주변` 접기. 개척 이용 안내는 `내 길 이용 · 새 도로` 접기. 긴 닉네임 `title`, 같이 달리기는 점 버튼+접근성 이름.
2. **EdgePanelHandle** — 보이는 반달 34×72 → 20.4×43.2(정확 60%). 터치 탭 44×76 유지. transform 스케일 없음.
3. **RideSettings** — 두 열 3행(코칭/음성/배경 음악 · 페이서/효과음/인터벌). 아래 인터벌 요약+운동 설정, 칼로리+프로필 수정. 도움 문구는 `aria-description`으로 옮김. 배경 음악 미설정은 「준비 중」. overflow:hidden으로 가리지 않음.
4. **CameraViewMenu** — 트리거 1개. 클릭 시 두 열 동시 노출(왼쪽 1번 높이 62px 우측 정렬, 오른쪽 2~6 파란 방향도안+6 아래 3D). 선택/Escape 후 트리거 포커스 복귀. 프레이밍·야외 잠금·1번 위성 정책 코드는 읽기만.

## 시안 대비 실측 (699×273, 실제 제품 컴포넌트)

| 표면 | 시안 | 실측 | 비고 |
|---|---|---|---|
| 순위 창 | 440×236 | **440×236** | 오른쪽 배치, 10행 경계 내, scrollHeight=clientHeight=236 |
| 반달 보임 | 20.4×43.2 | **20.39×43.19** | 좌우 동일. 탭 hit 44×76 유지 |
| 주행 설정 | 약 460×249 | **460×257** | 닫기 44px 유지로 높이 +8. 699×273에서 y=8~265, 스크롤 0, overflow visible |
| 카메라 판 | 154, 1열 62 | **154×235, 1열 62** | 트리거 1개. 2~6 세로, 3D는 6 아래 |

폰 가로 800×360 · 736×300 · 699×273 · 667×300에서 compact-controls 20/20 PASS.

## 변경 파일

제품:

- `apps/web/src/components/leaderboard/LeaderboardSheet.tsx`
- `apps/web/src/components/leaderboard/LeaderboardSheet.css`
- `apps/web/src/components/ui/EdgePanelHandle.css`
- `apps/web/src/components/ride/RideSettingsPanel.tsx`
- `apps/web/src/components/ride/RideSettingsSheet.css` — 창 폭 360→460, 두 열 그리드, 스크롤 제거(overflow visible). 위치 조정 필요 최소.
- `apps/web/src/components/maphud/CameraViewMenu.tsx`
- `apps/web/src/components/maphud/CameraViewMenu.css`

프리뷰·시험:

- `apps/web/scripts/ui-800x360/preview.tsx` — `state=leaderboard` 및 `lb=` 픽스처, getLeaderboard fetch stub(제품 API 변경 없음)
- `apps/web/e2e/compact-controls.spec.ts` (신규)
- 충돌 기대값 교정: `ui-800x360.spec.ts`(고정27 62px·단일 트리거, 반달 20.4×43.2), `ui-redesign-batch2.spec.ts`, `ui-redesign-batch2-live.spec.ts`, `ui-redesign-batch4.spec.ts`(스위치 6·이름 클릭), `ride-interval-settings.spec.ts`(설정 폭 ≤460), `map-menu-consolidation.spec.ts`, `ride-terrain-guard.spec.ts`, `camera-qc1-*.spec.ts`, `camera-angle-candidates.spec.ts`, `camera-quick-capture.spec.ts`, `peer-sync-s1.spec.ts`, `peer-sync-s3av.spec.ts`

`App.tsx`·카메라 알고리즘·데이터 서비스·`functions/`·Rules·`dep-layers.json` 변경 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 5031 HTTP 200 재사용. `RTW_DEV_PORT=5031`, workers 1, retries 0.

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint` 대상 4 TSX | 오류 0 |
| `npx playwright test e2e/compact-controls.spec.ts` | **20/20 PASS** |
| `npx playwright test e2e/ui-800x360.spec.ts e2e/ui-redesign-batch4.spec.ts e2e/ride-interval-settings.spec.ts e2e/ride-ui-moments.spec.ts e2e/map-menu-consolidation.spec.ts` | **66/66 PASS** |
| `npx playwright test e2e/ui-redesign-batch2.spec.ts e2e/ride-terrain-guard.spec.ts` | **7/7 PASS** |
| `npm run test:ride-camera-framing` | **102 PASS / 0 FAIL** |
| `node scripts/ride-verify/verify-selectors.mjs` | **19/19 PASS** |
| `npm run build` | PASS (기존 큰 청크 경고만) |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | FAIL knip exports **188>186** — 착수 baseline과 동일, 이번 증가 없음 |
| `git diff --check` 대상 | PASS (LF→CRLF 경고만) |

`test:quick` 미실행. UI 배치만 바꿨고 영향분은 위 e2e 93 + 카메라 단위 102로 봤다. 이전 묶음의 watchdog/권한 실패와 섞지 않기 위해 전체 quick은 돌리지 않음.

실폰·실계정 순위 API·실센서 주행은 미실행.

## 이번 교정과 기존 실패

- 이번 지시로 고친 시험 기대값: 카메라 두 트리거→하나, 높이 열 96→62, 반달 34×72→20.4×43.2, 설정 폭 360→460, 스위치 5→6(그리드에 효과음+인터벌). skip/삭제 없음.
- 기존 code-tidy 188>186은 그대로 실패로 기록. 새 export 없음.
- 기존 PNG 덮어쓰기 없음. 새 캡처는 `evidence/implementation/`만.

## 증거

절대 경로 `C:\20.HDev\boxcycle\document\ops\20261028-compact-controls\evidence\implementation\`

- `rank-10-699x273.png`
- `settings-699x273.png`
- `camera-699x273.png` (선택 후 닫힌 트리거)
- `camera-open-699x273.png` (두 열 열린 상태)
- `edges-699x273.png`

## 한계 · 남은 일

- 주행 중 오른쪽 반달이 여는 것은 기존 **LeaderboardGlance**(윤곽선 목록)이다. 이번 440×236 불투명 창은 지시 소유 파일 **LeaderboardSheet**(메뉴 순위 / preview `?state=leaderboard`). Glance 레이아웃은 손대지 않음.
- 설정 높이 257은 시안 약 249보다 8px 큼(닫기 44px 유지). 699×273 경계·스크롤 0은 충족.
- 카메라 열린 판이 우상단 계정과 겹치지 않는지는 닫힌 트리거 기준으로 검사. 열린 판 699×273 캡처상 계정 칩 아래·왼쪽으로 보임.
- Codex 감리 `05-review.md`, 고정 목록 갱신, 실폰 확인, 커밋/푸시/배포는 지시 밖.

## 재현

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
# 기존 5031이 200이면 재사용. 아니면:
# npm run dev:localhost -- --port 5031
```

- 순위: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=leaderboard`
- 설정: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=settings`
- 카메라·반달: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding` → 카메라 메뉴 클릭, 좌우 반달 확인
- 픽스처: `&lb=twenty|three|empty|guest|unranked|error|nologin|around`
