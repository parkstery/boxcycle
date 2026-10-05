# 칼로리·단일 이어달리기 검수

2026-10-06 · Codex Supervisor · **APPROVED — 코드·자동 시험 범위**. Cursor CLI 조사·구현·보완 결과와 실제 diff를 대조했다. 커밋·push·배포는 하지 않았다.

## 결과

- 신규 칼로리는 `MET × 체중kg × 실제 페달링초/3600`의 gross 추정치다. 가벼움/보통/강함은 4/6/8 MET. 체중·강도 또는 센서 신호가 없으면 null/「—」, 유효 신호의 RPM0은 0. 가상거리·재개 offset을 계산하지 않는다. 70kg·6MET·30분 = 210kcal.
- 세션 시작 설정을 고정하고 pause는 제외한다. 활동초는 실제 elapsed 이하로 제한한다. 신규 기록에 방법·강도·활동초·누락 여부를 남기며 개인 체중은 UID별 로컬 설정에 보관한다. 과거 거리환산 숫자는 유지하고 미산정 기록은 통계에서 구분한다.
- 이어달리기 대상은 사용자별 최대 1개다. A 미완주 뒤 B 주행·카드 닫기는 A를 제거하지 않는다. B는 처음부터 시작한다. 명시적 종료·완주·삭제·실제 무효에만 해제한다. 활성 A는 TTL 만료를 막으며 명시적 종료 시 미완주 TTL을 90일로 복원한다.
- 실제 progress 저장 성공 이벤트를 결과창 state와 분리했다. 결과창을 먼저 닫아도 획득하며 UID가 다른 지연 응답은 무시한다. 서버 트랜잭션 및 Guest Web Locks로 단일 슬롯을 처리한다. 대기 이벤트는 FIFO, 재시도는 제한한다.

Supervisor 최종 보완: 센서 연결 전 구간도 이후 부분 산정 표시, 칼로리 ref 의존성 누락 보완, 작은 종료 동작의 문구를 「이어달리기 종료」로 명확히 했다. 13·17 결과의 해당 설명은 이 보완이 우선한다.

## 검증 근거

`apps/web`에서 다음을 직접 실행했다.

- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-calories/calories-estimate-contract.test.ts scripts/ride-stats/ride-stats-aggregate-contract.test.ts` — 26 pass.
- 동일 runner로 `scripts/next-ride/result-independent-resume.test.ts`, `ride-resume-slot-policy.test.ts`, `next-ride-target-contract.test.ts`, `scripts/ride-result/ride-result-f2-card-resume.test.ts`, `ride-result-n2-persistence.test.ts` — 99 pass. 실패 주입 시험의 console error는 예상 경로이며 시험 실패가 아니다.
- `npx tsc -b --pretty false` — pass. 칼로리·재개 변경 TS/TSX 전체 `npx eslint … --quiet` — 오류 0. 기존/의도적 exhaustive-deps 경고는 별도이며 전체 lint 무경고를 주장하지 않는다.
- 설정 fixture 740×300/640×300 및 재개 카드 740×300 캡처 검토. 종료 문구 보완 후 `node scripts/next-ride/capture-resume-slot-ui-fixture.mjs` 재실행 pass.
- Cursor 추가 검증: 결과 UI 관련 40 pass, entry selectors 15 pass, continue-progress 4 pass. [13 결과](13-result-calorie-review-fixes.md) · [17 결과](17-result-result-independent-resume.md).
- 저장소 현재 문서 링크 검사와 `git -c core.safecrlf=false diff --check` — pass.

## 범위와 한계

- 실제 Firebase 저장·TTL 운영, 실제 두 탭/두 브라우저 동시 주행, 전체 App 마운트/e2e는 미실행. controlled Promise·fake transaction·mock Web Locks·실제 컴포넌트 fixture로 검증했다. Guest Web Locks 미지원 환경은 단일 탭만 보장한다. Guest 기존 savedRoutes 로컬 저장소의 계정 소유 분리는 이번에 변경하지 않았다.
- 칼로리는 사용자가 선택한 강도에 따른 추정이다. 케이던스로 실제 출력 강도를 측정하지 않는다. 센서 stall은 기존 2.5초 후 RPM0 정책을 쓰므로 패킷 지연 경계에 오차가 있다. 1초 활동 타이머·정수 kcal에도 반올림 오차가 있다.
- 정책·도입 시 복원·완주 98%·기록 100m/5초 조건은 [조건 조사](06-conditions-and-findings.md)와 [설계 §9.5.6](../../reference/architecture/260703-Conquest-정복-레이어-설계.md#956-단일-이어달리기-유지-2026-10-06)에 반영했다. 다음은 Chief 사용 확인이며 별도 배포는 미실시다.
