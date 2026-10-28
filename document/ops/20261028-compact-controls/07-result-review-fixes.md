# 07-result-review-fixes — 독립 감리 보완

상태: LOCAL_VERIFIED(관련 기능) / 미배포. Cursor AI. 커밋·푸시·배포 없음. HANDOFF·README·고정 목록·다른 감리 문서는 수정하지 않음.

## 요지

06 지시 3건만 기존 승인 범위에서 고쳤다. App.tsx·카메라 알고리즘·데이터 서비스·저장 로직은 그대로다.

1. **확장 순위 창 하단 잘림** — 시트 상단 28px·하단 12px·safe-area를 `--lb-max-height`에 반영. 기본 10명 창은 440×236 유지(`overflow: visible`). 개척 보조·추가 순위가 열리면 패널이 viewport 안으로 줄고 **패널 스크롤로** 최하단 문구·추가 행에 닿는다. 부모 `overflow: hidden` 없음.
2. **행별 개척 이용** — `내 길 이용 · 새 도로` 접기 안에 본인 요약 + 참가자 목록(닉네임·이용 인원·km). 상위/추가/내 주변을 rank로 중복 제거. 「이름에 올려 두었습니다」 문구 삭제. 기본 10명 행 밀도는 그대로(24px, 이용은 접기 안).
3. **설정 스트레스** — preview `?settingsStress`가 제품 `RideSettingsSheet`에 최대 인터벌(고저 600·반복 30·준비/마무리 1800·3라운드·휴식 1800), 체중/체력 미설정, 배경 음악 미구성, 고도 로딩을 넘긴다. 저장 알고리즘은 안 바꿨다. 설정 창만 밀도 조정(행 36px, 패딩 6×12, 닫기 44px·폰트 11px 유지). 항목 숨김 없음.

## 실측 (699×273, 제품 컴포넌트)

| 상태 | 결과 |
|---|---|
| 기본 순위 10명 | 440×236, 스크롤 0, 두 열 5행. 기존 계약 유지 |
| 개척 보조 열림 | 패널 viewport 안. 각 참가자 이용은 접기 목록에서 터치로 확인. 각주 스크롤 접근 |
| 20명 추가 순위 열림 | 패널 viewport 안. 마지막 추가 행·각주 스크롤 접근 |
| 게스트·순위 없음 | 패널 viewport 안. 회원 등록/순위 없음·각주 접근 |
| 설정 기본 | 두 열, 스크롤 0, 운동 설정·프로필 수정 유지 |
| 설정 스트레스 | 699×273·667×300에서 패널·모든 스위치/긴 인터벌/준비 중/로더가 경계 안, 부모·자식 스크롤 0 |
| 운동 설정 시트 | viewport 안. 왕복 후 설정 복귀 |
| 프로필 수정 시트 | viewport 안, 컨트롤 잘림 없음. scrollHeight−clientHeight **2px**(서브픽셀). 프로필 시트는 이번 승인 설정창 밖이라 CSS 미변경 |
| 카메라 | 메뉴를 연 채로 캡처 |

## 변경 파일

제품:

- `apps/web/src/components/leaderboard/LeaderboardSheet.tsx`
- `apps/web/src/components/leaderboard/LeaderboardSheet.css`
- `apps/web/src/components/ride/RideSettingsPanel.tsx`
- `apps/web/src/components/ride/RideSettingsSheet.css`

프리뷰·시험:

- `apps/web/scripts/ui-800x360/preview.tsx` — `settingsStress` 쿼리, around uses 픽스처
- `apps/web/e2e/compact-controls.spec.ts` — 경계/터치 이용/스트레스, 증거 기본 경로 `evidence/rework/`
- `apps/web/e2e/ride-interval-settings.spec.ts` — 짧은 프리셋 요약에 `2라운드` 표시 반영

`App.tsx`·Glance·카메라 계산·`functions/`·Rules·`dep-layers.json` 변경 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 5031 HTTP 200 재사용. `RTW_DEV_PORT=5031`, workers 1, retries 0.

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint` LeaderboardSheet·RideSettingsPanel·RideSettingsSheet·preview·compact-controls spec | 오류 0 |
| `npx playwright test e2e/compact-controls.spec.ts` | **24/24 PASS** |
| 관련 e2e (`ui-800x360`·`batch4`·`ride-ui-moments`·`map-menu`·`batch2`·`terrain-guard`) | **72/72 PASS** |
| `npx playwright test e2e/ride-interval-settings.spec.ts` | 처음 1실패(짧은 프리셋 요약 문구) → 기대값 교정 후 **16/16 PASS** |
| `node scripts/ride-verify/verify-selectors.mjs` | **19/19 PASS** |
| `npm run build` | PASS (기존 큰 청크 경고만) |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | FAIL knip exports **188>186** — 착수 baseline과 동일, 이번 증가 없음 |
| `git diff --check` 대상 | PASS (LF→CRLF 경고만) |

`test:quick` 미실행. UI 배치만 바꿨고 1차에서 이미 돌린 전체 quick을 반복하지 않음.

실폰·실계정 순위 API·실센서 주행은 미실행.

## 이번 교정과 기존 실패

- 관련 시험 기대값: 짧은 인터벌 프리셋(2라운드) 요약에 라운드 표기. skip/삭제 없음.
- code-tidy 188>186은 그대로 실패로 기록. 새 export 없음.
- 1차 `evidence/implementation/` PNG 5장 원본 보존. 이번 캡처는 `evidence/rework/`만.

## 증거

절대 경로 `C:\20.HDev\boxcycle\document\ops\20261028-compact-controls\evidence\rework\`

- `rank-10-699x273.png`
- `pioneer-uses-open-699x273.png`
- `rank-extra-open-699x273.png`
- `guest-699x273.png`
- `settings-699x273.png`
- `settings-stress-699x273.png` — 600초/30회/3라운드·준비 중·체중 미설정·고도 로더
- `camera-open-699x273.png` — 메뉴 열린 상태
- `edges-699x273.png`

## 한계 · 남은 일

- 프로필 수정 시트 2px 스크롤 차이는 실측만 기록. 제품 프로필 시트는 06 밀도 조정 범위 밖.
- 주행 중 오른쪽 반달은 기존 LeaderboardGlance. 이번 수정은 LeaderboardSheet만.
- Codex 후속 감리, 고정 목록, 실폰, 커밋/푸시/배포는 지시 밖.

## 재현

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
# 기존 5031이 200이면 재사용
```

- 순위 확장: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=leaderboard` → 개척 → 「내 길 이용 · 새 도로」
- 추가 순위: `...?state=leaderboard&lb=twenty` → 「10위 이후 · 내 주변」
- 설정 스트레스: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=settings&settingsStress`
- 카메라: `...?state=riding` → 카메라 메뉴를 연 채 확인
