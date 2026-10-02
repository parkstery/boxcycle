# TASK-02 — 배포 후 1명/2명 운영 트래픽의 구간 정렬 계측 준비

| 항목 | 내용 |
|---|---|
| 담당 | Cursor CLI Developer |
| Supervisor | Codex |
| 상태 | READY_FOR_DEVELOPMENT |
| 결과 | 같은 폴더 `05-result-phase-aligned-measurement.md` |
| Chief 승인 | 2026-10-02 대화에서 **테스트·코드 변경 승인**. 배포·트리거·전송 주기 변경 승인은 이 지시의 범위가 아님 |

## 목표

[TASK-01 결과](02-result-remaining-opportunity-audit.md)와 [검수](03-review-remaining-opportunity-audit.md)의 F를 진행한다. 배포 후 production의 1명/2명 Firestore read/write 및 가능하면 CF/RTDB 관측을 **시계분과 주행 phase가 맞는 구간**으로 귀속할 수 있도록 최소 측정 도구·테스트·절차를 만들고, 현재 확보 가능한 증거만 보고한다. 이번 TASK의 완료는 "도구와 절차 검증"이다. 실제 phase 기록이 없는 기존 Chief 숫자에 정식 귀속·billed 판정을 부여하지 않는다.

## 시작·필수 읽기

1. `git status --short`, `git rev-parse HEAD`, 현재 branch 기록. 기존 감사/검수/상태 문서의 미커밋 변경은 보존한다.
2. 이 묶음 `README.md`, `00-handoff.md`, `01-task-…`, `02-result-…`, `03-review-…`.
3. `document/archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md` Part A 및 Part B §1·§4·§7·§8.1; 이전 `08-review-measurement.md`.
4. `apps/web/scripts/traffic/*`, `apps/web/e2e/public-trail-traffic-1-2.spec.ts`, 관련 npm scripts와 실제 phase JSONL을 확인.

## 허용·구현 범위

- **측정 전용 로컬 도구와 그 의미 있는 테스트**, 측정 절차 문서, 결과 문서. 기존 도구 재사용이 더 단순하면 새 코드를 만들지 않아도 된다.
- 측정 도구는 ISO 시간의 rider phase(start/steady/end)와 minute bin을 입력으로 받아, **완전히 포함된 시계분 bin만** 1명/2명별로 비교한다. 부분 겹침의 트래픽을 선형 배분하지 않는다. 서로 다른 배포 상태·날짜·창 길이를 한 효과 추정치로 합치지 않는다. 입력 부족·교차·누락 시 `insufficient`/미측정으로 종료한다.
- 정량 출력은 원본 count, bin 길이/개수, 단위시간 rate, 1명/2명 방향성 비교, quiet baseline을 **각각** 보여야 한다. Firestore console/Cloud Monitoring 값과 emulator client meter, Chief L 관측의 증거 클래스를 구분한다. billed 비용으로 자동 승격하지 않는다.
- 가능하면 현재 환경에서 **읽기 전용** production metric 소스의 접근 가능 여부와 세분성을 확인한다. 인증값·토큰·비밀·개인 데이터는 출력/문서화하지 않는다. 권한이나 phase 로그가 없으면 억지로 대체 수치를 만들지 말고 Ø로 보고한다.
- 선택한 도구의 단위 테스트, 기존 traffic meter 단위 게이트, 변경 파일 lint/typecheck 등 필요한 검증을 수행하고 명령·결과를 기록한다.

## 금지

- production에 실주행/게스트 생성/쓰기·삭제를 일으키는 자동 측정, deploy, commit, push.
- 제품 런타임의 Firestore/RTDB 전송·구독·트리거·Rules·schema·주기 변경. A/B/D 최적화 구현.
- 3명 이상 비교 범위 확대. 사전/사후 production Chief L 숫자를 phase 근거 없이 인과 절감률 또는 billed 비용으로 확정.
- 기존 감사 결과·검수 문서·다른 worktree 수정. 무관 변경 revert.

## 완료 조건·보고

`05-result-phase-aligned-measurement.md`에 변경 파일, 사용법/입력 계약, 테스트 명령과 pass/fail, 실제 읽기 전용 metric 접근 결과(가능/불가 및 이유), 확보한 정렬 창/없는 창, 1명/2명 비교가 가능한지, 한계 및 다음에 필요한 Chief 제공 입력을 적는다. 코드·테스트 diff가 범위를 지키는지 Supervisor가 검수한다. production billed 결과가 없으면 **Ø**로 유지한다.
