# HANDOFF — 지금 상태 한 장


| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** — 2026-10-30 구름·톱니·접기 캐럿 배포 완료, 대기 |
| 갱신 | 2026-10-30 19시 — 11eb53aa 배포, 시안 20261030-gear-cloud-mockup |
| 브랜치 | `main2` |
| 마지막 배포 | 2026-10-30 19시대 Hosting(Claude Code): 68b88851(origin/main2 와 같음) — 작은 구름·균등 톱니·RouteDock 접기 캐럿만. 그 전 11eb53aa 도구A·구름·Trail·순위 줄배경·인터벌 도넛. 번들 SHA256 일치 |

## 진행 중

**배포 11-02(Claude Code)**: c6297926 카메라 제안A·85d714cc 인터벌 중 미니맵 숨김+배치 계획, origin/main2 d6aa0dc2..85d714cc(pre-push 10종·test:quick 1467/0), Hosting 배포·운영 js/css SHA256=로컬.
**주행 화면 배치 1단계 배포됨(11-02, Claude Code, 9ea27a96·4237de18·c8e4da8a)**: 순위|Trail 탭 공유·10줄(주행 전·중 모두), 주행 전 5줄 원인=없어진 시계+56px 예약(정정 기록), 오른쪽 반달 탭 z 조정. Trail 탭 배선은 `hooks/useTrailGlanceTab.tsx`(App.tsx 래칫 한도 3807, 현재 3793 — 여유 14줄). [README](20261102-ride-screen-layout/README.md)·고정63. 다음=2단계(오른쪽 조작 레일) — App.tsx 에 더하지 말고 훅·컴포넌트로.
**2단계 오른쪽 조작 레일 구현·검증 끝·미커밋(11-02, Claude Code)**: [README](20261102-ride-screen-layout/README.md) 2단계·고정64. 다음=Chief 캡처 확인·커밋 승인 → 3단계(왼쪽 아래 주행 버튼 줄 64px, ⚙ 일시정지에도 → 일시정지 옵션의 지도 스타일 정리).

**D안 배포 완료(11-01 Chief, Claude Code)**: d6aa0dc2 푸시(origin/main2 68b88851..d6aa0dc2, pre-push 10종·test:quick 1467/0)·Hosting 배포, 운영 index js·css SHA256=로컬. 이전 기록 —: 인터벌 패널 D안, [결과](20261101-interval-cycle-donut/README.md). tsc 0·eslint 0·e2e 인터벌 29/29(반복 58/58)·test:quick 1466+고친 1. ride-ui-moments 3실패는 HEAD 동일(기존). 

인터벌 사이클 도넛 시안 v2(11-01 Chief, Claude Code, A·B안 mockup.png + C안 mockup-c.png + D안 아티팩트 d-plan.html): [README](20261101-interval-cycle-donut/README.md), Chief 승인 대기. 승인 시 RideIntervalHud.tsx/.css·ride-interval.spec·고정58 대체.

톱니·작은 구름·접기 캐럿(10-30 Chief, Claude Code, 배포됨): 68b88851, [README](20261030-gear-cloud-mockup/README.md). pre-push 10종·test:quick 1467/0, 운영 번들 SHA256 = 로컬.

**푸시·배포 완료(10-30 19:2x, Claude Code)**: af850396 도구A·구름·Trail / 705876e8 순위 줄배경·인터벌 도넛 / 50bc2a9d 거리 원 계약 시험(f498fcee 색 변경 후 깨져 있던 것) / e8ac1c93 고정55~58 / 11eb53aa 래칫(MapHud.css 1612줄·반복 28) 대응 — A안 도구 CSS를 MapToolbar.css 로 분리(순서 동일), Trail 행 중복 합침. origin/main2 `98646bbe..11eb53aa`, pre-push 10종 통과, test:quick 1467/0, toolbar-trail-style 20/20. Hosting 배포, 운영 index js·css SHA256 = 로컬 dist. 커밋 안 함: e2e 가 덮어쓴 증거 PNG 19장·a-interval-sheet PNG·zip 2개·`.out/`·`claude-headless.err`.




RouteDock 도구줄·메뉴 Trail 전용(10-30 Chief, 배포됨): 센서 칩 글자·테두리 제거·LED 21px / 주행 전 INT·지도핀(내 경로 창)·⚙(주행 설정)·▶, 주행 중 ⚙가 INT 자리(INT·핀 숨김) / 왼쪽 메뉴에서 경로 선택·주행 설정 제거. 파일: RouteDock.tsx/.css·CadenceHudChip.tsx·RideRoutePanel.tsx·App.tsx·preview 2종·entry-contract·rideEntryHelpers·e2e 약 40종(입문 진입 경로 일괄 교체)·고정12/42/48. tsc 0·eslint 0·셀렉터 21/21·test:e2e:ride 7/7·menu-a 1/1·route-dock-tools 3/3(사보타주 확인). 남은 실패: 기존(반달4·탭핸들3·좌우탭1·route-ride-controls5·ui-800x360 고정14/30/목록11/44px 4·sensor-dock 종료 후 펼침 1) + **주행 중 인터벌 창 진입로 없음**(ride-interval 1·ride-interval-settings 1 — Chief 결정 대기). 실앱 카메라·촬영 live 스펙 미실행.
주행 중 인터벌 진입: 10-30 Chief 결정 — 주행 중 불가(의도), 일시정지에서 INT.

인터벌 진입 정리(10-30 Chief, 배포됨): ①메뉴 「인터벌」·「간편 인터벌 주행」 행 제거 ②「간편 인터벌」→인터벌 운동 창 하단 「설정 적용」 왼쪽(고른 값 적용 후 시작, 직접 조절 화면엔 숨김) ③RouteDock INT 접힘·펼침·주행 중 항상 표시 ④프리셋 드롭다운 글자 16px=목록. 파일: RouteDock.tsx/.css·RideIntervalSettingsSheet.tsx/.css·RideRoutePanel.tsx/.css·App.tsx·useQuickIntervalRide.ts·preview·quick-interval 하네스·entry-contract·e2e 9종·고정32/42. tsc 0·eslint 0·셀렉터 계약 21/21, e2e 9종 90통과/13실패(전부 기존: route-ride-controls 5·반달4·탭핸들3·좌우탭1 — INT 끄고도 동일 실패 확인). quick-interval-live(에뮬레이터) 미실행.

주행 설정 정리(10-30 Chief, 배포됨): 칼로리 계산·프로필 수정 줄 제거, 창 폭 460→276px. 파일: RideSettingsPanel/Sheet.tsx·RideSettingsSheet.css·App.tsx·ui-800x360/preview.tsx·e2e 4종·고정 목록 33/42(배포됨). tsc 0·eslint 0, e2e 3종 58통과/7실패(반달·탭 핸들, 주행 설정 미사용, 진행 중 RideRoutePanel 변경과 관련 의심). calorie-profile-sync(에뮬레이터) 2/2 통과.
경로 창(10-30 Chief A안 승인): 제목 「경로」→파란 지도 핀 아이콘(낭독 「경로」 유지), 모드 버튼 38→57px(창 228 유지, 왼쪽으로). 파일: mapPopupElements.ts·RoutePickPopup.css·e2e batch5·고정 49(미커밋). tsc 0·eslint 0, batch5 전부 통과, route-ride-controls 5실패(헤더 안 .map-view__pick-token 을 찾는 고정49 이전 계약 — 이번 변경 무관, 시험 갱신 필요).
경로 창 높이(10-30 Chief): 출발 없음 거리/방향 안내 줄 18→28px(Start 줄과 동일), 두 모드 175px 일치. RoutePickPopup.css·batch5 회귀 시험 1건·고정49(배포됨). batch5 37/37, 시험 사보타주 확인.

간편 인터벌 01: 실앱 live FAIL 원인 = 시험 결함(adhoc 결과시트엔 .ride-summary__close 없음 → 닫힌 줄 오인, 시트 열린 채 반달 숨김). 제품 루프 없음·HEAD 동일 확인(임시 계측, 파일 삭제됨). impl-standard 재작업 2 진행: 「저장 안 함」으로 정식 닫기, live 2회 연속 PASS.
별도 기존 결함 후보: 일반 주행 결과시트 「닫기」가 10초 내 클릭 안 됨(HEAD 동일), rideEntryHelpers.loadIntroCourse 의 Trail 메뉴 클릭이 지도에 가려짐 → test:e2e:ride 확인 필요. 다음: 재작업 2 재감리 → Chief 보고 → 커밋·푸시·배포.

## 다음 한 걸음

1. Firestore 타인 위치fanout 구조 저감과 운영원가귀속. 자기 문서 제외는 배포됨. 상시 백업을 끊는 안은 복구 지연 때문에 채택 안 함. ([09](20261029-peer-cost-quality/09-firestore-read-reduction.md))
2. [인터벌 경로 계획](20261029-quick-interval-ride/00-plan.md)(Chief 순서 변경): 간편 01(진행 중) → [거리 부족 안내](20261029-interval-route-hint/01-task.md) → [01-B](20261029-quick-interval-ride/01b-task-end-and-cut.md). 인터벌 기준 모두 25km/h(`resolveIntervalBasisKmh` 한 곳), 간편=25×1.3.
3. 커밋 제외: compact-controls evidence zip 2개(각 182MB), `.out/`(배포 빌드 복사본), 빈 `claude-headless.err`.

## Chief 결정 대기

없음 — 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

## 잊지 말 것

- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다.
- 다른 프로젝트(imgman) 개발 서버(포트 3000·3001)는 종료하지 않는다.
- Chief에게 링크를 주지 않는다(터미널에서 안 열림). 보여줄 파일은 `Start-Process "<전체 경로>"`로 직접 연다.
- 보고에 수행 agent 명시.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.
