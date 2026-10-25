# 묶음4 준비 조사 — 센서 · 주행 설정 · 맵 뷰 · 프로필 수정

| 항목 | 값 |
|---|---|
| 작성 | Cursor Developer — 2026-10-24 조사만 (제품·시안·시험 미수정) |
| 전제 | 묶음3 `LOCAL_VERIFIED`·Chief 화면 확인 **대기** — 본 문서는 **구현 승인 아님** |
| 비교 페이지 | `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-plan.html` |

## 근거 파일

| 구분 | 경로 |
|---|---|
| 묶음·시안 상태 | `document/ops/20261023-ui-redesign/README.md` (12~15 ⬜/◐, 체중·강도→프로필) |
| Chief 고정 | `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` **#3·#9** |
| 디자인 규칙 | `document/ops/20261023-leaderboard/design-system/README.md`, `tokens.json` |
| 시안 HTML·PNG | `document/ops/20261023-ui-redesign/mockups/12-Sensor.*` … `15-Profile.*` |
| 맵 뷰 다이어트(이미 반영된 범위) | `document/ops/20261023-mapview-diet/00-task.md` |
| **센서** | `apps/web/src/components/sensor/CadenceSensorSheet.tsx`, `.css`, `SessionSpeedControl.tsx` |
| **주행 설정** | `apps/web/src/components/ride/RideSettingsSheet.tsx`, `RideSettingsPanel.tsx`, `.css` |
| **맵 뷰** | `apps/web/src/components/map/MapViewSheet.tsx`, `.css` |
| **프로필** | `apps/web/src/components/ProfileEditSheet.tsx`, `.css` |
| 결선·상태 | `apps/web/src/App.tsx` (3419~3490, `onOpenCalorieSettings`→3556~3565), `apps/web/src/app/useAppSheetNavigation.ts` |
| 체중·강도 SoT | `apps/web/src/hooks/useCalorieProfile.ts`, `lib/ride/caloriesEstimate.ts`, `repo/calorieProfile*` |
| 지도 스타일(HUD) | `apps/web/src/lib/map/rtwMapConfig.ts`, `App.tsx` `mapStyleHudShortLabel` / `nextOutdoorsSatelliteMapStyle`, `useAppMapCameraState.ts` |
| 하네스 | `apps/web/scripts/ui-800x360/preview.tsx` (`state=sensor|settings|map`, **ProfileEdit 미포함**) |
| 잠금 시험(일부) | `apps/web/e2e/ui-800x360.spec.ts`, `ui-redesign-batch1.spec.ts`, `ride-entry.spec.ts`, `route-ride-controls.spec.ts`, `sensor-chip-route-dock-6a.spec.ts`, `ride-continuation.spec.ts`, `touch-targets-44.spec.ts` |

## 시안 대 코드 — 요약 (기능은 유지, 겉모양·정보 위계만 묶음4 목표)

### 12 케이던스 센서

| 시안 | 현재 |
|---|---|
| 가운데 **두 칸 판**(왼쪽 hero RPM·연결, 오른쪽 설명·체험 속도·CTA) | **하단 좁은 시트** `cadence-sheet`, RPM은 작은 줄 텍스트 |
| 닫기 **회색 원 + 선 아이콘** | 텍스트 버튼 「닫기」(`title="Close"` 잔존) |
| 주 버튼 「이 센서로 달리기」 | `onConnect` / `onChooseCadence` / `onChooseManual` 등 **다중 버튼** (동일 props 계약) |
| 체험 속도 ±·숫자·km/h 한 줄 | `SessionSpeedControl` (SPD/km/h 2줄 kicker) |

**보존:** `CadenceSensorSheetProps` 전부, `riding` 시 최초 센서 설정 금지·`ALLOW_MANUAL_SPEED_WHILE_RIDING`, `aria-label="케이던스 센서"`, RouteDock 칩 진입(`openCadenceSensorPanel`).

### 13 주행 설정

| 시안 | 현재 |
|---|---|
| **목록 행 + role=switch** (코칭·음성·BGM·페이서) | `RideSettingsPanel` **체크박스** 그룹, 라벨 「코칭 배너」 |
| 체중·강도 **입력 없음** — 요약 + 「프로필 수정」 | `App.tsx`가 여전히 `calorieWeightKg` / `onCalorieWeightKg` / `onCalorieIntensityId` **전달** → 패널에 숫자 입력·강도 칩 **그대로 노출** |
| 단일 흰 판·헤더 닫기 원형 | 하단 시트 + ✕ 닫기 |

**Chief/README 결정:** 체중·강도 입력은 **프로필 수정에만** — 시안 13은 이미 반영, **코드는 미이행**.

### 14 맵 뷰

| 시안 | 현재 |
|---|---|
| 우상단 **떠 있는 판** (~320px), Segmented 도로망·3D switch | 우측 **하단 시트** `map-view-sheet`, 칩·체크박스 |
| 고급: 노선·**주행 카메라 거리**(시안은 고급 안에 노출) | 동일 기능은 **`<details> 고급 설정`** 안, `rideActive`일 때만 거리 슬라이더 |
| 스타일·시점·줌 **없음** | 다이어트 후 시트에도 **없음** (맞음) |

**고정 #9:** 야외·위성만(`rtwMapConfig`), HUD 토글·+/−가 스타일·줌 담당 — **맵 뷰 판에 스타일·시점·줌 추가 금지**.

### 15 프로필 수정

| 시안 | 현재 |
|---|---|
| 그리드 행, 체중 **슬라이더+±·hero kg** | number input + slider 병행, ± **없음** |
| 「운동 강도」 **5칸 Segmented**(아주 약하게…아주 강하게) | kicker 「체력」, `CALORIE_INTENSITY_OPTIONS` 라벨(매우 가벼움…매우 강함) **5칩** |
| 헤더 원형 닫기·취소/저장 하단 | 시트 공용 스타일, **헤더 닫기 버튼 없음**(취소만) |
| 계정 탈퇴 작은 글자 | 구현됨(확인 UI 포함) — 시안보다 깊음 |

**보존:** `onChangeNickname`·30일 잠금, `onWeightKg`/`onIntensityId` 저장·`useCalorieProfile` 동기화, 게스트 닉네임 불가, `z-index` 계정 시트 위.

## 필요 수정 (지시서 57+ 범위 예상 — 구현은 Chief·묶음3 확인 후)

1. **시각:** 네 시트를 mockups 12~15·design-system(흰 판·한 주인공 숫자·switch/segmented·원형 닫기)에 맞춤. **하단 시트 vs 가운데/우상단 판** 배치는 시안 따름(맵 뷰·센서 레이아웃 변화 큼).
2. **주행 설정:** `RideSettingsPanel`에서 체중·강도 편집 제거 → 시안 13 「칼로리 계산」행(읽기 전용 kg·강도 + **프로필 수정**). `App.tsx`에서 설정 시트로 calorie setter 넘기기 중단 또는 optional 미전달. **`RideSummarySheet.onOpenCalorieSettings`** 는 현재 `openRideSettingsPanel` — **프로필 수정으로 바꿀지** 지시 필요.
3. **프로필:** 체중 UX(±·hero)·강도 Segmented·문구(「운동 강도」/해요체) 시안 정렬. **데이터 id·MET·저장 콜백은 그대로.**
4. **센서:** 왼쪽 live RPM hero·연결 상태·시안 CTA와 기존 `onChooseCadence`/`onConnect` 매핑 — **새 상태 machine 없이** 버튼 재배치만.
5. **맵 뷰:** 판 형태·Segmented·switch 스타일; **고정 #9·다이어트 범위 유지**(스타일/시점/줌/POI 복원 금지). 패널 높이 `ui-800x360` ≤210px 계약 검토.
6. **하네스:** `preview.tsx`에 `ProfileEditSheet` state·캡처 경로 추가; calorie props 정리.
7. **공통:** `title="Close"` 등 영어 title 정리(design-system), Chief **#3** HUD 스타일·줌 버튼 건드리지 않음.

## 금지

- **타인(Codex) 미커밋 변경 되돌림** — 묶음3 `NextRideCard`/`RideSummarySheet`/e2e 등.
- 묶음3 Chief 확인 전 **묶음4 제품 구현·배포·커밋** (본 조사는 계획만).
- Chief 고정 **#3**(주행 중 HUD 야외/위성·줌), **#9**(Dark 없음·맵 뷰에 스타일/시점/줌 없음), **#12~14** RouteDock·측면 탭.
- mockups 12~15·batch3 증거·`HANDOFF`/`PROGRESS` 등 **본 작업 소유 외 문서 수정**.
- 센서 준비·BLE·순위 제외·수동 속도 정책 등 **도메인 동작 변경** (props/콜백 시그니처 유지).
- `git restore`/`clean`/`stash`/`worktree`, 서버 기동·브라우저·커밋·푸시.

## 시험 (구현 후 최소)

| 명령·파일 | 기대 |
|---|---|
| `npx playwright test ui-800x360 --workers=1` | 맵 뷰 높이≤210, 한국어, OSRM/free 숨김, 설정·센서 닫기 |
| `ui-redesign-batch1.spec.ts` | MENU→주행 설정 |
| `ride-entry` / `route-ride-controls` / `sensor-chip-route-dock-6a` / `ride-continuation` | 센서 dialog 이름·칩 1개·연결 흐름 |
| `touch-targets-44.spec.ts` | 센서 시트 터치 |
| 신규 `ui-redesign-batch4.spec.ts` (수퍼바이저) | 시안 대비 캡처·switch·프로필 링크·칼로리 행 요약 |
| `npx tsc -b`, `npm run test:quick`, 변경 파일 eslint | 회귀 0 |

캡처: `document/ops/20261023-ui-redesign/evidence/batch4/` (지시서에서 확정).

## 미해결 결정 (Chief·수퍼바이저)

1. **「이 센서로 달리기」** = `onChooseCadence`+닫기 vs `onConnect`만 vs 기존 다중 버튼 유지 중 시각만 CTA 하나.
2. **주행 결과 「체중·강도 설정」** → 프로필 수정 직행 vs 주행 설정 경유(시안 13은 프로필).
3. **강도 라벨** — 시안(아주 약하게…) vs 코드 상수(매우 가벼움…) · Profile 「체력」 vs 「운동 강도」.
4. **맵 뷰 주행 카메라 거리** — 시안은 고급 블록 안 항목; 현재도 고급 안. 기본 펼침/숨김·패널 위치(우상단 vs 우하단 시트).
5. **설정 시트 calorie props** — `RideSettingsPanel` UI만 숨기기 vs `App`/`MenuPanel` embedded 설정까지 prop 제거 범위.
6. **묶음4 착수 게이트** — 묶음3 Chief 승인·오늘 RouteDock(44~48) 위 재캡처 선행 여부 (`HANDOFF` 남은 일 1).
