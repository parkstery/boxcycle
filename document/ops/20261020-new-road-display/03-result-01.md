# 결과01 — 신규 도로 표시 복구

2026-10-20. main2 / 시작 HEAD 6952a279. Cursor CLI 1회 시도는 `uv_os_get_passwd returned ENOMEM`으로 exit 1, 구현 시작 전 종료. Codex가 직접 구현·검증. 기존 설계 세션과 다른 작업의 dirty는 보존, 커밋·푸시·배포 없음.

## 원인

1. App의 active→idle effect가 신규 도로를 `persistedRecentNewRoadGeometry`로 무조건 교체했다. 신규 서버 문서가 없거나 아직 도착하지 않으면 빈 배열이고, MapViewSheet의 `disabled={!conquestHasRecentGeometry}` 때문에 버튼 자체가 비활성화된다. 첨부 화면의 흐린 버튼과 일치하는 코드 경로다.
2. positive 콜백은 ref만 수정하고 state를 갱신하지 않아 양수 확정 후에도 신규 서버 문서만 기다렸다. HEAD의 기존 Functions에는 recentNewRoad/newGeometry가 없고 해당 변경은 시작부터 미커밋이었다. 실제 운영 배포 상태를 조회해 확정한 것은 아니다.
3. 실시간 거리·route는 종료 후 초기화되므로 종료 이전 후보 또는 이미 제공되는 `RideEndResult.sessionPathLngLat`가 필요했다.
4. 신규 도로 버튼은 표시 mode만 바꿨고, 이미 준비된 `focusConquestView("recent")`를 호출하지 않았다.

## 변경

- `apps/web/src/lib/conquest/recentNewRoadDisplay.ts`: 계정별 주행 상태 관리. 종료 경로 고정, 날짜별 합산, 주행 ID별 확정 결과 교체, 중복 콜백 멱등성, 최신 날짜 우선, stale snapshot 방지. zero/error/timeout은 현재 후보만 제거. timeout 이후 늦은 구버전 positive는 고정 경로에서 복구한다. 구버전 positive는 서버 newMeters 한도로 잘라 표시한다.
- `apps/web/src/hooks/useRecentRoadDisplay.ts`: 실제 React 상태와 콜백 연결. child passive effect가 먼저 실행되는 경우도 layout effect로 최신 입력을 먼저 연결하며 UID가 다르면 이전 geometry를 반환하지 않는다.
- `App.tsx`: 분산된 신규 도로 refs/effects를 위 hook으로 교체. 버튼을 recent 범위 이동에도 연결. 기존 도로 색·마젠타 강조 스타일 유지.
- `firestoreConquest.ts`: 기존 chunks 조회에서 취득 날짜도 보존하고 trace의 day를 읽는다. 기존 loadConquestCellIds API 보존.
- `useConquest.ts`: 기존 chunks/traces 읽기만 재사용해 최신 취득일의 모든 trace를 복원한다. 해당 날짜 소유 셀의 경로 조각만 포함하며 trace 전체를 신규로 사용하지 않는다. 개별 조회 실패 시 다른 성공 결과를 유지한다. 새 서버 문서가 같은 날짜이면 복원 내역과 함께 표시한다.
- 회귀시험 2개 파일 추가. 새 디버그 도구·주소 스위치·운영 데이터 쓰기는 추가하지 않았다.

## 검증

실행 위치: `C:\20.HDev\boxcycle\apps\web`.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/conquest/recent-road-display.test.ts scripts/conquest/new-road-geometry.test.ts scripts/conquest/overview-frame.test.ts scripts/ride-hierarchy/conquest-emphasis-contract.test.ts scripts/map/layer-order-contract.test.ts scripts/ride-result/ride-result-contract-0b.test.ts scripts/ride-result/ride-result-f2-boundary.test.ts scripts/ride-result/ride-result-f2-card-resume.test.ts scripts/ride-result/ride-result-s1-timers.test.ts scripts/ride-result/ride-result-s2-end-snapshot.test.ts
node --test scripts/conquest/recent-road-display-dom.test.mjs
npm run build
npm run lint
git diff --check
```

- 위 Node 회귀: **94 PASS, exit 0**. 누락된 서버 문서/종료 시 거리0/결과창 닫기/같은 날 여러 주행/중복 legacy positive/zero/error/timeout/늦은 positive/날짜 변경/다른 계정/기존·신규 혼합 trace/KST 자정 포함.
- 실제 React StrictMode hook + 실제 MapViewSheet, headless Edge: **1 PASS**, 667×390·844×390. 버튼 비활성→주행→종료→활성·클릭→구버전 positive→결과 닫기 후 유지→계정 전환 비활성 확인.
- build: 최초 기존 reset 함수 호출 잔여 2곳으로 실패 후 제거, 이후 PASS. 기존 SADDLE/PELVIS export 및 bundle 크기 경고 존재.
- 전체 lint: 최초 새 hook의 render 중 ref 쓰기 1오류로 실패, layout effect로 수정 후 **오류0/기존 경고40, exit0**. 최종 추가 변경 모듈의 targeted lint도 별도 확인.
- `git diff --check`: PASS. localhost:5000 GET 200 및 갱신된 hook 코드 제공 확인.

## 한계·직접 확인

- 사용자의 로그인된 Chrome 탭은 이 도구에 연결되지 않았다. 실제 계정 데이터·실제 주행 종료·실기기·Mapbox 지도 위 시각 결과는 직접 검증하지 않았다. 브라우저 시험은 제어된 입력으로 실제 React hook/시트를 검증한다.
- 기존 기록 복원은 저장된 trace와 기존 도로 셀 해상도에 기반하며, 과거 서버가 저장하지 않은 세부 신규 선형을 완벽하게 재생하는 것은 아니다. 저장 데이터와 인정 거리 계산은 바꾸지 않았다.
- 신규 서버 문서가 없는 환경의 복원 경로를 구현했으며 서버/Rules 배포를 완료했다고 주장하지 않는다. 이 작업은 서버·Rules를 수정하지 않았다.

localhost5000은 현재 실행 중이다. `http://localhost:5000`을 강력 새로고침하고 맵→신규 도로만을 선택한다. 최근 신규 취득일의 도로로 이동하고 기존 보라색 도로망 위에 마젠타 강조가 남는지 확인한다. 새 길 주행→종료→결과 닫기→같은 버튼, 같은 날 두 번째 주행 후 두 구간, 새로고침 후 복원을 확인한다.

서버가 꺼져 있을 때만 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev -- --port 5000 --strictPort
```
