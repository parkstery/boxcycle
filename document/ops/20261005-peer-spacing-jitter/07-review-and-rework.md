# REVIEW-02 / TASK-03 재작업

Supervisor Codex · Developer Cursor CLI · 2026-10-05.

## 검수 판정

수신 시간축 수정은 production 200ms에서 dual이 single 수준으로 회복되고, native 시간 보존·freeze 안정 stamp·인과 클램프가 실제 diff에 반영된 것을 확인했다. 기존 54 fallback·29 smoothness/liveness/motion·19 replay·eslint/tsc 통과 보고도 확인했다. **이 범위는 조건부 합격**이며 아래 자동 게이트 연결과 전환 검증이 필요하다.

06 계획은 **REWORK_REQUIRED**. 사용자 요구는 **같은 시각 양쪽 창의 위치와 주행 순서 일치**다. 창 안 자기/상대 지연 맞춤만 권고하고 창 간 일치를 후속으로 빼면 요구를 충족하지 않는다. 아직 Chief에게 계획 승인을 묻지 않는다.

## 재작업 범위 (코드 구현은 Cursor만)

### A. 재발 방어와 검증 증거

1. 현재 `scenarios.mjs` 변경은 주석뿐이며 `HARNESS.md`에 "필수 게이트"라고 적는 것으로 실행 게이트가 생기지 않는다. **실제 sync→Registry 회귀를 기존 자동 게이트에 연결**한다. 예: `package.json`에 `test:peer-spacing`(200ms 실제 두 소스 재생)을 추가하고 pre-push 기존 test:next-ride 또는 관련 게이트에서 호출한다. 새 테스트는 수정 전 production source로 되돌린 변이에서 실제 FAIL/exit1인지 확인한 뒤 복원한다. 일시 원복은 자신의 해당 코드만 백업·복원하고 다른 변경을 건드리지 않는다. 3000ms policyConflict는 성공이라고 부르지 않는다.
2. 본 수정의 **RTDB-only↔dual↔FS-only 전환**과 ±30s/no-seq 조건을 실제 sync 경로에서 결정적 시험으로 남긴다. 54 fallback은 pre-freeze부터 두 소스가 있는 행렬이므로 single/dual 상태 변화를 대신하지 못한다. 실패하면 최소 내부 수정으로 재작업하고 보고한다.
3. 1초 간격의 pp 게이트 제외는 이유를 명시하라. 기존 보고의 pp 6.71m를 "안정 간격"으로 승인하지 않는다. 12s~40s에 걸쳐 적응 지연이 아직 움직이는지 수치로 확인하고 충분한 수렴 이후 구간/수렴 시간/시작 구간을 모두 보고한다. 알고리즘을 바꾸어 이 문제까지 해결해야 한다면 별도 제안으로 남긴다. 수렴 구간에서 반복 진동이 남는 경우도 밝힌다.
4. PRE/POST의 fixture와 측정 구간이 달라 현재 표는 완전한 전후 비교가 아니다. **같은 최종 하네스·같은 fixture·같은 구간**으로 수정 전후 200ms sin/bundle을 비교해 표를 다시 만든다. 기존 수치는 보존한다. 원시 증거를 작업 묶음에 남기되 거대한 타임라인은 gitignore 출력에 둔다.

### B. 두 창 재생 (제품 표시 정책 미변경)

1. 실제 sync→Registry/integrator를 이용한 **독립 두 뷰** 재생기를 작성한다(두 독립 Vite module graph 또는 상태 reset/별도 인스턴스 주입으로 singleton 충돌 회피). 양쪽 self 현재거리·peer 표시거리·진실거리를 uid로 정렬한다. 등속·초기 간격·추월·속도변경(20→30→10km/h)·비대칭 지연/지터·±30s 기기시계·한쪽 stall을 포함한다.
2. 매 같은 실제 시각 양쪽에서 계산한 `A−B`의 부호가 다른 프레임 수와 거리차, 각 속도변경이 자기/상대에게 보이는 지연을 **실행 수치**로 남긴다. 같은 delay여도 진실 간격이 delay×speed보다 작으면 현행에서 양쪽 "내가 앞"이 가능하다. `D_A≠D_B일 때만 역순`이라는 06 설명을 바로잡는다. 색/카메라 좌우가 아니라 uid·거리 기준.
3. 비교안은 **같은 절대 재생 시각에 A와 B 모두 렌더**하는 모델을 오프라인 비교한다. self만 local peer delay만큼 늦추는 것으로 창 간 일치를 주장하지 않는다. 제품 코드는 승인 전 미변경.

### C. 승인 가능한 계획

06 원본은 보존하고 `09-plan-common-timeline.md` 새 계획을 쓴다. 권고안을 하나로 좁혀 사용자 요구를 충족할 구조를 제시한다:

- 송신 좌표가 잡힌 시각을 공통 시계 축으로 매핑하는 방법. 현재 RTDB t는 sender Date.now, FS lastSeenAt은 commit time이며 **snapshot capture time과 같지 않다**. 1회 RTT/2를 "정확한 공통 시각"이라고 보장하지 않는다. Firebase `.info/serverTimeOffset` 등 후보는 실제 SDK/공식 문서로 확인하고 오차·갱신·접속/복구 처리까지 정한다.
- self와 peer, 카메라가 **동일한 server-relative renderTime = commonNow−D**을 사용하는 설계. raw ride distance/speed/HUD/Claim은 즉시 실제값 유지.
- D를 두 창이 각각 EMA로 고르면 같은 시점이 아니다. 공통 지연 정책과 지원하는 송신 간격(현재200ms)·지터 예산을 제시한다. 300ms가 gap×2.2≈440ms보다 짧다는 충돌을 해결하라. 1초 송신에서 300/500ms로 항상 보간된다고 주장하지 않는다.
- wire/API/경계/Rules 변경 여부, 터치 파일, 예상 추가 트래픽(시계 관측 vs motion 송신), 단계별 변경 범위와 회귀 기준. 기존 t의 의미를 바꾸는 것도 명시적 승인 항목.
- stall/미도착 가속에서는 어떤 방법도 "현재 진실"을 확정 못 한다. hold/가시성/순서 불확실성 처리와 허용 오차·거의 같은 위치의 tie 범위를 구체화한다. UI 기능 추가는 계획만.

## 실행/보고

git commit/push/merge/배포 금지. 공용 표시/네트워크 구조 변경은 계획만. A의 로컬 내부 수정과 테스트·게이트는 승인됨. 결과 `08-result-rework.md`, 승인용 새 계획 `09-plan-common-timeline.md`. 이전 보고 덮어쓰기 금지. 명령·exit code·미실행을 구분하고 full PASS와 한정된 PASS를 구분한다.
