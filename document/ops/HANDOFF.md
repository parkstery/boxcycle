# HANDOFF — 지금 상태 한 장


| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** — 2026-10-30 구름·톱니·접기 캐럿 배포 완료, 대기 |
| 갱신 | 2026-10-30 19시 — 11eb53aa 배포, 시안 20261030-gear-cloud-mockup |
| 브랜치 | `main2` |
| 마지막 배포 | 2026-10-30 19시대 Hosting(Claude Code): 68b88851(origin/main2 와 같음) — 작은 구름·균등 톱니·RouteDock 접기 캐럿만. 그 전 11eb53aa 도구A·구름·Trail·순위 줄배경·인터벌 도넛. 번들 SHA256 일치 |

## 진행 중

**진행 중 — 오른쪽 2열 4줄 묶음 개편(11-02 Chief 「구현 진행해」, Claude Code)**: 시안 [right-group.html](20261102-ride-screen-layout/right-group.html) v4+Chief 답(나중 쪽 펼치면 먼저 쪽 접기·계정 주행 중에도 보임(순위 목록 아래 z)·경로 목록도 메뉴로·미니맵 버튼=RouteDock 손잡이 크기). 단계: A 오른쪽 묶음(MapHud 레일→2×4 원형, ⏸⏹▶·INT·순위 이동, 오른쪽 반달 제거, 목록 가장자리·2초 숨김, ⚙·경로 목록 메뉴 머리줄) → B 센서 LED·RPM 계기판 칸 → C 미니맵 토글 복귀·인터벌 접기·하나만 펼치기. 각 단계 캡처 보고·승인. **A 배포됨(93924456·a2e063bf, pre-push 10종·test:quick 1470/0, 운영 js·css SHA256=로컬)** — [README](20261102-ride-screen-layout/README.md) 「개편 A」·고정67. live 스펙 미실행.
**B 배포됨(9e5bde96·996e66cf, pre-push 10종·test:quick 1470/0, 운영 js·css SHA256=로컬)** — README 「개편 B」·고정68.
**C 배포됨(2014f82e·0580346f, pre-push 10종·test:quick 1470/0, 운영 js·css SHA256=로컬)** — README 「개편 C」·고정69.
**5단계 끝·배포됨(1c507fb2·8504fa18)**: README 「5단계」·`evidence/s5-sheet.png`. 하네스 e2e 25종 재실행, 남은 실패 14건 = 개편 이전부터(9e27638b 로 확인). 겹침 0(4크기×9상태). Chief 확인 뒤 커밋·푸시(배포 불필요). 배치 개편 묶음 마무리 대기.
**인터벌 「설정 적용」=켜기 배포됨(62dfd32e, pre-push 10종·test:quick 1470/0, 운영 js·css SHA256=로컬)**: RideIntervalSettingsSheet·useRideInterval(이전 상태 기준 갱신)·e2e 1·고정70, README 「후속」. 주행 화면 배치 개편 묶음 끝. 다음 지시 대기.
**배포 11-02(Claude Code)**: c6297926 카메라 제안A·85d714cc 인터벌 중 미니맵 숨김+배치 계획, origin/main2 d6aa0dc2..85d714cc(pre-push 10종·test:quick 1467/0), Hosting 배포·운영 js/css SHA256=로컬.
**주행 화면 배치 1단계 배포됨(11-02, Claude Code, 9ea27a96·4237de18·c8e4da8a)**: 순위|Trail 탭 공유·10줄(주행 전·중 모두), 주행 전 5줄 원인=없어진 시계+56px 예약(정정 기록), 오른쪽 반달 탭 z 조정. Trail 탭 배선은 `hooks/useTrailGlanceTab.tsx`(App.tsx 래칫 한도 3807, 현재 3793 — 여유 14줄). [README](20261102-ride-screen-layout/README.md)·고정63. 다음=2단계(오른쪽 조작 레일) — App.tsx 에 더하지 말고 훅·컴포넌트로.
**2단계 오른쪽 조작 레일 배포됨(11-02, Claude Code, d331d2d8)**: [README](20261102-ride-screen-layout/README.md) 2단계·고정64. 다음=3단계(왼쪽 아래 주행 버튼 줄 64px, ⚙ 일시정지에도 → 일시정지 옵션의 지도 스타일 정리, 왼쪽 반달 vs RouteDock 겹침).
**3단계 배포됨(11-02, ae1c0198)**. **4단계 자동 숨김 배포됨(11-02, f511feed, Claude Code)**: [README](20261102-ride-screen-layout/README.md) 4단계·고정66. 다음=5단계(전체 회귀·낮은 폰 4크기 점검, 펼친 카드 ▶/⏸ 같은 칸 어긋남 판단 자료). 위험: 실앱 측정 시험은 5초 뒤 화면 누름 필요.

10-30~11-01 배포분(D안 인터벌·톱니·구름·RouteDock 도구줄·인터벌 진입·주행 설정·경로 창) 기록은 각 묶음 README·git log. 주행 중 인터벌 진입: 10-30 Chief 결정 — 주행 중 불가, 일시정지에서 INT.

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
