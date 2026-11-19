# read 절감 2차 — 도로망 재방문 캐시·변경분 동기화

2026-11-19, Codex 직접 구현·검증. Chief 「계속해」에 따라 우선순위 2의 남은 전체 재조회 문제를 진행했다. **LOCAL_VERIFIED, 미커밋·미배포**. 운영 데이터 변경/삭제·마이그레이션·배포 없음. 다른 작업의 변경 보존.

**후속 11-20**: `112131aa` 커밋·푸시、대상 함수/Hosting 배포·운영 정적 파일 대조 완료. 아래는 최초 구현 시점 기록이다. 현재 상태는 [릴리스](04-release.md)를 따른다.

## 결과와 확인 범위

실제 Firestore 에뮬레이터에 구형 데이터와 같은 **묶음 69개·궤적 342개**를 만들고 제품 서버 트랜잭션과 제품 클라이언트 쿼리를 실행했다.

| 조건 | 도로망 본문 반환 문서 | 추가 요약 확인 |
|---|---:|---:|
| 캐시 없는 첫 조회 | 411 | 1 |
| 동일 계정·버전 재방문 | **0** | 0 |
| 새 도로 추가 — 묶음 1개·궤적 1개 변경 | **2** | 1 |

마지막 경우 기존 궤적 342개를 보존하며 새 궤적까지 총 343개를 표시 재료로 반환했다. 본인 쿼리만 허용하고 타인의 동일 쿼리는 현행 Rules가 거부했다. 이 숫자는 시험에서 센 **쿼리 반환 문서 수**다. 기존 요약 구독·Rules 의존 읽기·빈 쿼리 최소 과금·앱의 다른 조회와 실제 운영 청구 총량은 포함하지 않는다. 모든 사용자가 새 도로를 얻을 때 2문서만 받는다는 뜻도 아니다. 실제 변경된 묶음/궤적 수만큼 달라진다.

## 서버 계약

`functions/src/conquestOnRideCreated.ts`의 기존 집계 트랜잭션에서 다음 메타데이터를 **기존 문서 쓰기에 함께** 기록한다.

- 요약 `roadSync = { schema: 1, epoch, version, updatedAt }`.
- 바뀐 chunks/traces 문서의 `roadSyncCursor = epoch + ':' + 16자리 버전`.
- 새로운 도로 데이터가 있을 때만 version 증가. 신규 도로가 없는 주행의 일일 한도/주행 결과 갱신은 유지하되 도로망 본문 버전은 유지한다.
- 처음 집계하는 구형 계정이나 유효하지 않은 프로토콜에는 새 epoch·version=1을 부여한다. 기존 묶음/궤적 전체를 다시 쓰는 backfill은 필요 없다.
- `roadSync.updatedAt`과 요약 루트 `updatedAt`은 같은 트랜잭션의 serverTimestamp다. 구형 서버가 요약을 갱신하면 두 값이 달라져 클라이언트가 증분 프로토콜을 사용하지 않는다. 다음 신형 서버 집계는 epoch를 바꿔 새 전체 기준을 요구한다. 구·신 코드 혼재/롤백에서 캐시가 계속 유효한 것으로 오인하지 않게 한다.

별도 변경 로그 문서나 새 subcollection을 만들지 않았다. 새 정기 작업·함수 종류·추가 서버 조회/문서 쓰기도 없다. 기존 문서 payload와 자동 단일 필드 색인 저장량은 메타데이터만큼 늘어난다. 인덱스/Rules 파일 변경 없음. epoch별 고정 폭 cursor의 **동일 필드 범위**를 조회하므로 별도 복합 색인이 필요 없다.

**향후 유지보수 계약:** v2 도로의 문서 삭제·수정은 요약 epoch를 새로 만들고 요약/roadSync 시각을 같은 트랜잭션으로 갱신해야 한다. 이번 일반 집계 외의 임의 Admin 직접 편집을 자동으로 탐지하는 시스템은 아니다. 현행 계정 삭제/Guest 초기화는 부모와 하위 데이터·Auth를 지우며 캐시도 지운다. 현재 v1 purge는 표시 대상이 아닌 z10 잔재 정리이며 v2 셀/궤적 정본을 변경하지 않는다.

## 클라이언트 계약

- `conquest/conquestRoadSync.ts`: 순수 동기화 조정기·버전/캐시 검증. 같은 버전은 저장한 전체 재료를 재사용한다. 같은 epoch의 증가 버전은 변경 문서만 읽어 **문서 ID별 교체**한다. 바뀐 묶음의 셀을 통째로 교체하므로 기존 셀 수정도 반영하고, 같은 trace ID를 중복 추가하지 않는다.
- `conquest/repo/conquestRoadCache.ts`: IndexedDB `spinatlas-conquest-cache-v1`. Firebase 프로젝트·운영/에뮬레이터·uid별 키를 구분한다. 작업 완료 때 연결을 닫는다. 저장 불가/용량 부족/손상은 캐시 miss로 처리해 서버 조회를 계속할 수 있다.
- `conquest/repo/firestoreConquest.ts`: 제품 쿼리와 해석. 버전이 유효하면 server query로 전체 또는 변경분을 읽고, 끝에서 요약을 1회 확인해 읽는 동안 버전이 바뀌지 않았는지 검증한다. 바뀌면 마지막 캐시 기준에서 다시 조회하며 최대 3회로 제한한다. 실패/삭제/계속 바뀌는 버전은 현재 캐시를 성공한 새 버전으로 덮지 않는다.
- 새 epoch, 캐시 유실/손상, 다른 uid, 알려지지 않은 schema는 전체 기준으로 복원한다. 조회 중 부모 삭제는 저장 캐시를 버리고 이전 데이터를 새로운 기준으로 게시하지 않는다.
- 버전이 없는 기존 서버/구형 writer의 문서는 기존 전체 조회로 돌아가며 영속 캐시를 유효하다고 간주하지 않는다. 구형 경로의 SDK 캐시 동작도 유지한다.
- `useConquest`: 거리뿐 아니라 epoch/version 변경도 조회 신호로 사용한다. 거리·version 숫자가 같더라도 epoch가 바뀌면 교체한다. 진행 중 중복 요청 공유·이전 uid/이전 버전 응답 차단·기존 최근 신규 도로 복원을 유지한다.
- `guestAccountReset.ts`: 성공한 계정 삭제/초기화에서 새 도로망 캐시도 지운다. `indexedDB.databases()` 미지원/오류여도 알려진 캐시 이름은 직접 삭제한다. 등록 사용자 삭제도 같은 정리 함수를 사용한다.

도로망 표시 범위·기능·인정 거리·한도·지역 계산·동행 폴백은 변경하지 않았다. 오래된 도로를 limit으로 숨기지 않는다. UI 변경 없음.

## 검증 결과

| 검증 | 명령/결과 |
|---|---|
| 웹 전체 회귀 | apps/web의 `node scripts/test-quick.mjs` — **1598 PASS / 0 FAIL**, 99.7초, emulator/별도 하네스 6파일 제외 |
| 서버 전체 | functions의 `npm.cmd test` — **305 PASS / 0 FAIL** |
| 실제 Firestore query·transaction·Rules | 아래 emulator 명령 — **1 PASS / 0 FAIL**, 411→0→2+확인1·이전 epoch 범위 제외·구형 writer 감지 |
| 실제 IndexedDB/React | 위 quick 포함. reload 후 복원·uid/환경 격리·저장 실패·목록 조회 미지원 상태의 계정 삭제 정리·누적값이 같은 epoch 교체 확인 |
| 순수 동기화 | 위 quick 포함. 전체/증분/동일 버전·수정 교체·캐시 손상·부모 삭제·조회 실패·연속 버전 변경/재시도 상한·구형 writer 시각 불일치 확인 |
| 타입 | apps/web `tsc -b` / functions `tsc` PASS |
| 변경 파일 lint | 웹/서버 모두 PASS, 오류/경고 0 |
| 제품 빌드 | Vite PASS, 기존 500KB chunk 및 plugin timing 경고 |
| 구조/부산물 | 루트 check-dep-direction PASS·미지정/순환/방향 위반 0, check-dev-tools PASS·기존 WARN 8 |

중간 실패도 구분한다. 첫 IndexedDB 시험은 miss 반환의 null/undefined 기대값이 잘못돼 실패했고 null로 수정했다. 첫 emulator 시험은 createRequire의 기준 경로를 잘못 써서 서버 빌드 모듈 import 전에 실패했으며 경로 수정 후 통과했다. 첫 전체 quick은 **1596 PASS / 1 FAIL**: 지도 레이어 문자열 검사기가 새 DB의 `boxcycle-` 이름까지 레이어로 해석했다. 실제 지도 레이어를 바꾸지 않고 신규 저장소 이름을 브랜드에 맞는 `spinatlas-`로 정리한 뒤 최종 1598/0을 확인했다.

로그: `apps/web/.out/read-reduction-phase2-{quick,functions,emulator,build}.log`. 운영 read 실측·실폰 IndexedDB 성능·다중 실제 기기 동시 주행·Hosting/Functions 배포는 미실행이다. 최초 전체 읽기의 크기/속도와 저장 공간은 사용자의 누적량에 비례하며 이번 변경이 최초 다운로드 자체를 없애지는 않는다.

## 적용·재개 순서

운영 반영에는 **Functions와 Hosting 둘 다** 필요하다. 버전이 없으면 구형 조회로 돌아가므로 순서가 뒤집혀도 기능이 비지 않는다. 다만 권고 순서는 함수→웹이다. 기존 계정은 **배포 후 첫 정상 집계 때** 버전이 생기고, 이후 첫 전체 기준 저장부터 재방문 절감이 활성화된다. 즉 배포 직후 모든 기존 계정의 read가 즉시 0이 되는 것은 아니다. 운영 데이터 일괄 채우기는 수행하지 않았다.

다음 작업은 우선순위 3인 Guest 일일 전수 스캔 개선이다. 유효 활동/30일 유예·등록 보호·고아 발견·실패 재시도와 읽기 예산을 함께 유지해야 한다. 동행 구조 결정 대기와는 별도다.

## 재실행

실행 폴더를 포함한 명령이다. 첫 두 단계는 운영 서비스 없이 실행된다.

```powershell
cd C:\20.HDev\boxcycle\apps\web
node scripts/test-quick.mjs
cd C:\20.HDev\boxcycle\functions
npm.cmd test
cd C:\20.HDev\boxcycle
& "C:\Users\kdrea\AppData\Roaming\npm\firebase.cmd" emulators:exec --only firestore --project demo-conquest-sync --config firebase.json "node --experimental-strip-types --import ./apps/web/scripts/s42/register-vite-env.mjs --test apps/web/scripts/conquest/conquest-road-sync.emulator.test.mjs"
```

서버 빌드가 준비된 뒤 emulator 시험이 제품 transaction을 로컬 demo DB에서 실행한다. 콘솔의 baselineDocuments=411 / unchangedDocuments=0 / deltaDocuments=2 / deltaParentVerification=1을 확인한다. 웹 접속이나 추가 실제 라이딩은 필요 없다.
