# Supervisor 최종 검수 — 수신 결함 APPROVED / 표시 정책 AWAITING_CHIEF

Codex · 2026-10-05. 구현·시험 작성·실행은 Cursor CLI가 수행했고, Codex는 지시·실제 diff·검증 근거·모델을 검수했다.

## 판정

**수신 시간축 결함 수정 APPROVED(로컬).** 공통 표시 정책은 **아직 미구현**, Chief 승인 대기. 브랜치 `fix/peer-spacing-jitter`; commit/push/merge/배포 없음. 캡처 당시 운영 패킷·선택 채널은 미계측이므로 사진의 모든 거리차가 본 결함에서 발생했다고 확정하지 않는다.

## 확인한 원인과 실제 수정

1. 두 채널 수신 경로가 송신 시각을 패킷 도착 시각으로 매번 덮어써, 네트워크 지터를 화면 속도 지터로 바꿨다. 같은 source의 native 시간 증가량을 고정 offset으로 보존하고 소스 전환·최초만 기준축을 맞춘다. 미래 stamp 인과 clamp와 frozen 재배달의 15초 소멸을 보존했다.
2. 단일 수신은 원본축, 이중 수신은 정규화축을 사용하는 혼용이 전환 시 다른 결함을 만들었다. 모든 선택 패킷을 동일 정규화 경로로 처리하고 단일 source 상태에서도 stamp 관측을 유지하도록 수정했다.
3. `githooks/pre-push`가 실제 `test:peer-spacing`을 실행한다. 변이 시험에서 결함을 되넣으면 gate exit 1(requiredFail=8), 복원하면 exit 0이다. 단순 문서상 게이트가 아니다.

현재 송신 주기·wire payload·Rules·HUD·자기 라이더/카메라 표시 정책은 변경하지 않았다.

## 검증 근거

- 최종 [11 결과](11-result-unified-axis.md): 타입/lint, 계약 338 PASS(4 todo), smoothness/liveness/motion 29, source-select 8, fallback 54, replay 19 PASS. 전환 7/7 및 실제 수신 gate PASS.
- 같은 fixture·같은 구간 PRE/POST([08](08-result-rework.md)): 200ms sin 간격 pp 0.617→0.259m, bundle 0.763→0.019m. 안정화 이전 구간은 별도 기록했다.
- **실패 보존**: `test:peer-s3a-replay` 전체 exit 1. 기존 정적 S3 로그의 `d1-target-vs-applied` 항목(rel≈0.35)이 실패한다. fixture 게이트가 고정 JSON을 읽으며 이번 stamp 변경을 실행하지 않음을 코드에서 확인했다. 이번 범위에서 수정하거나 성공으로 보고하지 않는다.
- 1초 주기는 재생 지연 약2.2초로 수렴하는 동안 간격이 변하며, 3초 주기는 RTDB stale 2.5초와 충돌한다. 임의 상수/송신 빈도 조정으로 감추지 않았다.

## 두 창 순서 불일치와 승인안

현행 self 즉시 / peer 과거 구조는 진실 간격 1m의 등속 두 창 재생에서 양쪽 모두 "내가 앞"(1800/1800)을 만들었다. 수신 결함만 고쳐도 이 구조적 비대칭은 남는다.

**권고:** self·peer·카메라를 추정 서버 공통 시각의 **고정 600ms 과거 시점**으로 표시. 실제 속도·거리·Claim/HUD는 즉시 유지. 좌표/속도를 샘플한 순간의 선택적 `tSrv`를 추가하고 기존 `t`는 유지한다. 클라이언트 공용 타입·RTDB validation·표시 의미 변경이므로 [AGENTS.md](../../../AGENTS.md)의 구현 전 Chief 승인 대상이다. 현재200ms 송신 빈도는 유지한다.

승인 범위는 위 표시 정책, 캡처 timestamp/시계 관측, 필요한 optional interface·엄격한 Rules validation 추가까지다. Firestore 주기·송신 빈도 변경·경쟁 기능 확장은 포함하지 않는다. 혼자 달릴 때는 표시 지연0.

**계획 정본은 [12](12-plan-common-timeline-final.md)의 골격에 [14](14-result-model-and-final-plan.md)의 정정을 적용한 내용**이다. 06/09와 12의 정정된 문구는 역사 기록이며 그대로 구현하지 않는다.

- [14 모델](14-result-model-and-final-plan.md)을 직접 검수했다. 수신 이벤트가 도착한 뒤의 표본만 peer 버퍼에 넣고, self도 이미 캡처한 표본만 사용한다. D=600, 두 시계 오차0/±50/±100ms 행렬은 **제품 wire 구현이 아닌 비교 모델**이다.
- 정상 조건에서 서로 반대 순서를 그리는 현상은 해소되지만 near-tie는 불확실하다. +100/−100ms에서 진실 대비 간격 오차가 약1.11m이고, 양쪽 오차 합을 적용한 tie 예산은 20km/h에서 약1.39m이다. SDK offset이 ±100ms 이내라는 보장은 없다.
- stall에서는 모델도 반대 순서 약8%가 남는다. 신호 공백·FS-only/캡처 시각 불명·clock 미준비 상태는 신뢰 가능한 현재 위치/순서로 단정하지 않는 설계가 필요하다.
- 공통 D는 양쪽 모두 늦추므로 **상대 간격을 D×v만큼 벌리지 않는다**. 1초 송신을 지원해 D≈2.2초로 늘릴 경우의 비용은 자기 화면 반응 지연이다. 향후 빈도 절감 결정은 별도 승인.
- `tSrv` 추가는 약20~25 raw bytes/update, 5Hz에서 약0.36~0.45MB/hour/rider(프레이밍·압축·fanout 제외) 예상. 송신 횟수·FS read/write 증분은 없음. 구현 시 실제 encode/운영 계측 필요.

## 승인 후 다음 지시의 완료 조건

같은 source·capture timestamp로 자기/상대/카메라를 렌더하고, 공유 표시 시각을 창별 EMA로 갈라놓지 않는다. 정상/비대칭 지연·가감속·초기 진입·재연결·clock 오차·근접 간격·stall 및 구버전/FS-only를 실제 제품 경로로 검증한다. 운영 두 창에서 선택 source·도착 간격·표시 시각·uid별 경로 거리를 함께 계측해 캡처의 큰 거리차 원인과 개선을 확인한다. 기존 core 게이트 보존, solo 지연0, 송신 횟수/실제 bytes 비교, Chief 육안 확인을 포함한다.

현재는 **Chief의 표시 정책 승인에 필요한 결과와 구체 계획이 준비된 상태**다. 다른 작업의 새 untracked 파일은 이 묶음에 포함하지 않았으며 건드리지 않는다.
