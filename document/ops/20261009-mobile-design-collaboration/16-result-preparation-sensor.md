# TASK-04 Muse Free 조사 결과

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Developer stdout 보존 |
| 최초 작성 | 2026-10-09 |
| 상태 | DEVELOPMENT_DONE — 제한 조사 |
| 독자 | chief · AI |
| 연결 문서 | [지시](15-task-preparation-sensor.md) · [검수·시안](17-design-preparation-sensor.md) · [로그](muse-task-04-output.log) |

실행: opencode-cli.exe run --model opencode/muse-spark-1.3-contributor-free --title "RTW preparation sensor read-only design audit" --file document/ops/20261009-mobile-design-collaboration/15-task-preparation-sensor.md (읽기 전용 stdout 요청).
종료코드0. 자동 권한승인 미사용. Supervisor 보존, Developer 소스쓰기 없음.

## 최종 응답 원문

~~~text
# TASK-04 결과

## 1. 보존 필수 계약

**`RouteDock.tsx:12-42,50-82,152-156,223-246`:**
필드: `stage/stops/routeLoading/canStartRide/sensorAttention/resumeRatio/editLocked/cadence`。 핸들러: `onStartRide(fromStart?)/onPauseRide/onResumeRide/onEndRide/onRemoveStop/onFocusStop/onAbandonResume`。 상태: `expanded/restartFromZero/prevResumeRatio`。 `goDisabled`는 `ready-to-start && canStartRide && !routeLoading && !editLocked`에서만 해제. 세 주행 버튼은 항상 DOM 유지·`disabled` 전환.

**`RideRoutePanel.tsx:21-95,97-111`:**
`routeSummary`는 표시만, 생성은 RouteDock 소유. 사용자 경로 `savedRoutes/loading/onLoad/onResume/onRename/onDelete/activeResumeRouteId/quotaNotice`，ad-hoc 저장 `adhocSaveAvailable/SuggestedName/Draft/Busy/Error/ConfirmUpdate/onSaveAdhocAsUserRoute/onDismissAdhocSave`，공식·퍼블릭 카탈로그，`rideTts/Bgm/CoachingBanner/pacer/elevationProfileLoading/bgmCatalogConfigured` 토글군.

**`CadenceSensorSheet.tsx:13-33,64-74,139-208`:**
`open/onClose/capable/uiState/deviceLabel/crankRpm/errorMessage/mode/readiness/riding/manualSpeedKmh`，`onConnect/onDisconnect/onChooseManual/onChooseCadence/onManualSpeedKmh`，`SessionSpeedControl/rpmLine/blockedReason` 표시.

## 2. 소스 보장 동작만

- 센서 미연결 시작 가능: `cadenceSensorUi.ts:139,143`의 `manualChosen → manual-ready`가 `canStartRide` 경유 Go 허용.
- 체험 속도: 주행 전 시트에서 선택이 원칙(`:195-208`), 현재만 `ALLOW_MANUAL_SPEED_WHILE_RIDING=true`로 주행 중 재조정 한시 허용.
- 주행 중 변경 제한: `allowFirstSetup=!riding(:69)`，주행 중 manual 모드에서는 “다음 주행 전에 설정” 안내(`:130-134`)，자동 fallback 없음·명시 선택만(`:172`).
- `sensorAttention`은 경로 확보 후 입력 미선택 시 칩 점멸(`RouteDock.tsx:18-21,231`).

## 3. 버튼 현 의미

- `센서 연결(:139-147)`: `capable && !connected && !connecting && (주행 전 || cadenceMode)`일 때만 노출되는 재검색·연결 진입.
- `센서 없음(:173-183)`: `onChooseManual` 명시적 체험 모드 선택, `aria-pressed=manualReady` 상태 반영. 용어·기능 변경 제안 없음.

## 4. 기본/상세 분리 후보·미검증 범위

- 후보: 기본=Go·일시정지·종료·센서 칩·속도 요약, 상세=경유지 목록·재개 선택·ad-hoc 저장 폼·TTS/BGM/배너/페이서·장치명·rpm 상세·에러문. 삭제가 아닌 접기·모달 이동만 가능.
- 미검증: `canStartRide` 실제 산정식, `App` 측 readiness→Go 연결, 740×300 실측 배치. 추가 읽기 범위: `App.tsx` 연결부·`cadenceRideInput/manualSpeedWhileRiding`만 검색 수준, 전체 탐색 불필요.

## 도구

- 성공: `read` 3지정 파일 부분 읽기, `grep` 계약 경로 검색.
- 실패: 없음. 미실행: 서버 실행·브라우저 확인·편집·커밋 전부.

~~~

