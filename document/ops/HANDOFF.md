# HANDOFF — 지금 상태 한 장


| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** — 2026-10-30 구름·톱니·접기 캐럿 배포 완료, 대기 |
| 갱신 | 2026-10-30 19시 — 11eb53aa 배포, 시안 20261030-gear-cloud-mockup |
| 브랜치 | `main2` |
| 마지막 배포 | 2026-11-04 (Claude Code) 6f125e1c — Hosting 격리 빌드 index-BMWtG01o.js SHA256=로컬: L4b 가속 중 연속 쓰기 제한·`rides.netStats`. 이전 54bd409d G3-1 순위 누적 점수·L4, c97eac84 비용 L1·L2·L3·L6·유럽 RTDB 생성 |

## 진행 중

**11-04 국가 입력 구현(Claude Code, 클라우드) — 진행 중**: Chief 「A안(닉네임·국가 한 줄)」+ 원칙 「지도 가림 최소·짧은 문구」. 파일: `SignUpNicknameCard`·`ProfileEditSheet`·새 확인 카드·`lib/identity` 국가 모듈·`firestore.rules` users. 다음 명령: web `npm run test:quick`, Rules 에뮬레이터 시험. 시안 [README](20261104-country-input-mockup/README.md).

**11-04 G2 공개 경로 요약 목록(Claude Code, 클라우드) — 구현·커밋, 미배포**: 트리거·채우기 CLI·Rules·색인·웹 카탈로그 전환(빈 목록·실패 시 옛 쿼리로 물러남). functions 247/0, 에뮬레이터 5/5, 채우기 dry-run=apply. 배포 순서·결과 [00-plan §4.1.1](20261103-global-geo-data/00-plan.md). 배포는 Chief 승인·PC 세션. **G4 서버**(Trail 목록에 지역 복사, §4.5.1)도 커밋 — 배포 시 openTrailListing 함수 5개 함께. 클라우드 test:quick 실패 9건은 환경 전용(Edge 고정 5·`.env` 없음 Mapbox 2·Windows 검증 종료 시험 2).

**11-04 재개 지점 — 클라우드 전환(Claude Code)**: [클라우드 재개 안내](20261103-cost-squeeze/04-cloud-resume.md)부터. L9 A·B·로컬 기록 주인·시계 복구(고정74)는 커밋·푸시됐고 **배포·`aPbTo3` 50건 삭제는 미실행**(Chief 승인 완료). 순서: Functions 2개 → 격리 Hosting → 삭제. 클라우드에는 Firebase 인증·.env·.out이 없어 이 단계는 Chief PC 세션 또는 인증 설정 뒤. L4b 재주행 PASS, 4초 줄기 재현 안 됨. 클라우드(11-04): 인증 없음 확인·배포 미실행, 「모드배타」 5건 시험을 현재 배치로 고침(재개 안내 「클라우드 진행 기록」). [쓰기 장부](20261103-cost-squeeze/03-write-ledger.md).

**11-03~04 비용 절감·지역 데이터(Claude Code) — 배포됨 54bd409d**: L1·L2·L3·L4·L6(G3-1 누적 점수로 근본 해결)·P1·P2·G1. Chief 실주행 3회+관전 PASS(11-04). **L4b 배포됨(6f125e1c)**: 가속 중 연속 쓰기 제한+`rides.netStats`([기록](20261103-cost-squeeze/02-design-l4.md)). 다음: Chief 2인 재주행 → 분당 쓰기(Cloud Monitoring)·`rides.netStats`로 4초 구간 원인 확정. 남은 것: 유럽 RTDB 2차, G2 요약 목록, G3-2 국가 범위. [cost-squeeze](20261103-cost-squeeze/README.md)·[00-plan](20261103-global-geo-data/00-plan.md).

**11-03 전세계 지역 데이터·비용(Claude Code)** — G1(2559dd7c)·G0.5 P5·P2(de076cfa)·P1 이름표+Rules(8eb69595) 커밋, 미푸시·미배포. Chief 11-03: **비용 짜내기 1순위**, 유럽 RTDB는 미루지 말고 설정. 비용 점검 [01-audit](20261103-cost-squeeze/01-audit.md): 제곱형 L6 순위 훑기·L1 livePresence 전체 구독·L2 CG 구독. 계획 [00-plan](20261103-global-geo-data/00-plan.md). `ride-moments-dom`은 test:quick 병렬 시 vite 캐시 경합으로 간헐 FAIL(단독 PASS).

**11-03 버튼 숨김 멈춤 수정+ⓖ 빈칸(Claude Code) — 배포됨(f8d19c69, 운영 js SHA256=로컬)**: 원인 = 펼친 경로 카드(줄 띠)가 RideControlsAutoHide BUSY 에 있어 5초 숨김·탭 토글 둘 다 멈춤(폰 699×273 터치 실앱 실측). BUSY 에서 제외, 고정66 보완. 게스트 이름 `ⓖ tHQb`(고정73). 실앱 시험 `ride-entry.spec.ts` 「실앱 버튼 숨김」(사보타주 확인), ride-entry 8/8, 하네스 autohide 7/7, test:quick 1475/0. 남은 것: Chief 폰 확인.

**11-03 닉네임·게스트 ⓖ·센서 메뉴·인터벌 영어 음성 + 게스트 전부 삭제(Claude Code) — 배포·완료**: 499c0bf2·fd0ef880 푸시(pre-push 10종·1475/0), firestore:rules·Hosting 배포(운영 js SHA256=로컬, 번들에 새 문구 확인). 고정73. 게스트 62명 삭제·검증(Google 5 보호, 남은 것 0) — [README](20261103-guest-reset/README.md). 리셋 도구에 `--baseline`·`--google` 인자 추가. 남은 것: Chief 사이트 확인(새로고침).

**11-03 인터벌 창·RouteDock 줄 띠·Chief 5건+탭 토글** — 배포됨(939f0ca3·f45d6193), 기록은 [README](20261103-interval-sensor-look/README.md)·고정72.

**11-03 Chief 폰 캡처 6장 후속 배포됨(f32dc99d, Claude Code)**: 글자 선택 막기·순위 목록 계정 아래(묶음 겹침 허용)·왼쪽 원형 메뉴 버튼·왼쪽 끝 20px·접힌 인터벌 알약 버튼 오른쪽·경로 손잡이/미니맵 둘 다 접힘=세로·manifest fullscreen+viewport-fit=cover. pre-push 10종·test:quick 1470/0, 화면 e2e 16종 137/3(배치1 기존), 운영 js·css SHA256=로컬·manifest 200. 고정71·README 「후속 2」. 남은 것: Chief 폰 「홈 화면에 추가」 실기 확인. Chief 6장 중 3~6(고도 숫자·이름표 겹침·빈 핀)은 별도·보류.

**11-02 주행 화면 배치 개편 1~5단계·A~C·인터벌 「설정 적용」 전부 배포됨(Claude Code)** — 기록은 [README](20261102-ride-screen-layout/README.md)·고정63~70·git log. App.tsx 래칫 한도 3807 — 더하지 말고 훅·컴포넌트로. 하네스 e2e 남은 실패 14건은 개편 이전부터(9e27638b). 실앱 측정 시험은 5초 숨김 때문에 화면 누름 필요.

10-30~11-01 배포분(D안 인터벌·톱니·구름·RouteDock 도구줄·인터벌 진입·주행 설정·경로 창) 기록은 각 묶음 README·git log. 주행 중 인터벌 진입: 10-30 Chief 결정 — 주행 중 불가, 일시정지에서 INT.

간편 인터벌 01: 실앱 live FAIL 원인 = 시험 결함(adhoc 결과시트엔 .ride-summary__close 없음 → 닫힌 줄 오인, 시트 열린 채 반달 숨김). 제품 루프 없음·HEAD 동일 확인(임시 계측, 파일 삭제됨). impl-standard 재작업 2 진행: 「저장 안 함」으로 정식 닫기, live 2회 연속 PASS.
별도 기존 결함 후보: 일반 주행 결과시트 「닫기」가 10초 내 클릭 안 됨(HEAD 동일), rideEntryHelpers.loadIntroCourse 의 Trail 메뉴 클릭이 지도에 가려짐 → test:e2e:ride 확인 필요. 다음: 재작업 2 재감리 → Chief 보고 → 커밋·푸시·배포.

## 다음 한 걸음

1. Firestore 타인 위치fanout 구조 저감과 운영원가귀속. 자기 문서 제외는 배포됨. 상시 백업을 끊는 안은 복구 지연 때문에 채택 안 함. ([09](20261029-peer-cost-quality/09-firestore-read-reduction.md))
2. [인터벌 경로 계획](20261029-quick-interval-ride/00-plan.md)(Chief 순서 변경): 간편 01(진행 중) → [거리 부족 안내](20261029-interval-route-hint/01-task.md) → [01-B](20261029-quick-interval-ride/01b-task-end-and-cut.md). 인터벌 기준 모두 25km/h(`resolveIntervalBasisKmh` 한 곳), 간편=25×1.3.
3. 커밋 제외: compact-controls evidence zip 2개(각 182MB), `.out/`(배포 빌드 복사본), 빈 `claude-headless.err`.

## Chief 결정 대기

그 밖에 없음 — 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

## 잊지 말 것

- **유럽 RTDB Rules는 별도 배포**: `firebase.json`이 아직 기본 인스턴스만 안다. `database.rules.json`을 바꾸면 유럽에도 임시 설정(`{"database":[{"instance":"boxcycle-dc2df-eu-rtdb","rules":"database.rules.json"}]}`)으로 배포한다 — 2차에서 firebase.json 다중 인스턴스로 바꿀 때까지.
- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다.
- 다른 프로젝트(imgman) 개발 서버(포트 3000·3001)는 종료하지 않는다.
- Chief에게 링크를 주지 않는다(터미널에서 안 열림). 보여줄 파일은 `Start-Process "<전체 경로>"`로 직접 연다.
- 보고에 수행 agent 명시.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.
