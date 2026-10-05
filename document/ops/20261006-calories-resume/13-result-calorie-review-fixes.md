# 결과 — 칼로리 검수 보완

| 항목 | 내용 |
|---|---|
| 유형 | execution |
| 날짜 | 2026-10-06 |
| 지시 | [12-task-calorie-review-fixes.md](12-task-calorie-review-fixes.md) |
| 선행 | [10](10-task-calorie-implementation.md) · [11](11-result-calories.md) (덮어쓰기 없음) |
| Git | 커밋·push·배포 없음(지시) |

## 보완 요약

- `useCalorieProfile`: `useEffect`+`setState` 제거 → **`useSyncExternalStore`** + uid-keyed `calorieProfileLocal` 스토어.
- setter는 updater 밖에서 `writeCalorieProfile`(StrictMode 중복 LS 쓰기 회피). 성공 `true` / 실패 `false`.
- uid 切替 첫 렌더: `getCalorieProfileSnapshot(null|otherUid)` 가 이전 체중 반환하지 않음(계약 시험).
- 같은 탭: write→listeners. 다른 탭: `storage` event. 인증 전 write 거부. storage 실패 시 캐시 유지·UI draft revert.
- `parseWeightKg`: boolean/object 거부. `clampActiveSecForCalories`: activeSec ≤ elapsed.
- `parseCaloriesMeta` SoT화(version/NaN 거부). Firestore 파서가 공유.
- App: uid 切替 시 pedal/signalGap/스냅샷 리셋·running 중이면 새 계정 프로필로 재스냅샷.
- 설정 도움말: watts 전문용어 제거. UserInfo: 전부 미산정 시 `—`(0 오해 방지), legacy `kcal(옛)`·「옛=거리환산 · 새=페달·체중」.
- resume 슬롯·nextRideTarget 등 **미변경**(동시 재개 작업 보존).

## 센서·활동초 (추가 확인)

| 항목 | 결과 |
|---|---|
| pedal 1초 타이머 | 기존 conquest `setInterval(1000)` running만 — 칼로리 공용 |
| disconnect → crankRpm null | `useBleCrankRpm` disconnect/GATT 끊김 시 null. 칼로리 경로: 증가 중단 + 기존 샘플 후 `signalGap` |
| stall(stale) | `pollStall` → **0rpm**(null 아님). 칼로리·conquest 동일 `rpm>0`만 누적 — conquest 변경 없음 |
| manual / 센서 전 | rpm null → activeSec null → kcal null |
| RPM0 | activeSec 0 유지 → 0kcal(미산정과 구분) |
| timestamp freshness | 패킷 시각은 calorie 경로에 별도 노출 없음. stall은 2.5s(`CRANK_STALL_MS`) 후 0. **한계: 칼로리가 독자 sample-timeout을 두지 않음**(정직 기록) |
| pause | running 아닐 때 타이머 미가동 → 활동초 미증가 |
| mid-ride 설정 | 스냅샷 고정(다음 주행부터) |

## UI 740×300 fixture

명령: `node scripts/ride-calories/capture-calorie-settings-ui-fixture.mjs` — **exit 0**

| 캡처 | 경로 |
|---|---|
| 무입력 | `fixtures/calorie-settings-empty-740x300.png` |
| 체중72·보통 | `fixtures/calorie-settings-filled-740x300.png` |
| 640×300 좁은 가로 | `fixtures/calorie-settings-narrow-740x300.png` |

limits(스크립트 출력):

- `panel@740: 379x220 … overflowX=false overflowY=false`
- `calorie-row@740: 352x57 … overflowX=false`
- `calorie-row@640: 352x57 … overflowX=false`

마운트 시험: 체중 fill `72` · 강도「보통」`aria-pressed=true`. 프로덕션 저장·로그인 없음. 실제 앱 5010 게스트 시트 뷰잉은 **미실행**(fixture로 설정 기능까지 검증).

## 검증 명령·exit

| 명령 | exit | 결과 |
|---|---|---|
| `npx eslint src/hooks/useCalorieProfile.ts src/lib/ride/repo/calorieProfileLocal.ts src/lib/ride/caloriesEstimate.ts src/components/ride/RideSettingsPanel.tsx --max-warnings 0` | **0** | set-state-in-effect 해소(eslint-disable 없음) |
| `npx tsc -b --pretty false` | **0** | 종료 시 재확인 PASS |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-calories/calories-estimate-contract.test.ts scripts/ride-stats/ride-stats-aggregate-contract.test.ts` | **0** | 26 pass |
| 동 레지스트리 + `scripts/ride-result/ride-result-contract-0b.test.ts` · `ride-summary-close-contract.test.ts` · `ride-result-f1-id-link.test.ts` | **0** | 40 pass |
| `npm run test:entry-selectors` | **0** | 15 단계 |
| fixture capture | **0** | 캡처 3장·줄넘침 없음 |

기존 UserInfoSheet/RideSettingsSheet/useRideEnd exhaustive-deps **warnings** 는 본 작업 이전·별도(지시: 기존 warnings 별도).

## 변경 파일(칼로리)

- `hooks/useCalorieProfile.ts`
- `lib/ride/repo/calorieProfileLocal.ts`
- `lib/ride/caloriesEstimate.ts`
- `lib/ride/repo/firestoreRides.ts` (parseCaloriesMeta 공유)
- `hooks/useRideEndAndPersistence.ts` (clamp)
- `App.tsx` (uid 切替·clamp 표시)
- `components/ride/RideSettingsPanel.tsx` · `RideSettingsSheet.tsx`
- `components/UserInfoSheet.tsx`
- `scripts/ride-calories/*` (계약 시험 확장·UI fixture·capture)
- `document/ops/20261006-calories-resume/fixtures/calorie-settings-*.png`

## 잔여

- 실기 5010 게스트「시트 보기만」은 fixture로 대체(명시).
- stall→0 은 conquest와 공유; 칼로리 전용 stale-null 분리는 하지 않음(conquest 변경 금지).
