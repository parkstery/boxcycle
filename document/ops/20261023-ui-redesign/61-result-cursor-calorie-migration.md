# 결과61 — 칼로리 프로필 시험·fixture 이식 (Cursor)

| 항목 | 내용 |
|---|---|
| 유형 | execution (지시58 후속, 기계적) |
| 날짜 | 2026-10-25 |
| 담당 | Cursor Developer |
| 선행 | [58-task-batch4.md](58-task-batch4.md), [56-plan-batch4.md](56-plan-batch4.md) |
| Git | **커밋·푸시·배포 없음**(지시) |

## 범위

| 파일 | 조치 |
|---|---|
| `apps/web/e2e/calorie-profile-sync.spec.ts` | 묶음4 UX(설정 요약 → 프로필 수정 편집)로 e2e 이식 |
| `apps/web/scripts/ride-calories/calorie-settings-ui-fixture-main.tsx` | `RideSettingsSheet` + `ProfileEditSheet` 연결, 저장 후 요약 반영 |
| 그 외 제품·`preview.tsx`·`ui-redesign-batch4.spec.ts` | **미수정** |

별도 calorie fixture 전용 e2e 파일은 기존에 없었고, 이번 지시 범위에서 신규 추가하지 않았다.

## 변경 요약

### `calorie-profile-sync.spec.ts`

- `OUT_DIR`: `CALORIE_PROFILE_EVIDENCE_DIR` 이 있으면 `path.resolve` 후 사용, 없으면 기존 `apps/web/.out/calorie-profile`.
- 헬퍼: `openProfileFromSettings`, `expectCalorieSummary`(`.ride-settings-panel__calories`의 `체중 N kg` · `운동 강도 {label}`), `saveCalorieInProfile`.
- 시나리오 「새 기기에서도 다시 묻지 않는다」:
  - **이전:** 주행 설정 시트에서 `체중(kg)`·강도 칩 직접 입력.
  - **이후:** 설정 → 「프로필 수정」 → 입력·저장 → 설정 재진입 후 요약 검증 → 새 기기 복구도 **요약**으로 확인.
  - **타 기기 변경:** 열린 설정의 **읽기 전용 요약**이 먼저 갱신되는지 확인한 뒤, 프로필을 다시 열어 입력값 검증(열린 프로필 draft snapshot 정책과 일치). 스크린샷 `changed-on-other-device-settings-summary.png` 추가.
- 시나리오 「사용자 정보 → 프로필 수정」: 의미·단언 유지(경로는 계정 시트).

### `calorie-settings-ui-fixture-main.tsx`

- **이전:** `RideSettingsSheet`만, `onCalorieWeightKg` / `onCalorieIntensityId`로 설정 시트에서 직접 편집.
- **이후:** 게스트 mock `User`, 설정은 `calorieWeightKg` / `calorieIntensityId`만(읽기), `onEditProfile`로 프로필 시트 전환; 저장 시 공유 state 갱신 후 설정 재표시 → 패널 요약에 반영.
- `#calorie-settings-fixture` + `data-*` 속성(수동·향후 시험용).

## diff 근거 (실제 `git diff` 요약)

- `calorie-profile-sync.spec.ts`: +약 60 / −약 20 줄 — 위 시나리오·env·헬퍼.
- `calorie-settings-ui-fixture-main.tsx`: +약 55 / −약 35 줄 — Profile 연결·setter 제거.

전체 diff는 작업 트리에서:

```text
git diff --no-color apps/web/e2e/calorie-profile-sync.spec.ts apps/web/scripts/ride-calories/calorie-settings-ui-fixture-main.tsx
```

(실행 폴더: `C:\20.HDev\boxcycle`)

## 검증

| 항목 | 상태 |
|---|---|
| `npm` / Playwright / dev 서버 | **미실행**(지시) |
| `tsc` / eslint / `test:quick` | **미실행**(지시) |
| Codex 제품 변경과 충돌 | 해당 파일만 수정; 다른 dirty 되돌리지 않음 |

## Chief·수퍼바이저 후속 시험 (참고만, 이번에 실행 안 함)

```powershell
cd C:\20.HDev\boxcycle\apps\web
# 에뮬레이터·실앱 harness 전제 — 기존 calorie-profile 패키지와 동일
npm run test:e2e:calorie-profile
```

증거를 다른 폴더에 두려면:

```powershell
$env:CALORIE_PROFILE_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\instruction58\calorie-profile'
```

fixture 수동 확인:

`C:\20.HDev\boxcycle\apps\web\scripts\ride-calories\calorie-settings-ui-fixture.html` (Vite dev 또는 harness에서 해당 TSX 로드)
