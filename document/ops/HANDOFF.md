# HANDOFF — 지금 상태 한 장


| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** — 2026-11-12 미커밋 정리(rider15 앱 통합은 모델 수정 대기) |
| 갱신 | 2026-11-12 — 작업 트리 정리·커밋 |
| 브랜치 | `main2` (= `origin/main2`, 11-12 정리 커밋 3개 포함) |
| 마지막 배포 | 2026-11-06 (Chief 실행·Claude Code 검증) 428ae1b4 — Rules·함수·regions 채우기·Hosting(G5). 이전 8be180ff |

## 진행 중

**11-06 G5 Conquest 지역 통계(수퍼바이저 Claude Code·구현 impl-standard, 배포 완료 428ae1b4)**: S1~S6 구현 끝. functions 282/0·test:quick 1522/0 · 안전장치 A·B 구현(상한·판정 실패 격리)·Rules 6/6·e2e 3/3. 결과 [00-plan §4.4.1](20261103-global-geo-data/00-plan.md)·고정80. 배포(Rules·함수·채우기 92건·Hosting) 2026-11-06 Chief 실행, 검증 완료. 행정구역 칩(A안, c5a6b3b0)도 Hosting 배포·라이브 확인. 남은 것: Chief 폰 확인(계정 창 국가·행정구역 칩·개척 순위 범위 버튼). 셀 연속성 검증은 별도 제안. 이름 표 생성 완료(`apps/web/public/geo-names/v1`, 3813코드 ko·en, 화면 미연결 — 행정구역 선택은 시안 후).

**11-06 목록 지역 필터(구현 impl-standard·감리 Claude Code)**: 퍼블릭 목록·Trail 탭 머리줄에 「세계 ▾」 칩(Chief A안·고정79), 받아 둔 행을 화면에서 거름(읽기 추가 0), 마지막 범위 기기 저장. test:quick 1513/0. 남은 것: chief 폰 가로 확인 — 699×273 퍼블릭 머리줄 폭, Trail 탭 줄 16px 칩. 서버 geo 미채움 Trail은 지역 선택 시 빠짐.

**11-06 PR #22 푸시·시간 초과 수정·임계값(Claude Code)**: `main2`에 PR #22(메뉴 출처 3버튼·센서 단추·Trail 합류/나가기)를 포함해 푸시함(0276202f, pre-push 게이트 통과). test:quick 시간 초과는 Vite DOM 시험 5개가 `node_modules/.vite` 캐시를 공유한 탓이라 시험별 `cacheDir`로 분리, 2회 연속 1506/0. 위치 저장 임계값: RTDB 정상 시 속도 쓰기 간격 3→6초·변화량 0.83→1.67 m/s(분당 상한 약 10건), 다음 공개 주행에서 사람당 분당 쓰기 재측정 필요. **Hosting 배포는 자동 승인 분류기가 거부해 미실행** → chief가 루트에서 `npm run deploy:hosting` 실행 후 번들에서 `menu-panel__sources` 확인. 지역 다음 일: [README](20261103-global-geo-data/README.md).


**11-11 rider15 앱 통합(수퍼바이저 Claude Code·구현 DeepSeek `dsh`)**: 모델 V3.0 승인본을 후보 `20261111-025600-ad1d669d`로 복사(S1 완료, 해시 일치). S2 완료 = 등록+전용 리그(`rider15Rig.ts`)+레이어 분기, DEV `?riderModel=rider15` 전용, 활성 모델은 rider14 유지. S4(색상 구분 근·원거리, 슬롯 표는 앱 코드 — Chief 결정) 완료. S2·S4·후보 폴더 **11-12 커밋됨**(Chief 승인, 운영 화면 영향 없음). 리그 8/8·색상 4/4·test:quick 1545/0·tsc 0·check:dep 통과. **Chief 화면 확인에서 모델 결함 3건 발견(발목 가늘어짐=굽힘 고리 1줄·엉덩이 뒤 수직선=골반 메시 형상·체인링 72구간 중 17구간 면 없음=P77 원본부터, README 진단)** → S5 보류, 모델 원본(P77 blend) 수정·재빌드가 먼저. 수정은 **Claude 앱이 진행(Chief 결정 11-11)**, 지시·진단서 = `OneDrive\Documents\img\rider15_model_work\docs\rider15_V3.0_결함3건_수정_지시.md`(미커밋). 새 release가 오면 후보 폴더 복사 → 리그 8·색상 4 시험 재실행. 계획·기록·결정 대기: [README](20261111-rider15-app-integration/README.md). dsh는 `apps/web`에서 자체 셸이 권한 오류라 검증은 수퍼바이저가 돌린다. 모델 archive는 `C:\20.HDev\rider_model_archive`.

**11-04 PR #21 배포 완료(004e4261, Claude Code) — Chief 폰 시험 대기**: 국가 입력(고정75)·G2 요약 목록·G4 Trail 지역·G3-2 국가 순위(고정76)·L9. `publicationListings` 39건 채움(재실행 변경 0, 보관 5건 제외), `aPbTo3` 50건 삭제(주행 0·마일리지 0, 스냅샷 `.out/private-guest-lifecycle/rides-aPbTo3-20261104`). 게이트: test:quick 1506/0, functions 259/0, Rules 11/11. 지역 순위는 국가를 정한 뒤 달린 주행부터 쌓인다. 19:25 센서 2인 주행: 지역 점수 적립·오류 0·`aPbTo3` 재등장 없음 확인, 위치 외 쓰기 분당 11건. 위치 저장은 사람당 분당 16건으로 설계 5건의 3배, 속도 변화 쓰기가 원인으로 추론([측정 4](20261103-cost-squeeze/03-write-ledger.md)) — 임계값 조정 Chief 결정 대기. 범위 버튼 실제 요청은 아직 0건. Codex rider15 작업이 같은 폴더에서 동시 진행 중이다.

**11-03~04 비용 절감·지역 데이터(Claude Code) — 배포됨 54bd409d**: L1·L2·L3·L4·L6(G3-1 누적 점수로 근본 해결)·P1·P2·G1. Chief 실주행 3회+관전 PASS(11-04). **L4b 배포됨(6f125e1c)**: 가속 중 연속 쓰기 제한+`rides.netStats`([기록](20261103-cost-squeeze/02-design-l4.md)). 다음: Chief 2인 재주행 → 분당 쓰기(Cloud Monitoring)·`rides.netStats`로 4초 구간 원인 확정. 남은 것: 유럽 RTDB 2차. [cost-squeeze](20261103-cost-squeeze/README.md)·[00-plan](20261103-global-geo-data/00-plan.md).





**11-02 주행 화면 배치 개편 1~5단계·A~C·인터벌 「설정 적용」 전부 배포됨(Claude Code)** — 기록은 [README](20261102-ride-screen-layout/README.md)·고정63~70·git log. App.tsx 래칫 한도 3807 — 더하지 말고 훅·컴포넌트로. 하네스 e2e 남은 실패 14건은 개편 이전부터(9e27638b). 실앱 측정 시험은 5초 숨김 때문에 화면 누름 필요.

10-30~11-01 배포분 기록은 각 묶음 README·git log. 주행 중 인터벌 진입: 일시정지에서 INT(Chief 결정).

간편 인터벌 01: 실앱 live FAIL 원인 = 시험 결함(결과시트 닫기 오인), 제품 루프 없음. 재작업 2 재감리 대기.
별도 기존 결함 후보: 일반 주행 결과시트 「닫기」가 10초 내 클릭 안 됨(HEAD 동일), rideEntryHelpers.loadIntroCourse 의 Trail 메뉴 클릭이 지도에 가려짐 → test:e2e:ride 확인 필요.

## 다음 한 걸음

1. Firestore 타인 위치fanout 구조 저감과 운영원가귀속. 자기 문서 제외는 배포됨. 상시 백업을 끊는 안은 복구 지연 때문에 채택 안 함. ([09](20261029-peer-cost-quality/09-firestore-read-reduction.md))
2. [인터벌 경로 계획](20261029-quick-interval-ride/00-plan.md)(Chief 순서 변경): 간편 01(진행 중) → [거리 부족 안내](20261029-interval-route-hint/01-task.md) → [01-B](20261029-quick-interval-ride/01b-task-end-and-cut.md). 인터벌 기준 모두 25km/h(`resolveIntervalBasisKmh` 한 곳), 간편=25×1.3.
3. 11-12 정리: 루트 `.out/`·`claude-headless.err`·`document/ops/**/evidence/*.zip`은 `.gitignore`로 제외(파일은 그대로). 시험이 덮어쓴 증거 PNG 30개는 Chief 승인으로 커밋본으로 되돌림. 루트 `.out/` 3.1GB 옛 복사본 삭제 여부는 Chief 결정 대기.

## Chief 결정 대기

- PR #22·지역 칩·Trail 탭 반짝임 Chief 폰 확인(11-06 일부 확인). 위치 저장 임계값 효과는 측정 5로 확인됨(분당 5.0·6.4).
- 그 밖: 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

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
