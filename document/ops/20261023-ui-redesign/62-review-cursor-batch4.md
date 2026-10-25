# 독립감리62 — 묶음4 diff (지시58)

| 항목 | 값 |
|---|---|
| 갱신 | 2026-10-25 KST |
| 감리 | **Cursor CLI** (독립, diff·문서만) |
| 범위 | `git diff HEAD` 기준 묶음4 제품(Codex) + fixture·시험(Cursor) |
| 금지 준수 | 제품·시험 코드 수정 없음, 서버·Playwright·quick 재실행 없음, 커밋·배포 없음 |
| quick 근거 | `document/ops/20261023-ui-redesign/evidence/instruction58/quick.log` (실행자 수집본, 본 감리는 재실행 안 함) |

## 총판정

**DIFF_OK / SCREEN_PENDING / GATE_PARTIAL**

- 지시58·계획56·감리57이 요구한 **기능 분리·결선·고정9·센서 CTA·주행 중 최초 연결 제한**은 diff 상 대체로 맞다.
- 시안12~15 **픽셀·공간밀도·Chief 화면**은 diff만으로 PASS 할 수 없다 → 전 항목 `SCREEN_PENDING`.
- 잠금 e2e·`ui-redesign-batch4`·tsc·eslint·실앱 진입은 **본 감리 미실행**. instruction58 `quick.log`만 인용.

---

## diff 소유 구분

| 구분 | 경로 (미커밋) |
|---|---|
| Codex 제품 (지시58) | `CadenceSensorSheet.*`, `RideSettingsSheet.*`, `RideSettingsPanel.tsx`, `MapViewSheet.*`, `ProfileEditSheet.*`, `ui/SettingsCloseIcon.tsx`, `ui/SettingsSurface.css`, `App.tsx` (설정·결과→프로필 결선) |
| Cursor fixture·시험 | `scripts/ui-800x360/preview.tsx`, `e2e/ui-redesign-batch4.spec.ts` (untracked), `e2e/calorie-profile-sync.spec.ts`, `scripts/ride-calories/calorie-settings-ui-fixture-main.tsx` |
| 묶음3·동시 dirty (본 감리에서 되돌리지 않음) | `NextRideCard.*`, `RideSummarySheet.*`, `RouteDock.tsx`, 기타 e2e·preview 일부 — 묶음4 Codex 범위 밖 |

---

## Chief 고정 1~14 (batch4 diff만)

| # | diff 판정 | 근거 |
|---|---|---|
| 1·2·4~8·10~14 | **미접촉** | batch4 제품 diff에 RouteDock·HUD 시작/일시정지·순위칩·경로목록·주소카드·측면탭 파일 없음 (`RouteDock.tsx` 변경은 동시 묶음3 dirty, 센서 시트와 무관). |
| 3 | **미접촉** | `MapViewSheet`·`CadenceSensorSheet`는 HUD 지도 스타일/줌 버튼 미포함. |
| 9 | **diff 준수** | `MapViewSheet.tsx` 본문에 야외·위성·Spinatlas Dark·지도 스타일/시점/줌 UI 추가 없음. `map-view-sheet__zoom-step`은 기존과 동일하게 **주행 카메라 거리(m)** 단계 조절(`rideCameraDistanceM`, L178–218) — HEAD에도 동일 패턴. `ui-redesign-batch4.spec.ts` L177–178이 시트에 야외/위성/Dark 없음을 시험으로 고정. |

---

## 항목별 감리 (줄 근거)

### CadenceSensorSheet — 센서 CTA·주행 중 제한

| 검사 | 판정 | 근거 |
|---|---|---|
| 주행 자동 시작 없음 | **DIFF_OK** | `이 센서로 달리기`는 `onChooseCadence()`(cadence 아닐 때만) + `onClose()`만 호출(L166–169 diff). `startRide`·RouteDock Go 호출 없음. |
| 주행 중 최초 연결 제한 | **DIFF_OK** | `allowFirstSetup = !props.riding` (L72–73), `showReconnect`가 `allowFirstSetup \|\| cadenceMode` (L74–75). `riding && !cadenceMode` 시 안내 문구·연결 버튼 숨김 분기 (L139–143, L148 `showReconnect`). |
| CTA·닫기·aria | **DIFF_OK** | `aria-label="케이던스 센서"` 유지. 원형 `SettingsCloseIcon` + `title="닫기"` (L83–118). |
| 시안12 레이아웃·hero RPM | **SCREEN_PENDING** | 2열 grid·`min-height: 204px` 등 `CadenceSensorSheet.css` L1297–1341. 800×360 지도 면적은 캡처 없음. |

### RideSettingsSheet / RideSettingsPanel

| 검사 | 판정 | 근거 |
|---|---|---|
| 체중·강도 편집 제거 | **DIFF_OK** | `RideSettingsPanel.tsx`: 체중 input·강도 칩 블록 삭제, `role="switch"` 4행 + 칼로리 읽기 전용 행 + `프로필 수정` (diff L1034–1194). |
| App 결선 | **DIFF_OK** | `App.tsx`: `onCalorieWeightKg`/`onCalorieIntensityId` 제거, `onEditProfile` → 설정 닫고 `setProfileEditOpen(true)` (diff L749–756). |
| 주행 결과 칼로리 진입 | **DIFF_OK** | `RideSummarySheet` `onOpenCalorieSettings` → `setProfileEditOpen(true)` (diff L764–765), 설정 시트 경유 제거. |
| 4 switch | **DIFF_OK (구조)** | 코칭·TTS·BGM·페이서 + `input[role="switch"]` (`RideSettingsPanel` diff). 시각·터치 44px → **SCREEN_PENDING**. |
| embedded prop | **주의** | `embedded` 클래스만 남음, 호출처 없음 — 회귀 위험 낮음. |

### MapViewSheet

| 검사 | 판정 | 근거 |
|---|---|---|
| 고정9 | **DIFF_OK** | 스타일/시점/지도줌 UI 없음. 3D·도로망·노선·고급 거리 유지 (`MapViewSheet.tsx` L100–218). |
| 시안14 우상단 판 | **SCREEN_PENDING** | `.map-view-sheet.settings-surface` `align-items: flex-start`, `width: min(320px…)`, `margin: 8px` (`MapViewSheet.css` L907–912). 높이 ≤210px는 `ui-redesign-batch4.spec.ts` L173 — **미실행**. |
| 닫기 | **DIFF_OK** | `SettingsCloseIcon`, `title="닫기"` (tsx diff L968–978). |

### ProfileEditSheet — 저장·게스트·닉네임·탈퇴

| 검사 | 판정 | 근거 |
|---|---|---|
| 게스트 닉네임 | **DIFF_OK** | `isGuest` 시 입력 없음·안내 문구 (tsx L139–142, 기존 로직 유지). |
| 30일 닉네임 잠금 | **DIFF_OK** | `nicknameChangeBlockedUntilMs`·`nicknameLockedUntilMs`·disabled input (L59–62, L153). 정책 함수/import 변경 없음. |
| 저장·탈퇴 | **DIFF_OK** | `handleSubmit`·`deleteMyAccount`·`prepareStartScreen`·게스트 탈퇴 가드 (L78–117, L105–117) diff에서 로직 변경 없음(표현·레이아웃만). |
| 체중 ±·운동 강도 라벨 | **DIFF_OK (표시)** | ± 버튼·`운동 강도` kicker (diff L872–895). `CALORIE_INTENSITY_OPTIONS` id·MET 미변경. |
| 시안15 | **SCREEN_PENDING** | `settings-surface`·슬라이더·segmented 칩 CSS (`ProfileEditSheet.css` L779–812). |

### 공유 SettingsSurface / CloseIcon / App

| 검사 | 판정 | 근거 |
|---|---|---|
| 공통 CSS | **DIFF_OK** | `SettingsSurface.css` — 흰 판·원형 닫기·switch 스타일. `SettingsCloseIcon.tsx` import로 시트에 로드. |
| 프로필·App | **DIFF_OK** | `ProfileEditSheet`·`RideSettingsSheet`·`UserInfoSheet.onEditProfile` 기존 결선 유지 (`App.tsx` L3482–3496). |

### preview · batch4 spec · calorie fixture

| 검사 | 판정 | 근거 |
|---|---|---|
| 묶음3 preview 보존 | **DIFF_OK (구조)** | `nextride-resume`/`extend`·`NextRideCard`·`batch3-next-ride-fixture` 추가, 기존 glance/summary 흐름 유지 (`preview.tsx` diff). |
| batch4 관측 | **DIFF_OK** | `#batch4-fixture` data-* · 센서/설정/맵/프로필 state (`preview.tsx` diff L712–737). |
| `ui-redesign-batch4.spec.ts` | **미실행** | 센서 자동시작 없음·riding-manual·고정9·프로필 시나리오 정의됨 — 실행 증거 없음. |
| calorie sync e2e | **DIFF_OK (의도)** | 설정 요약 + 프로필 경로로 시나리오 갱신 (`calorie-profile-sync.spec.ts` diff). 에뮬레이터 시험 **미실행**. |
| calorie UI fixture | **DIFF_OK** | `RideSettingsSheet` + `ProfileEditSheet`, setter는 프로필만 (`calorie-settings-ui-fixture-main.tsx` diff). |

---

## 위험·누락 (diff)

1. **맵 뷰 패널 위치·높이** — 우상단 320px 판은 기존 하단 시트와 겹침·드래그 transform 상호작용이 diff만으로 안전하지 않음 → **SCREEN_PENDING** + 기존 `ui-800x360` 맵 높이 잠금 재확인 필요.
2. **센서 시트 최소 높이 204px** (`CadenceSensorSheet.css`) — 가로 275px급 뷰에서 지도 가림 → **SCREEN_PENDING** (공간밀도 D 규칙).
3. **연결된 상태에서 항상 `이 센서로 달리기` 표시** (`CadenceSensorSheet.tsx` L157–174) — cadence 모드에서도 닫기만 함. 동작 회귀는 낮으나 UX **SCREEN_PENDING**.
4. **`ProfileEditSheet.css` L777–779** — `}` 와 주석이 한 줄에 붙음(파싱은 되나 유지보수 흠).
5. **동시 dirty** — `NextRideCard`/`RideSummarySheet`/`RouteDock`이 같은 트리에 있어 묶음4 단독 배포·감리 시 혼선 가능. 지시58대로 보존, 본 감리는 묶음4 제품 파일만 판정.
6. **잠금 e2e 미검** — `ui-800x360`·`route-dock-riding-content` 등도 working tree 변경 있음. batch4가 고정11·12를 깨는지 **미실행**.

---

## quick.log — `guest-auth-notice-viewport.test.mjs` (30일 안내)

| 질문 | 결론 |
|---|---|
| 이번 묶음4 제품이 원인인가? | **아니오 (diff 근거)** |
| 시험/문구 불일치인가? | **아니오** — 기대 문자열은 fixture의 `guest-expired` → `authExpiryNoticeText` |

**근거**

1. `git diff HEAD -- apps/web/src/components/auth/ apps/web/scripts/identity/guest-auth-notice-viewport.test.mjs` → **빈 diff** (batch4가 Guest/만료 UI·해당 시험 파일을 건드리지 않음).
2. 시험 L91: `getByText("30일간 사용하지 않으면")` — `apps/web/src/lib/identity/authRestore.ts` L58: `게스트 체험이 만료되었습니다. 30일간 사용하지 않으면 기록이 정리됩니다.` 부분 문자열 일치.
3. Fixture L37–43: `GuestEntryCard` + `expiryKind: "guest-expired"` → `AuthExpiryNotice` → 위 문구 렌더 (변경 없음).
4. `quick.log` L1403–1411: 실패 형태는 **문구 불일치가 아니라** `locator.waitFor: Timeout 30000ms exceeded` (요소 미표시·페이지 미로드·Playwright/Vite 지연 가능). 테스트 총 소요 ~47s.
5. 동일 `quick.log`의 **tools** 실패 3건(`e2e-deadline-watchdog.test.mjs`, Windows `kill` 거부)도 batch4와 무관한 **환경/도구** 쪽 신호.

**조치 제안 (구현은 별도 지시)** — batch4 차단 조건으로 보지 말 것. 재현 시 guest-auth 시험 단독 실행·Vite 기동·Edge headless 로그 확인. 필요 시 타임아웃/서버 ready 대기만 조정(제품 문구 변경 불필요).

---

## 검증 매트릭스 (본 감리)

| 항목 | 상태 | 비고 |
|---|---|---|
| diff 정적 감리 (본 문서) | **완료** | |
| 화면·시안12~15 | **SCREEN_PENDING** | |
| `npx playwright test ui-redesign-batch4` | **미실행** | |
| `ui-800x360`·batch1·ride-entry 등 잠금 | **미실행** | tree에 다른 e2e diff 존재 |
| `npm run test:quick` | **인용만** | ride 856/1 fail = guest-auth timeout; tools 3 fail |
| `tsc` / eslint / selector gate | **미실행** | |
| 실앱 5017·프로필 동기화 | **미실행** | |

---

## 다음 (Supervisor/Codex, 본 감리 범위 밖)

1. Chief·시안 대비 캡처 — `BATCH4_EVIDENCE_DIR` / `evidence/instruction58/`.
2. Playwright batch4 + 잠금 묶음 재실행 후 감리63 또는 결과59 갱신.
3. guest-auth·deadline-watchdog 실패는 환경/단독 재현 후 batch4와 분리 트래킹.

**커밋·배포·제품 수정·되돌림 — 없음 (본 감리).**
