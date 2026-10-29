# 표시 품질을 보존하는 트래픽 저감 검토

작성: 2026-10-29 · 독자: Chief/AI · 상태: **검토 완료·최적화 미구현** · [작업 입구](README.md)

## 결론

방안은 있다. 우선순위는 **같은 시각·같은 정밀도의 위치 표본을 유지하면서 반복 메타데이터와 Firestore의 위치 fanout을 줄이는 것**이다. 전송 간격을 늘리는 방법은 우선순위에서 제외한다. 이번 배포 대상은 송신 표본 시각 수정이며 이 문서의 구조 최적화는 포함하지 않는다.

현재 확인 수준으로 「전체 청구액을 몇% 줄이면서 품질이 완전히 같다」는 확정은 불가능하다. JSON 바이트, SDK 다운로드, Firestore 문서 읽기, Functions 호출과 실제 청구를 각각 측정해야 한다. 원화 총액을 단일 경로에 귀속하지 않는다.

## 보존할 품질 계약

- 움직이는 라이더의 RTDB 목표 200ms·거리 0.01m·속도 0.01m/s·실제 거리 표본의 `tSrv`를 유지한다.
- 자기·상대·카메라 공통 표시 시각과 600ms 지연을 유지한다. 창별로 임의 지연을 늘려 부드러워 보이게 하지 않는다.
- 합류·경로 전환·일시정지·완주·탭 종료·재연결과 RTDB 장애 시 대체 경로를 보존한다.
- 최적화 전후 **같은 패킷 타임라인의 최종 decoded row와 phase가 동일**해야 한다. 정상 구간 오차 변동폭·역행·표시 지연·두 창 순서를 함께 비교한다.
- 표시되지 않는 라이더도 목록·재등장·순서 의미가 있다. 화면 밖을 받지 않는 변경은 자동으로 무손실이라고 보지 않는다.

## 현재 비용을 만드는 경로

1. RTDB `mergeTrailMotionSnapshot`은 라이더마다 `p,d,v,ph,t,tSrv` 전체를 `set`한다. 5Hz이면 정상 정속 약18,000회/시간이다. 전체 Trail `/motion` 구독은 모든 uid 행을 로컬에서 해석하고, 자기·다른 publication 필터링은 수신 후 컴포넌트에서 한다.
2. Firestore `livePublicationRides`는 라이더당 4초 기록, 약900회/시간이다. 모든 참가자의 같은 Trail 구독으로 타인 문서 변경 전달은 대략 `900×N×(N−1)`/시간 형태다. 초기 동기화·자기 쓰기 echo·캐시·Rules·서버 읽기 등은 별도다.
3. `routeActivityOnLivePublicationRideWritten`는 같은 Firestore 갱신마다 호출된다. 작은 변화는 early-return이므로 모든 호출이 추가 DB 읽기를 유발한다고 단정하지 않는다.
4. Trail별 구독 hub와 주행중 listing/세계 구독 제한은 이미 존재한다. 새 최적화처럼 중복 계산하지 않는다.

근거 파일: `apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts`, `rtdbMotionSubscriptionHub.ts`, `trail/repo/firestoreTrailLivePublicationRides.ts`, `livePublicationRidesSubscriptionHub.ts`, `components/PublicationSharedPresence.tsx`, `functions/src/routeActivityOnLivePublicationRideWritten.ts`, `firestore.rules`, `database.rules.json`.

## 후보 비교

| 후보 | 표시 영향 | 비용 효과와 한계 | 판정 |
|---|---|---|---|
| 구독 누수·중복·종료 잔류 제거 | 원래 계약을 지키면 없음 | 실제 누수만큼 절감. 현재 hub가 있으므로 새 누수 증거 필요 | 최우선 계측·발견시 수정 |
| RTDB 동일 5Hz에서 변경 필드만 update | 같은 timestamp의 전체 row를 복원하면 없음 | JSON 전송량 감소 후보. SDK/server 증분 전송과 프로토콜 비용을 측정해야 청구 절감 판단 가능 | **저위험 실험 1순위** |
| RTDB 정적 metadata와 motion 분리 | 초기 metadata와 motion이 원자적으로 해석돼야 함 | 매 표본의 publication/phase 등 반복 bytes 감소. 별도 구독·Rules·재연결 비용 증가 가능 | 변경 필드 update 결과 후 비교 |
| Firestore 안정 metadata와 변동 위치 분리 | RTDB 정상 화면은 같게 할 수 있음 | 반복 위치 문서의 정상 구독 fanout 제거가 주효과. 장애 fallback·생존·목록 재설계 필요 | **Firestore 원가 개선의 핵심 구조 후보** |
| Written 활동 집계를 별도 저빈도 의미 이벤트로 분리 | 동행 위치에는 직접 영향 없음 | heartbeat 함수 호출 감소. 세계 pulse/anchor와 출입 집계를 보존해야 함 | 서버 집계 의미 설계 후 적용 |
| 근처 라이더만 서버/DB 구독 | 경계·재등장·추월 품질에 영향 가능 | 다인 fanout을 N²에서 N×K에 가까운 형태로 제한 가능. 추가 색인·shard 쓰기 비용 고려 | 규모 확대 단계 후보 |
| 수신 후 필터링·onValue→onChildChanged만 변경 | CPU/React 부담 감소 가능 | 네트워크 범위가 같으면 다운로드 절감 보장 없음 | CPU 개선과 비용 절감 분리 |
| FS payload 일부 필드 생략 | 표시 동일 가능 | lastSeenAt 등으로 문서 갱신이 계속되면 읽기·쓰기 건수는 동일 | 읽기 비용 해법으로 부적합 |
| 5Hz 축소·5초 수신·정밀도 축소 | 지연/예측/양자 진동이 변함 | 건수는 감소하나 현재 품질 요구와 충돌 | 이번 목표에서 제외 |

## A. 변경 필드 update의 구체적 검토

정상 정속에서 publication, phase, quantized speed는 흔히 동일하다. 초기 전체 `set` 이후 `d,t,tSrv`만 `update`하고, 속도/phase/publication이 바뀔 때 해당 필드를 포함하는 방안을 검토한다. `t`는 legacy/liveness 경로가 쓰므로 임의 삭제하지 않는다. 거리·시각의 실제 값과 주기는 유지한다.

예시 publication 길이20자, d=100.12m, v=1.39m/s, 13자리시각2개인 합성 JSON:

| 형태 | JSON bytes/표본 | 18,000표본/시간 |
|---|---:|---:|
| 전체 p,d,v,ph,t,tSrv | 99 B | 1,782,000 B |
| 정속 d,t,tSrv patch | 51 B | 918,000 B |
| 차이 | 48 B·약48.5% | 864,000 B |

이는 **클라이언트 JSON 요청 body 모델**이다. RTDB는 다운로드와 프로토콜/암호화 오버헤드를 과금하며, 기존 set도 서버→리스너 전달에서 증분 처리될 수 있다. 따라서 「다운로드나 청구48.5% 감소」로 쓰지 않는다. 특히 현재 주비용 후보인 Firestore 읽기 건수는 이 변경만으로 줄지 않는다.

품질을 지키려면 다음을 증명해야 한다.

- update는 결과 row를 완전하게 복원해야 한다. `database.rules.json`의 p,d,v,ph,t 필수 검증과 optional tSrv 검증을 실제 emulator에서 통과한다.
- 합류·재연결·onDisconnect 삭제 후에는 전체 상태를 복구한다. 로컬의 마지막 전송 cache만 믿고 서버에 없는 p/phase를 생략하면 안 된다.
- 두 개 in-flight, 실패/재시도, epoch 전환 중에도 잘못된 publication/phase를 남기지 않는다. 저장된 cache는 성공한 상태와 구분한다.
- 브라우저 개발용 WebSocket 데이터/RTDB 공식 metrics를 같은 조건으로 비교한다. 암호화 오버헤드가 빠지는 profiler만으로 비용을 확정하지 않는다.
- 최종 decoded row를 기존 전체 set과 표본마다 비교하고 새 송신 표본 시각·정밀도·기존 회귀가 모두 유지됨을 확인한다.

단순 문자열 압축이나 `tSrv` 정밀도 축소는 권고하지 않는다. 10cm 반올림으로 되돌리면 해결했던 비트 진동이 돌아올 수 있다.

## B. Firestore fanout의 근본 저감

RTDB가 정상이어도 FS4초 위치·속도·lastSeenAt가 모든 구독자에게 문서 변경으로 전달된다. 이 부분이 비용 구조상 우선 확인할 큰 후보다. 시각 품질을 유지하는 구조는 다음과 같다.

1. 변동이 적은 uid/publication/표시이름/접근권한 metadata는 별도 안정 경로로 제공한다. 위치 업데이트 때문에 metadata 구독 전체가 재과금되지 않게 한다.
2. RTDB 정상 motion의 표본은 현재와 동일하게 유지한다. peer 발견·이름표·라이더 수가 FS 위치 문서의 갱신에 의존하지 않게 한다.
3. FS fallback의 보유/구독 정책을 따로 설계한다. 정상시 구독을 끄고 장애후 다시 켜는 방법은 초기 조회 왕복지연과 재구독 읽기가 추가되므로 **품질 무손실이 이미 증명된 방법이 아니다**. 단순히 FS 구독을 없애지는 않는다.
4. FS heartbeat의 주기도 바꾸려면 stale15초·멤버 생존·목록·세계집계를 동시에 재설계한다. FS4→30/60초 상수변경은 허용하지 않는다.
5. Written 트리거의 update 호출은 위치 데이터와 활동 집계를 분리해야 제거할 수 있다. create/delete·publication 변경·중간 pulse/anchor를 누락하지 않는 저빈도 이벤트·idempotency·재처리가 필요하다.

이 구조 변경의 실제 절감률은 아직 미측정이다. 정상 화면을 그대로 유지할 가능성은 높지만 장애시 가용성·명단·목록 의미까지 자동으로 같아지지는 않는다. 설계·기능행렬·동일 타임라인 검증 후 Chief 결정 대상으로 올린다.

## C. 당장 하지 않을 최적화

- 상태가 정속이라는 이유만으로 업데이트를 길게 생략하지 않는다. 정지·가속을 못 받는 구간의 잘못된 예측이 커진다.
- 상대가 화면 밖이라는 이유로 모든 정보까지 끊지 않는다. 인접 경계의 선구독과 overlap, 먼 라이더 요약을 설계해야 한다.
- RTDB 전체 경로 onValue가 전체 로컬 snapshot을 준다는 이유로 매번 전체 노드가 네트워크로 온다고 계산하지 않는다.
- React 상태 갱신 감소는 CPU 절감이며 DB 읽기 감소와 다르다. 메인스레드 부하로 수신처리가 늦어지는 경우 품질 개선에는 도움이 될 수 있다.
- 모든 motion을 하나의 Firestore 문서에 묶는 안은 hot document·문서크기·쓰기율·대역폭·동시성 문제가 있어 현재 대안으로 권고하지 않는다.

## 실행 순서와 합격 기준

**1단계:** 이번 시각짝 수정 배포·배포 바이트 확인. 정상/정지/복귀 품질을 후속 실측하되 현재 Chief에게 추가 테스트를 요구하지 않는다.

**2단계:** 청구 귀속. 앱을 닫은 기준 구간→1인→2인→종료후를 분리한다. Console 데이터 뷰어·열린 창·메뉴 상태·완전 포함 시계분을 기록한다. reads/writes/Functions별 호출/RTDB다운로드/기기 CPU를 분리하고 라이더·시간당 원가로 정규화한다. 기존 phase-aligned 도구를 사용한다.

**3단계:** 같은5Hz 변경필드 update를 격리 시험한다. 실제 bytes가 유의미하게 줄고 모든 decoded row·표시 오차·위상/정지/복귀가 동일할 때만 채택한다. 효과가 작으면 더 큰 정적metadata 분리로 바로 확대하지 않고 FS 주비용부터 확인한다.

**4단계:** 확인된 주비용이 FS라면 안정metadata/위치/fallback/세계활동 역할분리 설계와 동등품질 증거를 만든다. 큰수신공백 문제를 비용 최적화에 섞어 합격 처리하지 않는다.

## 공식 근거와 검토 범위

- [Firestore 과금](https://firebase.google.com/docs/firestore/pricing): 구독 결과 문서의 추가/갱신, 재연결과 Rules 의존 읽기를 각각 고려한다.
- [RTDB 과금](https://firebase.google.com/docs/database/usage/billing): 다운로드·프로토콜·암호화 오버헤드 포함.
- [RTDB 최적화](https://firebase.google.com/docs/database/usage/optimize): 관측 후 리스너 범위와 쿼리 효율을 개선한다.
- [RTDB profiler](https://firebase.google.com/docs/database/usage/profile): broadcast 수는 실제수신자 수와 다를 수 있어 fanout 비용으로 바로 치환하지 않는다.

이번은 정적코드대조·공식문서확인·합성요청JSON바이트계산이다. 운영청구·실제wire bytes·emulator update원자성·최적화의품질동등성은 아직 시험하지 않았다. 후보의 운영구현·Rules/Functions배포는 이번 릴리스 범위에 포함하지 않는다.
