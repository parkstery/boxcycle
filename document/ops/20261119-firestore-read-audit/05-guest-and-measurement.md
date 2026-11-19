# Guest 정리·운영 절감 측정 후속

2026-11-20, 수행 agent: Codex 직접. Chief 「잔여 작업 계속해」. 완성분 커밋·푸시·배포 승인은 앞선 지시를 이어 적용한다.

## 이번 구현

상태: LOCAL_VERIFIED, 선별 커밋·원본 게이트·guestLifecycleSweep 단일 배포 준비.

`guestLifecycleCore.ts`는 Auth 목록으로 이미 제외가 확정된 보호 UID·Auth admin·활성 등록 계정을 처리할 때 users·guestLifecycle 문서를 읽지 않는다. 등록 계정 1명당 기존 최대 2회, 보호/Admin은 최대 1회 조회가 줄어든다. Auth가 disabled인 등록 계정은 기존 복구 경로로 보내 lifecycle이 끈 계정을 다시 허용한다. 만료·관찰 30일, 연결 lease, 재시도·소유권·활동 재확인·RTDB 차단·삭제 cap은 유지한다.

이는 **약 3,300건/일 전체 후보 발견 비용을 없애는 수정이 아니다**. 전수 감사 주기와 고아 발견 지연에 대한 Chief 답변을 기다리는 동안 안전하게 적용할 수 있는 범위다. 현재 등록자 수에 비례하는 작은 절감이다. 후보 발견을 앞당겨 만든 membership/motion 캐시를 삭제 판정에 재사용하는 방식은 최신 활동 확인 시점을 약화할 수 있어 채택하지 않았다. guestLifecycleAdmin.ts 변경은 없다.

`tools/collect-read-metrics.mjs`는 기존 CLI 자격 증명으로 Cloud Monitoring GET만 호출한다. 전 페이지·60초 합계를 수집하고 KST/PT 날짜, 배포 전/후/경계 겹침을 구분한다. PT 날짜는 IANA 시간대로 일광절약시간도 반영한다. 운영 Firestore 문서 조회·가짜 주행·청구 총액 추정은 하지 않는다. 전체 시계열 gzip과 요약을 새 파일로 남긴다. 이 지표는 프로젝트 범위(firestore_instance)이며 DB별 라벨은 제공되지 않는다.

## 검증·운영 관측

- `C:\20.HDev\boxcycle\functions`에서 `npm test`: **307/0**, tsc 포함. 제외 계정 문서 조회 0, disabled 등록 계정 복구를 실행 검증했다.
- 같은 폴더에서 `npx eslint src/guestLifecycleCore.ts src/guestLifecycleCore.test.ts`: PASS.
- 루트에서 `node --test document/ops/20261119-firestore-read-audit/tools/collect-read-metrics.test.mjs`: **2/0**. 페이지 넘김·겨울/여름 PT 자정·배포 경계·배포 후 데이터 부재·빈 결과·반복 토큰·잘못된 구간 검증.
- 최초 Monitoring 요청은 존재하지 않는 database_id 리소스 라벨 때문에 400. 저장된 descriptor/시계열의 firestore_instance 리소스로 고쳐 재요청 성공했다.
- 05:57 KST 수집: 11/19 05:00~11/20 05:47 KST 요청 구간 **22,750**(LOOKUP1164·NOT_FOUND431·QUERY21155). KST11/20 부분일3,320, PT11/19 부분일8,091. 부분일을 하루 총량/청구 한도와 직접 비교하지 않는다.
- 최신 관측 포인트는 **11/20 03:54 KST**로, 04:58 함수·Hosting 배포 이전이다. `postReleaseObserved=false`, 배포 후 포인트0. 따라서 after 합계0을 읽기0·절감률100%로 해석하지 않는다. 지표 부재 원인(활동 부재/보고 지연)은 이 결과만으로 구분하지 못한다.
- 수집 증거: 로컬 `evidence/post-release/2026-11-19T20-57-44-070Z-{summary.json,series.json.gz}`. 개인 식별정보/토큰을 출력하거나 커밋하지 않는다.

## 핵심 Guest 개선의 결정 항목

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
