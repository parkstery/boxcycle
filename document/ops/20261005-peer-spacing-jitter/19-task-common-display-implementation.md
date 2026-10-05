# 후속 구현 지시 — Chief 승인된 공통 600ms 표시

Codex Supervisor · 2026-10-05.

## 승인과 소유 범위

Chief 원문: **「내 라이더·상대·카메라를 공통 시각의 약 0.6초 과거로 표시하는 후속 구현을 승인한다.」**

이에 필요한 공통 표시 시계, 자기 표시 버퍼, 캡처 timestamp의 선택적 wire/interface 및 기존 권한을 보존한 엄격한 optional Rules validation을 구현한다. 앞서 제시한 A안의 필수 지원 범위이며 별도 기능 확장을 하지 않는다. 기존 `t` 의미를 바꾸지 않는다. 송신 횟수/주기 및 FS4초·FS 구독/read/write 불변. HUD 속도/거리·기록·Claim은 실제값 즉시 유지. solo 표시 지연0.

Cursor CLI가 제품 코드·시험·결과를 소유하고 Codex는 검수한다. 다른 작업자가 함께 있으므로 focus-read 등 타 작업 수정/새 파일을 되돌리거나 포함하지 않는다. 현재 `fix/peer-spacing-jitter`의 이전 수신 수정·게이트를 보존한다. 커밋/푸시/병합/배포는 이번 지시에서 하지 않는다.

## 읽고 적용할 정본

묶음 README, 18 검수, 15 검수, 14 정정, 12 계획의 정정된 골격, peer-sync SKILL/HARNESS, AGENTS 및 용어 문서. 06/09/12의 폐기된 문구를 베끼지 않는다. 14/18의 tie 오차합·stall·bytes·공통 D가 상대 간격을 벌리지 않는다는 정정이 우선한다. 과거 승인 대기는 이번 사용자 승인으로 해제한다.

## 구현 계약

1. 동행에서 self·peer·카메라 좌표는 동일 추정 서버 `commonNow−600ms` 시각을 소비한다. 창별 gap EMA로 D를 달리 정하지 않는다. 중앙에서 frame 시각을 만들어 공유한다. 실제 거리/속도/정복 판정에 표시 지연을 섞지 않는다.
2. SDK `.info/serverTimeOffset` 관측은 생명주기를 관리하고 중복 구독/누적 리스너를 만들지 않는다. 정확도 보장을 주장하지 않는다. offset 미준비/변화·재접속 때 버퍼 축을 섞어 snap/backtracking을 만들지 않는다. 일상 오차는 연속적으로 반영하고 큰 불연속의 버퍼 재기준 및 불확실 정책을 시험한다.
3. optional `tSrv`는 dist/speed **캡처 순간**의 추정 서버시각이다. encode/send에서 재샘플하지 않으며 큐 대기 중에도 같은 motion snapshot과 함께 간다. 기존 t 유지. 구 wire의 decode 호환, malformed/new-field validation과 실제 Rules 계약 시험 포함. FS schema 변경 없음.
4. 자신의 표시에도 상대가 받는 동일 canonical motion 표본/보간 계약을 사용해 속도 변화의 두 경로를 일치시킨다. 아직 송신되지 않은 빠른 local history와 성긴 peer 샘플을 섞어 일치라고 주장하지 않는다. 순수 시각 함수·bounded history를 사용하고 실제 capture/send path에 연결한다. local 화면 raw HUD는 즉시 유지.
5. RTDB 새 timestamp 경로에 수신 시각 재정규화를 다시 적용해 공통축을 망가뜨리지 않는다. 구버전·FS-only·offset 미준비는 기존 fallback과 liveness 계약을 보존하되 정확한 공통 표시로 취급하지 않는다. 혼합 버전도 자기/카메라 이동이 튀지 않도록 한다.
6. stall/표본 부족 시 bounded extrapolation·hold/liveness를 유지하며 독립 예측의 확신을 제한한다. 불확실 표시만 추가하고 실제 위치 오류가 해결됐다고 쓰지 않는다. 정상 상태의 창 간 일치와 공백 동안의 한계를 분리 보고한다. 과한 새 사용자 UI는 만들지 말고 기존 연결/이름표 처리와 결합한다.
7. peer 진입/이탈로 D0↔D600 바뀔 때 자기/카메라 순간 위치 점프가 발생하지 않도록 전환한다. 정상 동행에서는 고정600이며 전환 구간은 별도 계측/불확실 상태다. route 변경·정지·resume·finish도 bounded history를 초기화/관리한다.

## 시험과 시간

먼저 실제 제품 경로에서 self-now/peer-past 불일치 재현을 고정하고 구현 후 비교한다. 기존 이상화 MODEL만 PASS로 제출하지 않는다. 두 독립 registry/clock의 실제 새 모듈·encode/decode·capture 파이프라인을 재생하며 미래/미도착 패킷 사용 금지.

필수: 등속 작은/큰 간격, 대칭/비대칭 jitter, 가감속/추월, ±30초 기기 skew와 estimate 오차0/±50/±100, clock 준비/점프, queue capture 지연, late/out-of-order/중복, stall/FS-only/구버전, peer join/leave·solo0·정지/resume/route 전환. near-tie 포함/제외 순서, 창 간 간격 차이, 프레임 위치 jump와 속도 불연속을 원시 표본으로 수치화한다. tolerance를 임의 확장해 FAIL을 숨기지 않는다. 기존 수신 stamp 게이트와 motion/liveness/fallback, Rules, tsc/lint 적절한 회귀를 실행한다. 알려진 S3 static fixture 실패는 별도 표시한다.

송신/FS 주기 상수 diff없음, 같은 입력에서 publish 횟수 증분0 및 실제 제품 encode bytes(프레이밍/청구 제외)를 확인한다. `.info` metadata와 motion 메시지 비용을 구분한다.

오프라인 재생 우선. 각 재생 명령120초 상한. 전체 검증은 긴 실제 주행 없이 수행한다. 꼭 필요할 때만 최종 브라우저30~60초 관측·명령180초 hard timeout·단일 worker/headless/서버 재사용. 60초 유의미한 진전 없으면 중단/로그진단/대체경로, 동일 실패 재시도 최대1회. 테스트용 가상 시간을 실제로 기다리지 않는다.

## 결과

`20-result-common-display-implementation.md`에 실제 변경 파일과 동작, 명령/exit/경과시간, BEFORE/AFTER 증거, 실패·미실행·남은 한계, 트래픽 비용, 검수 포인트를 간결하게 작성한다. 원시 JSON을 묶음에 남긴다. README 결과/상태 IMPLEMENTED_PENDING_REVIEW와 PROGRESS 갱신. 결정 로그에 Chief600ms 승인 한 줄 최신 우선 append(관련 작업 중복행 삭제 금지). 검수에 필요한 구현/시험은 자율적으로 끝내고 완료 보고한다.
