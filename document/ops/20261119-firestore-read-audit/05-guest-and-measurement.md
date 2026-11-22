# Guest 정리·운영 절감 측정 후속

2026-11-20, 수행 agent: Codex 직접. Chief 「잔여 작업 계속해」. 완성분 커밋·푸시·배포 승인은 앞선 지시를 이어 적용한다.

## 2026-11-22 빠른 후속 처리 — Codex

Chief는 구현 비용이 작은 항목부터 처리·커밋하고 큰 구조 변경은 후속으로 미루도록 지시했다.

- **Guest 전수 감사: 매일 유지 확정.** 기존 KST 03:15(`15 3 * * *`, Asia/Seoul)를 변경하지 않는다. 주간 감사·순환 감사 전환의 결정 대기는 종료한다. Functions 코드·스케줄 변경이나 배포는 없다. Cloud Logging 읽기 전용 조회에서 11/21·11/22 KST 03:15의 완료 기록을 확인했다. 양일 모두 scanned=13, registered 제외6, fresh 제외7, deleted=0, failed=0, capped=false였다. scanned는 후보 UID 수이며 Firestore 읽기 문서 수가 아니다. 함수를 수동 실행하거나 데이터를 삭제하지 않았다.
- **다인 백업의 작은 개선:** `useTrailLivePublicationRideSpectatorOverlay`의 구독 의존성을 User 객체에서 UID로 바꿨다. 동일 UID의 새 객체가 들어올 때 불필요한 초기 재조회와 listener 해제/재연결을 막는다. 상시 Firestore 백업·RTDB 전송 주기·표시 알고리즘·Rules·데이터 모델은 유지한다. 계정/Trail 변경·비활성·로그아웃·unmount 해제와 오류 전달을 회귀시험으로 확인했다. 이 수정은 다인 fanout의 제곱 증가를 해결하지 않는다. 중계 보드/묶음 전달과 장애 복구 경로의 큰 개편은 후속이다.
- **배포 후 지표 수집 완료:** 11/18 KST 00:00부터 11/22 16:16까지 요청, 수집16:27. 최신 관측은11/22 09:09 KST다. `112131aa` Hosting 확인 시각(11/20 04:59:08.661 KST)을 기준으로 이전40,521·이후30,558건, 이후4,222포인트를 확보했다. 기간 길이가 다르므로 두 합계의 비율을 절감률로 계산하지 않는다.

| 한국 날짜 | 프로젝트 read 지표 | 범위 |
|---|---:|---|
| 11/18 | 10,858 | 배포 전 날짜 |
| 11/19 | 26,343 | 배포 전 날짜 |
| 11/20 | 22,364 | 배포 전/후 혼합 날짜 |
| 11/21 | 5,336 | 배포 후 날짜 |
| 11/22 | 6,178 | 09:09까지의 관측·부분일 |

합계71,079, LOOKUP6,040·NOT_FOUND1,974·QUERY63,065. 원시 시계열의 metric/resource/분 구간 중복은0이다. 03:14~03:20의 프로젝트 전체 read는11/21 3,398·11/22 3,476이었다. 감사 시각과 겹치지만 그 구간 전부를 단일 함수의 청구로 귀속하지 않는다. 활동량·다른 배포가 섞여 있어 **운영 캐시 절감률과 이번 작은 수정의 비용 효과는 미확정**이다. 이번 훅 수정은 아직 운영에 배포하지 않았으므로 위 지표에 그 효과가 포함되지 않는다.

새 증거(UID·토큰 제외): `evidence/post-release/2026-11-22T07-27-02-434Z-{summary.json,series.json.gz}`, `20261122-guest-sweep-counters.json`. 후자는 완료 로그의 시각·수치만 보존한다. 기존 계정 UID 포함 counts와 원시 실행 로그는 로컬에 유지하며 이 커밋에서 제외한다.

검증: 실제 훅+hub 회귀1/1(수정 전 동일UID 교체에서 opens=2로 실패, 수정 후 opens=1·closes=0), 정상/RTDB 무응답/명시적 오류/Firestore 단독 재생4/4, meters59/59, 지표 수집기2/2, tsc 통과, 변경 파일 lint 오류0·기존 경고6. 새 훅 시험의 외부 HTTP 요청은0이다. 전체quick·전체build·실폰/실센서·실제 다인 청구 실측은 이번 미실행이다. 푸시·배포 없음.

재검증(각 명령은 독립 실행):

```powershell
Set-Location "C:\20.HDev\boxcycle\apps\web"; node --test "C:\20.HDev\boxcycle\apps\web\scripts\trail\spectator-subscription-lifecycle.test.mjs"
Set-Location "C:\20.HDev\boxcycle\apps\web"; node --test "C:\20.HDev\boxcycle\apps\web\scripts\peer-sync\live-ride-query-fallback.test.mjs"
node --test "C:\20.HDev\boxcycle\document\ops\20261119-firestore-read-audit\tools\collect-read-metrics.test.mjs"
```

아래 11/20 구현·관측 및 당시 선택지는 과거 기록이다. 감사 주기의 현재 결정과 최신 관측은 이 절을 따른다.

## 이번 구현

상태: **DEPLOYED**. 소스 `5a5b3170` 원격 반영·guestLifecycleSweep 단일 배포 완료. 새 revision `guestlifecyclesweep-00011-cej` ACTIVE, 다른 38개 함수 updateTime 동일. Hosting HTML 해시는 기존112131aa 배포와 동일. 배포·관리 API 확인 시각 `2026-11-19T21:05:25.242Z`.

`guestLifecycleCore.ts`는 Auth 목록으로 이미 제외가 확정된 보호 UID·Auth admin·활성 등록 계정을 처리할 때 users·guestLifecycle 문서를 읽지 않는다. 등록 계정 1명당 기존 최대 2회, 보호/Admin은 최대 1회 조회가 줄어든다. Auth가 disabled인 등록 계정은 기존 복구 경로로 보내 lifecycle이 끈 계정을 다시 허용한다. 만료·관찰 30일, 연결 lease, 재시도·소유권·활동 재확인·RTDB 차단·삭제 cap은 유지한다.

이는 **약 3,300건/일 전체 후보 발견 비용을 없애는 수정이 아니다**. 전수 감사 주기와 고아 발견 지연에 대한 Chief 답변을 기다리는 동안 안전하게 적용할 수 있는 범위다. 현재 등록자 수에 비례하는 작은 절감이다. 후보 발견을 앞당겨 만든 membership/motion 캐시를 삭제 판정에 재사용하는 방식은 최신 활동 확인 시점을 약화할 수 있어 채택하지 않았다. guestLifecycleAdmin.ts 변경은 없다.

`tools/collect-read-metrics.mjs`는 기존 CLI 자격 증명으로 Cloud Monitoring GET만 호출한다. 전 페이지·60초 합계를 수집하고 KST/PT 날짜, 배포 전/후/경계 겹침을 구분한다. PT 날짜는 IANA 시간대로 일광절약시간도 반영한다. 운영 Firestore 문서 조회·가짜 주행·청구 총액 추정은 하지 않는다. 전체 시계열 gzip과 요약을 새 파일로 남긴다. 이 지표는 프로젝트 범위(firestore_instance)이며 DB별 라벨은 제공되지 않는다.

## 검증·운영 관측

- `C:\20.HDev\boxcycle\functions`에서 `npm test`: **307/0**, tsc 포함. 제외 계정 문서 조회 0, disabled 등록 계정 복구를 실행 검증했다.
- 같은 폴더에서 `npx eslint src/guestLifecycleCore.ts src/guestLifecycleCore.test.ts`: PASS.
- 루트에서 `node --test document/ops/20261119-firestore-read-audit/tools/collect-read-metrics.test.mjs`: **2/0**. 페이지 넘김·겨울/여름 PT 자정·배포 경계·배포 후 데이터 부재·빈 결과·반복 토큰·잘못된 구간 검증.
- 최초 Monitoring 요청은 존재하지 않는 database_id 리소스 라벨 때문에 400. 저장된 descriptor/시계열의 firestore_instance 리소스로 고쳐 재요청 성공했다.
- 05:57 KST 수집: 11/19 05:00~11/20 05:47 KST 요청 구간 **22,750**(LOOKUP1164·NOT_FOUND431·QUERY21155). KST11/20 부분일3,320, PT11/19 부분일8,091. 부분일을 하루 총량/청구 한도와 직접 비교하지 않는다.
- 최신 관측 포인트는 **11/20 03:54 KST**로, 04:57~04:59 함수·Hosting 배포 이전이다. `postReleaseObserved=false`, 배포 후 포인트0. 따라서 after 합계0을 읽기0·절감률100%로 해석하지 않는다. 지표 부재 원인(활동 부재/보고 지연)은 이 결과만으로 구분하지 못한다.
- 수집 증거: 로컬 `evidence/post-release/2026-11-19T20-57-44-070Z-{summary.json,series.json.gz}`. 개인 식별정보/토큰을 출력하거나 커밋하지 않는다.

## 11/20 당시 Guest 개선 선택지 — 11/22 매일 유지 확정

기존 전수 조회는 Auth가 이미 사라지고 users 프로필도 없는 개인 자료를 발견하는 유일한 경로다. 이 경로를 매일 생략하면 발견 주기가 바뀌므로 AGENTS의 데이터·기능 의미 변경 결정 규칙에 따라 Chief 선호를 질문했다. 답변 전에는 매일 전수 감사·정상 Guest 만료·재시도를 유지한다.

1. **주 1회 전수 감사(권고)**: 해당 스캔의 주간 평균 비용 약86% 감소(자료량 일정 가정). 고아 발견은 최대 7일 주기, 장애/삭제 cap에 따른 실제 완료 지연은 별도다. 정상 Guest는 매일 처리한다. 감사 실패 재시도·cap 뒤 남은 후보의 지속 처리를 보장하는 체크포인트/큐를 함께 설계한다.
2. 매일 제한량 순환 감사: 실행당 문서 예산·커서·남은 후보 큐. 고아 발견 지연은 데이터량/예산에 비례한다.
3. 매일 전수 감사 유지: 현행 발견 주기를 보존하되 큰 전수 조회 비용은 남는다.

어느 안도 Guest 삭제 기능을 끄거나 활동 재확인을 생략하지 않는다. 운영 데이터 삭제·마이그레이션/원시 UID 원장 쓰기는 이번 작업에 없다.

다인 주행은 `10-multi-rider-relay-design.md`의 장애 복구 품질·RTDB 대역까지 포함한 결정이 필요하다. 후보B의 라이더 Firestore 백업 읽기 해제는 기존 복구 지연 우려와 충돌하므로 미구현 유지한다.

## 재실행

```powershell
cd C:\20.HDev\boxcycle
node --test document/ops/20261119-firestore-read-audit/tools/collect-read-metrics.test.mjs
$endTime = [DateTimeOffset]::UtcNow.AddMinutes(-10).ToString('yyyy-MM-ddTHH:mm:00Z')
node document/ops/20261119-firestore-read-audit/tools/collect-read-metrics.mjs --start=2026-11-18T20:00:00Z "--end=$endTime" --release-at=2026-11-19T20:00:00Z --out=document/ops/20261119-firestore-read-audit/evidence/post-release
```

배포 후 최초 정상 계정 집계·캐시 저장이 이뤄진 다음, 최초 진입·같은 계정 재방문·신규 도로 반영을 분리해 비교한다. 빈 쿼리/Rules·네트워크 재연결·누적량 차이가 있어 Monitoring 총량만으로 캐시의 개별 효과를 귀속하지 않는다.

원본 pre-commit ESLint·pre-push DB 통로/서버307/0/웹1584/0(95.6초) 통과 후 푸시했다. 선별 Git 사본 7,196파일을 blob과 대조하고 큰 정적 자산95개는 hardlink로 보존했다(변경 없음), 의존성만 junction이다. 배포는 이 사본에서 수행했다. 증거는 `evidence/guest-release-source-verification.json`, `evidence/guest-function-release-verification.json`, 상세 로컬 로그는 `tmp/guest-read-followup-20261120/{push.log,deploy.log}`. 배포 함수의 실제 정리 실행은 수동 호출하지 않았다. 다음 정기 실행 로그의 제외/관찰/삭제/실패 수치로 확인한다.
