# HANDOFF — 지금 상태 한 장

| 항목 | 값 |
|---|---|
| 담당 | **Codex** |
| 갱신 | 11-22 Chief 비교 후 지형 기본1배 채택·커밋 완료. |
| 브랜치 | `main2` · 지형 기본1배 |
| 마지막 배포 | 11-20 Hosting `66a0fac8`. |

## 진행 중

**11-22 지형1배 채택(Codex)**: Chief 「차이 체감 없음·1배 변경 후 커밋」. [결정·검증](20261119-camera-terrain-follow/20261122-terrain-scale-preview.md).
제품/프리뷰기본1배·지도/카메라/guard/복귀 일치. 회귀75·전환판2·map183/0·tsc·제품/격리빌드·HTTP·등록/방향PASS. 관련17파일 본 커밋·원본lint훅PASS; 표고/코칭·추적 유지, 미배포.

**11-22 중복호출 정리**: FPS효과와 분리해5파일 커밋. 계약28·활동갱신/동기실패재시도·tsc/lint 통과.
Chief 검수는 FPS차이없음. 5214 현재앱·5212 실험서버 유지. GPU효과 미주장. 정련은 기존App3830>3807로 실패·HEAD동일. 푸시/배포 없음.

**3D 후보**: [Chief 검수](20261119-camera-terrain-follow/20261122-reuse-approach.md#v2-직접-주행-검수) 29.6FPS·지형 정지 UX불합격 유지. 배율은5216에서 시험.

지도3모드 `66a0fac8` 배포.
비용: Mapbox 0회↑·GTX 비교. Standard 도로명 지원.

센서창 a29728e1·280×108。
lint PASS·Hosting 배포。

이정표542d04cb 배포·FINISH PASS·반복렌더 미확정(간편03).

**11-20 인터벌(Codex)**: `9ff9b78f` 배포. [계정 인계](20261029-quick-interval-ride/README.md).
다음: 실폰·센서 확인.

**11-19 시작3D ON(Codex)**: App.tsx false→true·고정87·b70c824c 배포。
셀렉터·회귀115·tsc/lint 통과. e2e 미실행(에뮬레이터 없음); 로컬 3D 시작 확인 대기.

**11-19 중계기(릴레이) 설계 검토(Codex)**: 코드 미작성. [설계·정량](20261119-firestore-read-audit/10-multi-rider-relay-design.md).
RTDB motion 은 이미 스타(중계) 구조. 남은 n:n 은 Firestore 백업 컬렉션 구독. 읽기 300·N·(N−1)/시간 → 후보B(라이더 RTDB만·관전자 보드1개)는 선형.
RTDB 대역·복구 품질을 포함한 큰 구조 변경은 후속. 후보B 미채택·상시 백업 유지.

**11-20 read 후속(Codex)**: Guest 제외계정 읽기 절감5a5b3170 배포·web1584/0·서버307/0。
11-22 Chief: 매일 전수감사 유지 확정. 주기 결정 대기 종료. [기록](20261119-firestore-read-audit/05-guest-and-measurement.md).

**11-19 배포**: 결과·RPM·카메라·DPR·계측 [4c1f2ef0](20261119-mobile-3d-investigation/release.md).

**11-19 퍼블릭(Codex)**: 4개 등록·공개43/9국·기존44 보존·공개read8OK.
[릴리스](20261119-public-route-candidates/release.md). ecf600c7 푸시·Hosting 완료. 아라/암스텔 보류.

**표고 조회**: 11-22 Chief 반려로60초 연장안 철회. 기존15초 유지·지연 원인 미해결. [과거 분석](20261102-ride-screen-layout/20261118-elevation-timeout-analysis.md).

**11-18 RPM 왼쪽 완료(Codex)**: `f3efe8ce`(10파일). 메뉴→RPM·센서→나머지 계기. 가로4크기16/16·tsc/lint 통과. 고정81·[기록](20261102-ride-screen-layout/README.md)·증거 `tmp/sensor-menu-20261118/left-implemented/`. 표고와 함께Hosting 반영.
**푸시**: f3efe8ce·원본 pre-push·quick1558/0. npm PATH는 실행용만 우회.

**거리 안내**: 11-22 Chief 현행 구현 승인·`baf65e9f` 커밋. 25km/h·0.1km 올림·고정48.
[결과·검증 한계](20261029-interval-route-hint/02-result-claude-code.md). App 실제흐름·실폰 미검증.

**11-16 Chief 결정**: ① MiniMax는11-22 개발도구에서 제외(이전 보류 결정 대체) ② Obsidian 볼트는 `C:\20.HDev\spinatlas-vault`(경로만 수정·스크립트 실행 안 함) ③ rider15 는 모델 수정 후 교체 ④ 전체 진단(11-10)은 보류 ⑤ 루트 `.out\` 정리 완료(약 3.0GB → 70MB, 링크 먼저 끊음). `.env` 4종은 `.out\env-backup-20261116\` 에 보관.

**11-16 점검**: 지역 필터 Hosting f0068146 확인. 함수·Rules는 [묶음](20261106-region-ride-stats/README.md) 확인.

**11-14~15 도구**: PROGRESS 참조. 키 없음·직접 구현.

**11-06 G5**: 배포 완료 428ae1b4·고정80. Chief 폰 확인·셀 연속성 제안 남음.

**11-06 지역 필터**: 고정79·폰 확인 대기. geo 없는 Trail 제외.

**11-06 PR #22**: 푸시 완료 0276202f. 위치 쓰기 임계값 조정, 효과는 측정5(분당5.0·6.4). 당시 Hosting 자동 승인 거부, 운영 반영은 관련 묶음 확인.

**11-11 rider15**: DEV 전용·활성 rider14·리그8·색상4 통과. [README](20261111-rider15-app-integration/README.md)·보존 기록에 원본 경로·진단.

**11-04 PR #21**: 배포004e4261·국가별 점수·폰 확인 대기.

**11-03~04 비용**: 54bd409d·6f125e1c 배포. 후속 read 조사 진행.

**11-02 주행 화면**: 배포. App 래칫3807. 기존 하네스14실패·5초 숨김 유의.

10-30~11-01 배포는 묶음 README·git log. 주행 중 인터벌: 일시정지→INT.

간편 인터벌01·01-B는 배포됨. 이정표/FINISH도542d04cb 배포. 반복 렌더링 제보의 원인·실폰/실센서 확인은 남음.
과거 진입시험 결함 후보(현재 미재검): 결과창 닫기/지도에 가린 메뉴 클릭. 재개 시 실제 App 진입 시험과 구분한다.

배포 상세: [보존 기록](20261102-ride-screen-layout/20261118-handoff-background.md).

## 다음 한 걸음

1. 중복호출 정리는 커밋 완료. FPS차이없음과 내부 `_order` 의존성을 [측정·한계](20261119-camera-terrain-follow/README.md)에 기록했다. 큰 FPS 개선은 별도 후속이며 실패 후보를 재채택하지 않는다.
2. 중계 보드/장애 복구와 반응형·적응형 정책은 후속. Guest 감사는 매일 유지로 확정, 상시 Firestore 백업 유지.
3. 인터벌·이정표 실폰/실센서 확인, 반복 렌더링 스택 확보. 거리 안내·센서/RPM·관전 UID 수정은 로컬 커밋·미배포.

## Chief 결정 대기

- PR #22·지역 칩·Trail 탭 반짝임 Chief 폰 확인(11-06 일부 확인). 위치 저장 임계값 효과는 측정 5로 확인됨(분당 5.0·6.4).
- 그 밖: 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

## 잊지 말 것

- **유럽 RTDB Rules는 별도 배포**: `firebase.json`이 아직 기본 인스턴스만 안다. `database.rules.json`을 바꾸면 유럽에도 임시 설정(`{"database":[{"instance":"boxcycle-dc2df-eu-rtdb","rules":"database.rules.json"}]}`)으로 배포한다 — 2차에서 firebase.json 다중 인스턴스로 바꿀 때까지.
- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다(`.out/` 안 폴더를 지울 땐 링크부터 끊는다 — 실제 node_modules 로 이어져 있다).
- imgman 서버(3000·3001) 종료 금지.
- 파일은 링크 대신 `Start-Process "<절대경로>"`. 사용자 명령: 모든 경로 절대경로·한 줄 독립 실행(11-22).
- 보고에 수행 agent 명시.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.
