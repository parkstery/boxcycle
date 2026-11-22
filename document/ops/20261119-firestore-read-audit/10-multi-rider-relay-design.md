# 다인 주행 위치 전달 — 중계기(릴레이) 구조 설계 후보

**11-22 현재 판단:** 아래는 비교 설계 보존본이며 후보B 채택 지시가 아니다. 상시 Firestore 백업은 유지한다. 빠른 후속은 동일UID 관전 재구독 제거까지이며, 보드/중계기·장애 복구의 큰 구조 변경은 후속이다. [최신 결과](05-guest-and-measurement.md).

작성: 2026-11-19, 수행 agent: **Codex 직접**. 검토 대상: Chief 질의 「트레일 안에 중계기를 두고 중계기가 위치를 모아 브로드캐스팅하면 트래픽을 줄일 수 있지 않는가」.

상태: **중계 구조는 설계·정량 검토만. 관련 제품 구현·운영 쓰기·배포 없음. 설계 문서를 보존한다.** 동기화 구조 변경은 Chief 결정 대상이라 구현에 들어가지 않았다.

## 1. 결론 먼저

1. **제안이 옳고, 사실 절반은 이미 만들어져 있다.** 현재 고빈도 위치 채널(RTDB)은 이미 사용자가 말한 「중계기」 방식이다. 각 라이더는 자기 노드에만 쓰고(`trails/{trailId}/motion/{uid}`), 전원이 중계 지점 하나(`/trails/{trailId}/motion`)를 구독한다(스타 토폴로지). RTDB는 읽기 횟수가 아니라 **저장·다운로드 대역**으로 과금되므로 n:n 배수가 청구로 곱해지지 않는다.
2. **남은 n:n 과금은 Firestore 백업 채널**(`trails/{trailId}/livePublicationRides/{uid}`)이다. 여기가 「각자 서로의 문서를 구독」하는 지점이라 문서 변경이 수신자 수만큼 읽기로 청구된다.
3. **같은 Trail 문서 1개로 묶는 방식은 직접 구현하지 않는다.** Firestore 청구는 「문서 수」가 아니라 「수신자에게 전달된 문서 변경 1건」이다. 따라서 중계기가 모아 쓰는 문서가 1개라도, 갱신 주기가 12초면 그 변경이 전 수신자에게 각각 1 read로 청구된다. **중계기 쓰기를 1주기 1회로 묶지 않으면(중계기가 초당 갱신하면) 제곱항이 그대로 살아남는다.**
4. **권고는 「라이더는 RTDB relay만, 관전자는 중계 보드 1개, 백업은 읽지 않는 쓰기」의 3분할이다.** 총 읽기는 n²에서 **Trail당 선형**으로 내려간다.

## 2. 지금 실제로 무엇이 돌아가는가 (코드 근거)

| 층 | 경로 | 위상 | 과금 방식 | 읽기 배수 |
|---|---|---|---|---|
| 고빈도 motion | RTDB `trails/{tid}/motion/{uid}` (`rtdbTrailMotion.ts:313` `subscribeTrailMotion`) | **스타(중계)** — 각자 자기 노드만 쓰고, 전원이 중계 노드 1개를 구독 | 저장·**대역**·동시접속 | read 없음. 대역은 **구독자당 N배 → 전체 N²**(§3-1) |
| 백업/관전 | Firestore `trails/{tid}/livePublicationRides/{uid}` (`firestoreTrailLivePublicationRides.ts:80`) | **n:n** — 각자 컬렉션 전체를 자기 uid 제외 조건으로 구독 | 문서 읽기 | **수신자 수만큼** |

쓰기 쪽: `mergeTrailLivePublicationRideSnapshot` 은 자기 문서 1개만 쓴다. 쓰기는 수신자와 무관하므로 **n:n 배수가 없는 부분**이고, 배수 곱은 읽기에서만 생긴다.

수신자 배수를 늘리는 구독 지점(모두 같은 Trail, uid 제외 조건 포함):

- `PublicationSharedPresence.tsx:253` — 주행 중 동행 표시(라이더)
- `useTrailLivePublicationRideSpectatorOverlay.ts:60` — Trail 관전 오버레이(같은 viewer 안에서는 hub 가 refcount 로 1개)
- `useWorldLivePublicationRideMapOverlay.ts:113` — **Trail 마다 구독 1개**(세계 지도 오버레이) → Trail 수만큼 배수 추가

## 3. 정량 모델 (1 Trail · 1시간 · Firestore 읽기)

정상 주행에서 Firestore 백업 하트비트는 **12초**(`TRAIL_LIVE_PROGRESS_HEARTBEAT_RTDB_HEALTHY_MS`) → 라이더당 시간당 300회 갱신. RTDB 가 끊기면 4초로 준다.

현재(각 라이더가 자기 문서 1개 갱신, 전원이 그 컬렉션 구독):

> 읽기 = 300 × N × (N−1)

| N | 2 | 5 | 10 | 20 | 50 |
|---|---:|---:|---:|---:|---:|
| 현재 읽기/시간 | 600 | 6,000 | 27,000 | 114,000 | 735,000 |

후보 A — **서버 중계기 + Trail 보드 문서 1개**

- 중계기(Cloud Function)가 12초 주기로 N개 백업 문서를 읽어 보드 1개로 묶어 씀 → 서버 읽기 300×N, 보드 쓰기 300(저렴)
- 전원이 보드 1개만 구독 → 변경 1건당 수신자당 1 read → 클라이언트 읽기 300×N
- 합계 **600×N** (중계기 쓰기가 12초를 지키는 조건에서만 성립)

| N | 2 | 3 | 5 | 10 | 20 | 50 |
|---|---:|---:|---:|---:|---:|---:|
| 후보 A 읽기/시간 | 1,200 | 1,800 | 3,000 | 6,000 | 12,000 | 30,000 |
| 현재 대비 | 2.0배↑ | 같음 | 2.0배↓ | 4.5배↓ | 9.5배↓ | 24.5배↓ |

후보 B — **RTDB relay 상시 + Firestore 백업은 읽지 않기**(권고)

- 라이더: RTDB relay 만 사용 → Firestore 읽기 **0**
- 관전자: 중계 보드 1개 구독 → 1 read/주기 (N에 무관)
- 서버 중계기 읽기: 300×N (선형)
- 총: **300×N + 300×관전자수** — N이 아니라 **선형**

후보 C — **relay 를 클라이언트(피어 한 명)로** 운행 → 비추천. 연결·전원·모바일 백그라운드에서 신뢰 불가, 규칙 우회 위험, 규칙·권한 계약을 깨뜨린다.

## 3-1. RTDB 채널의 실제 대역 (「RTDB 면 11만4천은 아니냐」에 대한 정답)

**11만4천 read 는 Firestore 만의 숫자이고, RTDB 에 read 카운터는 없다.** RTDB 과금은 저장 + **다운로드 대역**(프로토콜·암호화 오버헤드 포함) + 동시접속이다. 공식 문서: 「Firebase bills for the data you store and all outbound network traffic… Downloads: All bytes downloaded from your database, including protocol and encryption overhead」. 무료(Spark) 할당량은 저장 1GB + **다운로드 10GB/월**.

다만 **구조적 배수는 RTDB 에도 그대로 있다.** 중계 노드 1개를 구독하면 각 구독자가 N명 스트림을 전부 받으므로, 구독자당 N배·전체 합계로는 **N² 바이트**다. 단위가 read → byte 로 바뀔 뿐이다.

실측 기반 추정(저장소 자체 실측: 로컬 RTDB + WebSocket 프록시, 정상 정속 20표본 → **하향 3,483B = 표본당 약 174B**; `20261029-peer-cost-quality/07-traffic-reduction-implementation.md`). TLS·운영 경로·청구 실측은 아니다. publish 주기 200ms(5Hz) → 라이더당 18,000회/시간.

| 20인 동시 주행 1시간 | 값 |
|---|---|
| 구독자 1명이 받는 이벤트 | 20인 × 18,000 = **360,000건** |
| 구독자 1명의 다운로드 | 360,000 × 174B ≈ **62.6MB/시간** (100B 기준이면 36MB) |
| Trail 전체 다운로드(구독자 20명 합계) | **0.7 ~ 1.25GB/시간** |
| 무료 할당량(10GB/월) | 이 시나리오 기준 **8~14시간/월**까지 무료 |
| Blaze 초과분 | $0.15/GB → **$0.11 ~ 0.19/시간** |
| 같은 시나리오 Firestore | 114,000 read × $0.06/100k = **$0.068/시간** (무료 5만 read/일 → **26분이면 소진**) |

**건당 단가로는 RTDB 가 더 싸다.** Firestore read 1건 = $0.0000006, RTDB 174B 전달 = 174 × $0.15/GB ≒ $0.000000026 → **약 23배 싸다**. (read 1건과 RTDB 4KB 전달이 같은 금액이므로 페이로드가 4KB 이하이면 RTDB 가 유리.) 그럼에도 총액이 RTDB 쪽이 클 수 있는 이유는 **밀도**다 — RTDB 는 5Hz(18,000회/시간), Firestore 백업은 12초(300회/시간) → **60배 자주 보낸다**.

따라서 RTDB 비용을 지배하는 변수는 「n:n 배수」가 아니라 **전송 밀도(Hz)** 다. 같은 12초 주기로 내리면 RTDB 대역은 1/60 이 된다. (§5 적응 주기)

추가로 고려할 점:

- **모바일 데이터·배터리**: 구독자당 62.6MB/시간 = 약 1MB/분. 20인 주행이면 각 기기가 5MB/분 받는다. 요금 문제가 아니라 제품 품질 문제다.
- **RTDB 기술 한계**: uid별 노드라 hot node 는 없다(노드당 1 write/s 지속 회피). 연결 100k·Load 지표는 20인 규모에서 무관하다. 다만 리전 인스턴스가 나뉘면 리전 간 공유는 안 된다(유럽 RTDB 미접속).
- **rtdb read 카운트가 없다는 것이 「공짜」는 아니다**: 무료 할당량은 **월 10GB** 이다. Firestore 는 **일 5만 read** 라 비교 기준이 다르고, Firestore 는 리셋이 **일 단위**여서 주행이 몰리는 시간대에만 튕긴다.

## 4. 후보 A 의 함정 (구현할 때 반드시 지킬 것)

1. **중계기 쓰기 1주기 1회.** Firestore 트리거는 문서 쓰기마다 호출되므로(300×N 회/시간) 매 호출마다 보드를 쓰면 보드 변경이 300×N 회 → 전원에게 300×N×N read. **쓰기 주기 제한이 없으면 후보 A 는 후보 B 보다 나쁘다.** 스케줄(12초) 또는 트리거 + 시각 가드가 필요하다.
2. **중계기 자신의 읽기도 청구된다.** 서버 read 300×N/시간은 사라지지 않는다. 후보 B 와 같은 선형 비용이므로 후보 A 단독보다 B 가 낫다.
3. **hot document.** 12초 주기면 안전(지속 1Hz 이상 쓰기가 위험). 1 Trail 인원이 100명 넘어도 보드 1개라 Firestore hot document 한계(초당 1 write 권장)에 걸리지 않는다.
4. **문서 크기.** 보드 1개에 N명 상태 → 20명 ≈ 3KB, 1MB 한도 여유. 다만 필드 수가 늘면 좌표 정밀도·표본시각(원본 시각)·phase 를 유지해야 한다.
5. **표본시각 보존.** 보드로 모으면서 원본 `t`(샘플 시각)·`lastSeenAt` 을 그대로 실어야 표시 지연·외삽 품질이 유지된다.

## 5. 권고안 (3분할) — 구현 전에 Chief 결정 필요

| 층 | 현행 | 권고 |
|---|---|---|
| 라이더 주행 중 | RTDB 5Hz + Firestore 라이브 구독 | **RTDB 만 사용.** Firestore 라이브 구독 해제, RTDB 장애·연결 단절 감지 시에만 1회 조회 후 폴백 구독 |
| 관전자·세계 지도 | Firestore 컬렉션 라이브 구독(Trail 마다 1개) | **Trail 보드 1개 구독**(중계기 12~30초 주기). 관전자 1인당 1 read/주기 |
| 백업 | 라이더가 자기 문서에 12초 쓰기 | **그대로 유지(쓰기만)**. 읽는 사람이 없으므로 FS 읽기 비용 0. RTDB 장애 복구 시 1회 조회 후 스냅샷 |
| 중계기 | 없음 | Cloud Function 1개(스케줄 12초 또는 트리거+가드). Trail 보드 문서 1개 |

기대: 동일 시나리오(20인·1시간)에서 Trail 읽기 **114,000 → 약 6,000**(서버 중계기 300×N) + 관전자 300 이하. 즉 **제곱 → 선형**.

추가 후보(별도): 참가자 수에 따른 **motion publish 주기 적응**(5Hz → 10명 이상 2~1Hz). RTDB 는 대역 과금이므로 이쪽이 선형 증가를 줄인다. 보간(200ms 지연)이 이미 있어 주기 완화 시 표시가 부드러워지는지 재생 하네스로 확인 필요.

## 6. 리스크와 보존해야 할 계약

- **장애 독립성**: 중계기가 죽으면 보드는 갱신되지 않는다 → 주기 stale 로 표시 소실(관전자 30초 기준). 라이더는 RTDB 로 계속 표시되므로 주행 experience 영향은 제한적이다. 중계기 1개가 단일 장애점이 되므로 **RTDB 를 항상 1순위 소스로 유지**한다.
- **복구 지연**: "정상 시 Firestore 구독 해제"는 2026-10-29 `09-firestore-read-reduction.md` 에서 이미 거부된 안이다(당시: 끊긴 RTDB 감지 후 Firestore 붙이면 초기 조회 지연이 기존 백업보다 길다). 이번에도 **1회 조회로 즉시 상태를 채우는 경로**를 함께 설계해야 한다. 구독 재개만으로 끝내지 않는다.
- **표시 계약**: 원본 표본시각·정지/완주 burst·삭제·재합류·관전자 30초 stale·이름·타인 수를 그대로 보존한다.
- **권한**: 보드 문서 1개에는 Trail 의 전원 위치가 모인다. 관전자·비멤버에게 전체 상태가 한 번에 보인다 → Firestore Rules 를 「Trail 멤버/로그인」 으로 다시 설계해야 한다. 현재와 노출 범위가 달라질 수 있다.
- **지역(리전) 분리**: 유럽 RTDB(`boxcycle-dc2df-eu-rtdb`)는 아직 앱에 접속하지 않는다(2차 예정). RTDB relay 는 **리전 인스턴스별**이므로, 타 지역 라이더와는 Firestore 보드가 유일한 공유 채널이 된다. Trail 별 인스턴스 routing 이 구현되기 전에는 RTDB 만으로 대체할 수 없다.
- **백업**: Firestore 백업이 꺼진 상태(2026-10-08)여도 데이터 자체는 남는다. 다만 장기 보존·복구 정책은 별도 결정 사항.

## 7. 검증 계획(구현 후)

1. Firestore 에뮬레이터로 N=2/10/20 을 만들고 **실제 전달 read 수**를 계측(청구와 같은 1 read/문서 변경 규칙). 에뮬레이터 실측 0→N 표기 금지.
2. 후보 B 적용 전·후 표본: 읽기 횟수, 표시 지연·점프, RTDB 단독 장애·수신자 단독 장애·중계기 장애, 정지·완주·삭제·재합류, 관전자 소멸(30초).
3. 회귀: `node apps/web/scripts/test-quick.mjs`·peer-sync 재생 하네스·`npx tsc -b`·`npm run build`.
4. 마지막에만 운영에서 짧은 구간 실측(별도 프로젝트·에뮬레이터 기본값으로 전환 후).

## 8. Chief 결정이 필요한 항목

1. **Firestore 라이브 구독을 주행 중 라이더에게서 제거할 것인가** (읽기 절감 최대, RTDB 단독 장애 복구 경로 신설 필요). —— 후보 B 의 핵심.
2. **관전자·세계 지도용 보드 문서를 만들 것인가** (Rules·문서 크기·중계기 운영 비용 발생).
3. **중계기를 서버(Cloud Function)로 둘 것인가, RTDB 보드로 대체할 것인가.** RTDB 대체는 리전 인스턴스 routing 이 선행되어야 한다.
4. **motion publish 주기 적응(참가자 수 기반)을 넣을 것인가.**
5. **N≤3 소규모 그룹은 현재 구조를 유지할 것인가**(후보 A 가 3인 이하에서 역효과).

## 9. 근거

- 코드: `apps/web/src/lib/trail/repo/firestoreTrailLivePublicationRides.ts`, `livePublicationRidesQuery.ts`, `livePublicationRidesSubscriptionHub.ts`, `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts`, `apps/web/src/lib/ride/rideSyncPolicy.ts`, `apps/web/src/components/PublicationSharedPresence.tsx`, `apps/web/src/hooks/useTrailLivePublicationRideSpectatorOverlay.ts`, `apps/web/src/features/map-overlays/useWorldLivePublicationRideMapOverlay.ts`
- 앞선 조사: [Firestore read 과다 조사](README.md), [09-firestore-read-reduction](../20261029-peer-cost-quality/09-firestore-read-reduction.md) (자기 문서 서버 제외·정상 시 구독 해제 거부 선례)
- 과금 근거: [Firestore 과금](https://firebase.google.com/docs/firestore/pricing) — «listen to the results of a query, you are charged for a read each time a document in the result set is added or updated» · [Realtime Database 과금](https://firebase.google.com/docs/database/usage/billing) — 저장·다운로드 대역·동시접속 기반(읽기당 과금 없음)
- 위 표의 수치는 **청구 실측이 아니라 구조상 비용 모델**이다. 단가·무료 할당량·실사용량은 별도 확인 대상이다.
