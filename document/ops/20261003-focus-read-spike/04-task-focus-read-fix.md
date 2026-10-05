> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# TASK-02 — 짧은 가시성 복귀 read burst 최소 수정 후보

| 항목 | 내용 |
|---|---|
| 담당 | Cursor CLI Developer |
| Supervisor | Codex |
| 상태 | READY_FOR_DEVELOPMENT |
| 결과 | `05-result-focus-read-fix.md` |
| 근거 | [03 감사 검수](03-review-focus-read-audit.md) |

## 목표

무주행 Trailhead에서 hidden→visible 직후 **중복된 단발 조회**를 줄인다. `App.tsx` 공개 Route 카탈로그 재조회와 Activity World immediate full sync를 우선 대상으로 한다. 순수 focus(visibility 유지)는 계속 추가 조회가 없어야 한다. 운영 약 600 billed read를 전부 해결했다고 주장하지 않는다.

## 구현 계약

1. 현재 코드의 성공 시각/캐시·poll interval을 확인해 **기존 주기 값을 재사용**한다. 짧은 숨김 후 복귀에 최근 성공 데이터가 있으면 동일 데이터 재사용과 남은 poll 스케줄로 복귀한다. 최초 로드, 캐시 없음, 마지막 성공이 stale, 오류 후 재시도, 명시적 새로고침은 실제 조회를 허용한다. 새 TTL 상수를 임의로 만들지 말고 기존 `ACTIVITY_WORLD_POLL_ACTIVE_MS`(60s) 등 정책 값과 이유를 문서화한다.
2. Catalog에서는 visible 전환에 따른 `listPublishedPublicCourses`/user-label getDoc 일괄 반복을 가드한다. 동시 refresh는 한 번으로 합치고, 명시적 UI refresh는 우회한다. 목록 표시와 오류 상태를 유지한다.
3. Activity World에서는 hide 동안 polling을 멈추되 최근 성공한 표시 상태를 보존한다. 빠른 복귀에서 즉시 full sync를 중복 실행하지 않고, stale 복귀에서는 한 번 재검증한다. live/post-ride active mode와 `refreshNonce` 명시 갱신을 깨지 않는다.
4. **현재 Trail live peer 구독, RTDB motion, 주행 중 전송 주기, Firestore 경로/Rules/CF trigger는 변경 금지.** openTrailListings/CG를 추가로 숨김 해제하지 않는다.
5. DEV 계측 또는 테스트에서 source별 catalog refresh/full sync 시작 횟수를 관찰한다. 기존 focus audit을 확장하거나 의미 있는 unit test를 추가해 first load=1, quick hide→visible=0 추가, stale resume=1, manual refresh=1, 오류 후 retry=1, focus-only=0을 고정한다. 측정은 client invocation이며 billed reads가 아님을 명시한다. 빈 emulator만으로 문서 수 절감률을 주장하지 않는다.

## 검증·보고

`npm run test:e2e:focus-read-audit`, 관련 Activity World/listener-scope 계약, 변경 파일 lint/typecheck를 실행한다. Playwright 5분 무진전 시 지시 01의 전환 규칙을 적용한다. before/after 동일 조건의 source invocation·underlying open/openTotal·기능 표시 결과를 표로 보고한다. `05-result-focus-read-fix.md`에 변경 파일·명령·PASS/FAIL/미실행·한계·Chief 병합 결정 항목을 기록한다.

## Git/운영

이 작업은 후보 구현이다. commit/push/merge main2/deploy/production write 금지. 기존 진단 파일과 ops 기록 보존. 요구 계약을 안전하게 만족시킬 수 없으면 불완전한 정책 변경 대신 BLOCKED 근거를 결과에 기록한다.
