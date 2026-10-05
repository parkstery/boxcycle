# TASK-04 단일/이중 수신 시간축 통일

Supervisor Codex · Developer Cursor CLI. 2026-10-05. 사용자 지시에 따라 구현은 Cursor만 수행한다.

## 최신 검수 (08 결과 수신 후)

08 결과와 실제 diff에서 아래 확정 구현 계획 1~3은 **이미 구현됨**을 확인했다. 재구현하지 않는다. 08의 A2 최소 수정은 이 지시의 목표와 같다. 이 실행은 **최종 검증과 계획 보완만** 수행한다.

- 08 검증 일람에서 마지막 적용 범위 확대 후 replay/smoothness/liveness/motion/eslint/tsc를 미실행했다고 밝혔다. 이들을 **최종 코드로 재실행**하고 결과를 `11-result-unified-axis.md`에 기록한다. 기존 gate/전환/fallback의 유효한 결과는 불필요하게 반복하지 않아도 된다. 변경된 mjs의 문법/의미 검증, `git diff --check`, 관련 전체 계약 스위트 `npm run test:next-ride`도 현재 범위에 적합하게 실행하고 실패/미실행을 숨기지 않는다.
- 09 §4는 local gap EMA 440~500ms를 양쪽이 독립 선택하도록 권고하여 여전히 **서로 다른 renderTime**을 만든다. Supervisor는 이를 승인하지 않는다. `12-plan-common-timeline-final.md`를 새로 작성해 **1차 공통 고정 지연 D=600ms**(현재200ms 송신에서 오프라인 예산 후보)로 정정하라. 각 창 별도 적응형 D는 이번 승인안에서 제외한다. 600ms 자체도 실제 jitter/시계 오차 행렬로 검증할 목표이지 무조건 안전한 값은 아니다. 제품 적용/상수 변경은 승인 전 금지.
- `tSrv`는 **좌표/속도를 샘플링한 순간의 시각**이어야 한다. encode/write 시점 Date.now를 capture time으로 부르는 오류를 계획에서 제거한다. 큐 대기·in-flight 지연이 생겨도 `(tSrv, dist, speed)`가 한 스냅샷이어야 한다. 기존 t는 유지하는 선택적 field, Rules/interface 승인 범위를 적는다.
- `.info/serverTimeOffset`를 공식 Firebase 문서/설치 SDK로 검증하고 정확한 지원 링크를 기록한다. 09의 "수~수십ms"를 보장하는 근거가 없으면 삭제한다. SDK 시계 보정은 **추정**이며 불확실성/오차를 측정하는 게이트를 포함한다. 서버 공통 축 모델의 이상화 0 mismatch와 실제 기기 offset 오차를 넣은 측정은 별도로 구분한다.
- 두 창 비교에 **고정600ms + clock estimate error ±50/±100ms**를 추가(모델만). 지연 대칭/비대칭·속도변경·near-tie·stall. 모델이 실제 wire timestamp 구현을 검증한 것처럼 보고하지 않는다. 순서 tie 범위는 오차+속도에 맞춰 계산한다(정확한 동시·무오차 위치를 보장하지 않는다). 미도착/가속/FS-only stale를 정상 신뢰 가능한 상태로 보지 않는 계획.
- 1초/3초는 지원 범위 밖이라고 명시하는 것으로 사용자의 트래픽 우려를 끝내지 않는다. 현재200ms와 **1초 송신 지원 시 필요한 공통 D≈2.2초 이상 및 stale/외삽 정책 변경**의 비용/자기 반응 지연을 표로 비교하되, 이번 수정에서 송신 주기는 유지. Chief는 표시 정책/지연과 향후 빈도 변경을 구분해 승인할 수 있어야 한다.

11 결과 + 12 계획 작성 후 종료. commit/push/merge/배포 금지. 코드 추가 수정은 검증에서 이번 변경의 결함이 발견된 때만 최소 범위로 수행한다. 토큰 절약을 위해 이미 확인한 대규모 파일을 반복 읽거나 불필요한 검증을 반복하지 않는다.

## 범위 판정

두 창 재생의 `AXIS-RAW-TO-STAMPED` 발견을 확인했다. 단일 source는 raw sender/FS 시각, dual은 receiver-normalized 시각이라는 **같은 버퍼 안 시계축 혼용**이다. 정상 dual 등속 PASS만으로 최종 승인할 수 없다. 내부 정규화의 일관성 복구는 TASK-02 승인 범위 안이며 wire/API/Rules/표시 정책 변경이 아니다. 이번 지시에서 known-fail로 두지 않는다.

## 확정 구현 계획

1. `syncPeerMotionFromPresence`가 Registry로 넘기는 **모든 선택 패킷**(RTDB-only, dual, FS-only)에 동일 `stampDualSourceIngestPacket` 정규화 경로를 적용한다. 기존 함수 시그니처는 유지한다. 이름/주석은 historical dual naming과 현재 all-source 적용을 설명하면 된다. 신규 공용 타입/필드는 불필요.
2. 한 source만 존재한다고 stamp 상태를 지우지 않는다. 기존 `if (rtdbPacket == null || fsPacket == null) dualIngestStampByUid.delete(uid)` 때문에 기준축이 리셋되는 경로를 제거/수정한다. 관측 reset은 기존 세션 reset 계약을 유지한다.
3. 동일 source native Δt, 최초/소스 전환 시 정렬, 인과 clamp, frozen 재배달·같은 자세 source 전환 liveness stamp 유지 규칙을 모두 보존한다. RTDB 내용 신선도 선택과 송신 주기·외삽 상수는 그대로다.
4. 같은 입력의 raw→normalized 전환 결함을 **수정 전 FAIL / 후 PASS**로 고정한다. 08 결과에서 발견한 AXIS 결함의 known-fail/expectFail을 남기지 않는다. 테스트 미래좌표/반올림 계측 오류를 만들지 않는다.

## 검증·완료 조건

- ±30s/0 및 seq 없는 production 입력에서 RTDB-only→dual→FS-only→dual, frozen/cleared 회귀. 전환 순간 포함 0.5m 초과 역행·부당 순간이동 금지. 초기 최초 출현은 별도 표시(있던 entity 전환과 구분).
- `test:peer-spacing`, mutation failcheck, 기존 fallback 54 전체, replay 19, smoothness/liveness/motion/source-select, 두 창 하네스, 변경 TS eslint 및 tsc 통과. **pre-push에서 실제 peer-spacing 실행** 연결 확인(명령만 package에 추가하면 자동 실행되지 않는다). 정상+변이 결과를 근거로 기록.
- 1초 수렴/3초 정책 충돌 및 표시에 필요한 공통 시간축 계획은 별도 한계로 유지. 200ms 정상 간격 pp가 이전보다 악화되면 재작업.

## Git·결과

동일 브랜치에서 다른 변경을 되돌리지 않는다. commit/push/merge/배포 금지. 카메라/self 지연/common wire 시각은 아직 계획만. 보고 `11-result-unified-axis.md`. 기존 08/09 기록을 덮어쓰지 않는다. Supervisor가 11 결과와 실제 diff를 검수하고 Chief에게 승인용 표시 계획을 제시한다.
