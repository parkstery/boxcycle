# 감리73 — 묶음3~5 독립 감리(Claude Code)

2026-10-25 KST · Supervisor Claude Code 직접(구현은 Codex·Cursor CLI, [67](67-result-batch5.md)·[59](59-result-batch4.md)·[51](51-result-batch3-revalidation.md)·[53](53-result-ride-continuation.md)). Chief 지시: 외부 agent 구현이 디자인과 동떨어진 적이 있으니 Supervisor 가 직접 감리.

## 0. 시작 전 사고 확인 — 지시72(중단)

09:09 Chief 가 실수로 Codex 에 묶음6 진행을 지시했다가 중지. Codex 산출물 = [72](72-task-batch6.md)·`evidence/instruction72/`(시작 지문 332개·AppIntroScreen 사본)·HANDOFF 담당/갱신 행. 08:30 이후 `apps`·`functions`·`scripts` 변경 0, Codex 시작 지문 332개 중 HANDOFF 외 전부 일치, `AppIntroScreen.tsx` = HEAD. 담당 행 복구, 72 는 무효 표기·보존.

## 1. 고정 목록 1~14 대조 — 실제 `git diff`

| 고정 | 관련 diff | 판정 |
|---|---|---|
| 1 녹색 재생 | 팝업 시작 버튼 클래스 `ride-media-button--play` 그대로, 28px 는 HEAD `MapView.css:248` 와 같은 값. `ui-edge-live` 는 44px·글자 없음·50%·`rgb(0, 150, 39)` 로 **강화** | PASS |
| 2·3·4 | 일시정지 조작·지도 스타일/줌·순위 칩 파일 변경 없음 | PASS |
| 5·6 | 경로 목록 파일 변경 없음 | PASS |
| 7·8 | 지도 위 계기판 변경 없음. 새 단위 전부 소문자 `km`·`kg`(`체중(Kg)` → `체중`+`kg`) | PASS |
| 9 | `MapViewSheet` 는 껍데기·닫기 아이콘·스위치 모양만. `zoom-step` 은 HEAD 부터 있던 고급 설정 「주행 카메라 거리」(지도 줌 아님) | PASS |
| 10 | 계정 패널·인라인 기록 파일 변경 없음 | PASS |
| 11·12 | `RouteDock.tsx` 는 빈 경로 + 센서가 이 카드에 **실제로 배치될 때만** 카드를 남기도록 조건 순서만 바꿈(빈 카드 회귀 복구). 폭·⇅·✕·센서 줄 CSS 변경 없음. `ui-edge-live` 가 29.4vw·S/E 두 줄·접힘 시작·주행 중 ✕⇅ 0 으로 **강화** | PASS |
| 13 | `mapPopupElements.ts` 의 버튼 글자 Start·+WP·End·탭 Start·End 그대로. 바뀐 것은 마우스 설명(title) 영어→한국어뿐(화면 읽기 이름은 원래 한국어) | PASS |
| 14 | 측면 탭 파일 변경 없음 | PASS |

잠금 시험 `ui-800x360.spec.ts` 는 증거 폴더 env 한 줄만 바뀜(기대값 변경 0).

## 2. 시험 기대값 완화 여부

지워진 단언을 전부 대조. `ui-edge-live`(≤220px·≤36px → 고정11·12·1 의 정확한 값으로 강화), `distance-direction-attention`(커밋 `0ec14853` 10-22 「적용 수단 유지」 동작에 맞춤 + 수동 강조 3단 애니메이션은 별도 시험으로 보존), `route-ride-controls`(고정12: setup 센서는 주소 카드 맨 위 줄), `calorie-profile-sync`(체중·강도 편집이 프로필로 옮겨져 같은 72/강함·65.5/가벼움 값을 새 위치에서 검사), `route-pick-popup-title`(로컬 에뮬레이터에서만 돌도록 skip 조건 추가 + 첫 팝업 화면 안 경계 단언 추가). **완화 없음.**

## 3. 동작·문구 관찰

- 묶음4: 주행 설정 판의 체중·강도 직접 입력 제거 → 요약 한 줄 + 「프로필 수정」. 주행 결과의 칼로리 설정 버튼도 프로필 수정 판을 연다. BLE 연결 로직 변경 없음(센서 판 화면·문구 정리, 연결 상태에서 「케이던스로 달리기」 누르면 판 닫힘).
- 묶음5: `mountPickPopupViewportClamp` 는 ResizeObserver + rAF 로 팝업을 지도 안 8px 로 당김, 닫힐 때 해제. 지도 이동 중엔 다시 계산하지 않음(첫 표시·크기 변화만) — 의도 범위.
- **정정(10:40 Claude Code)**: 처음엔 「게스트 로그아웃 경고가 빠졌다」고 보고했으나 틀렸다. 10-19 결정(결정 로그 27·28행)으로 게스트 「로그아웃」은 `endAppUse` — Firebase 세션을 남기고 화면에서만 가린다(`hooks/useAppAuth.ts:531`). 다시 「게스트로 시작」하면 같은 uid 로 resume 한다. 따라서 옛 문구 「로그아웃하면 사라집니다」는 현재 동작과 어긋나고, 감리34 의 교체가 맞다. 문구는 그대로 둔다. 쌓인 게스트는 10-19 이전 정책(10-09 「로그아웃 = 삭제 후 새 게스트」) 산물로 보이며, 매일 03:15 `guestLifecycleSweep` 가 30일 미활동 게스트를 정리한다. Chief 10-25 제안 「게스트에게 로그아웃을 주지 말자」는 별도 결정·지시로 다룬다.

## 4. Claude Code 재실행 결과

출력 경로 env 는 모두 scratchpad 로 돌림(기존 증거 덮어쓰기 방지). 프리뷰 5020, 실앱 5022(Chief 5017 회피).

| 검사 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npm run test:quick` | 1360/1360 PASS (75.2초) |
| `verify-selectors.mjs` | 19단계 유효 |
| 변경 src eslint | 오류 0 · 경고 16(App·MapView 기존) |
| 루트 tidy · dep-direction · document-system · `git diff --check` | 모두 exit 0 |
| 화면 묶음 11파일(잠금 ui-800x360·address-minimap·batch1~5·route-media·distance-direction·route-ride-controls) | **105 PASS / 5 FAIL** → 아래 ① 교정 후 route-ride-controls 9/9 |
| Codex·Cursor 가 안 돌린 관련 시험(프리뷰) | distance-route-result-layout 3 FAIL·distance-route-continuation 1 FAIL → ②③ 교정 후 4/4. ride-summary-compact 센서 판 1 FAIL(HEAD 에서도 FAIL — 기존 결함). map-route-runtime·route-token-ui-smoke·sensor-chip-6a·map-route-pick-gesture PASS |

### 묶음5 가 깨뜨렸는데 아무도 못 본 시험 — FAIL 판정 후 Claude Code 교정

Codex 최종 회귀(`evidence/instruction65/ui-final.log`, 101건)는 `route-ride-controls`·`distance-route-*` 를 포함하지 않았다(Cursor 조사66 은 route-ride-controls 를 관련 파일로 짚었음). **HEAD 복제본(`tmp/audit73`, b9852157)에서 같은 시험 9건 PASS** → 묶음5 로 생긴 실패임을 A/B 로 확인.

1. `route-ride-controls.spec.ts:81`(5건): 10-21 압축 계약 「토큰·탭 한 줄, 탭 ≤22px, 탭이 닫기 왼쪽」. 시안05 는 큰 분할 탭. 실측(토큰 56~80 · 탭 88~122, 탭 28px · 닫기 54~86 겹침 없음)대로 **토큰 위·탭 전체 폭·탭 28px·닫기와 겹침 없음·토큰 글자가 닫기 아래로 안 들어감·경로 지우기 위치** 9개 단언으로 교체. 화면 넘침 검사는 유지. 첫 단언에서 멈춰 그동안 실행 안 되던 모드 전환·값 보존·수단 즉시 생성 단언도 PASS.
2. `distance-route-result-layout.spec.ts`(3건): 선택 수단 색 `#2563EB` → 묶음5 디자인 파랑 `#2457d6`. 나머지(두 줄 메시지·폭 고정·한 행 5버튼·화면 안) 그대로 PASS.
3. `distance-route-continuation.spec.ts`(1건): 왼쪽 dock 판이 300px(x≈8~308)로 넓어져 시험 지점 (300,250)·(300,80) 이 판 아래. 지점을 판 바깥(380/420/480)으로 옮기고 「그 지점이 지도 캔버스」 단언을 새 지점마다 둠.

세 파일과 `ride-summary-compact` 의 캡처 경로에 env 우선(없으면 종전 `.out`)을 더했다.

### 사고 — Claude Code 가 `.out/` 1장 덮어씀

`route-ride-controls` 를 한 번 env 없이 돌려 `.out/ui-route-ride-20261021/popup-11-ready-800.png`(원본 SHA256 `1278EC7A…CEAD`, 10-24 20:12, 지시65 시작 지문 기록)를 묶음5 화면으로 덮었다. 같은 지문의 사본 없음. HEAD 복제본에서 같은 시험으로 같은 장면을 다시 찍어 넣었다(`FD7E854E…6020`, 바이트는 다름). 이후 모든 실행은 env 지정.

### 출처 불명 dirty 의 출처

`document/archive/ride-verify-evidence/*.png` 3장 수정 시각 10-24 22:58:40~22:59:08 = 지시52 직후. `ride-continuation.spec.ts` 의 기본 출력이 이 폴더이므로 `RIDE_CONTINUATION_EVIDENCE_DIR` 없이 돌린 실행 결과로 본다. 되돌리지 않고 보존(커밋 제외).

### 에뮬레이터 실앱 시험 — 메모리 부족으로 중단(미완)

10:0x KST 5022 에서 ride-entry·route-dock-riding-content·ride-summary-compact·ui-edge-live·calorie-profile-sync·route-pick-popup-title·ride-continuation 25건 시작. calorie-profile-sync 2건 진행 후 RC1 실행 중 **Claude Code 하네스가 시스템 메모리 부족으로 강제 종료**(여유 약 4.8GB/16GB — ChatGPT·Codex 앱 약 2.1GB, Chrome 1.3GB, Claude 세션 10개 등). 포트 5022·에뮬레이터 모두 닫힘 확인. 다시 돌리려면 Chief 허락 필요. 특히 `ride-continuation`(경로 팝업 탭 사용)은 묶음5 위에서 아직 한 번도 PASS 기록이 없다.

정리: 10-20 부터 새어 남은 시험 보조 프로세스 `hang-with-child.mjs` 7개 종료(test:quick 「시험 도구 자체」 산물). Playwright MCP 프로세스 다수는 다른 세션 것일 수 있어 그대로 둠.

## 5. 판정(중간)

- 고정 1~14: PASS. 기대값 완화: 없음.
- 묶음5 검증 범위: **FAIL → 교정 완료**(옛 시험 3파일 9건 시안05 기준 갱신, HEAD A/B 로 원인 확정).
- 실앱 에뮬레이터 재확인: **미완**(메모리 부족 중단).
- ~~Chief 결정 대기: 묶음5 화면 승인, 게스트 로그아웃 경고 문구(§3).~~ → 10-25 Chief: 묶음5 **승인(조건부)** — 두 탭 맨 아래 줄 통일 [지시74](74-task-result-popup-bottom-row.md). 게스트 문구는 현행 유지(§3 정정), 게스트 로그아웃 자체를 없앰 [지시75](75-task-result-guest-no-logout.md) — 이번 배포에 함께.
- 남은 것: 지시74 Chief 화면 확인, 에뮬레이터 실앱 시험(ride-continuation 등 + guest-lifecycle·account-deletion-ui-shots) 재실행 허락, 커밋·푸시·배포 일괄 승인.
