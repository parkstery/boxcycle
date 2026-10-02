# TASK-03 — 2차 트래픽 후속 측정 작업을 main2에 병합

| 항목 | 내용 |
|---|---|
| 담당 | Cursor CLI Developer |
| Supervisor | Codex |
| Chief 승인 | 2026-10-03 대화에서 **2차 트래픽 저감 후속 작업의 main2 병합 명시 승인** |
| 결과 | 병합 후 `document/ops/20261002-public-trail-traffic-followup/11-result-merge-main2.md` |

## 대상·환경

- Source: `codex/public-trail-traffic-followup` @ `C:\Users\kdrea\.codex\worktrees\public-trail-traffic-followup\boxcycle` (현재 HEAD `68f0f11`, 후속 docs+계측 도구 미커밋).
- Target: `main2` @ `C:\20.HDev\boxcycle` (시작 HEAD `2cdaea6`, 시작 시 clean 확인).
- 이전 01–09 기록과 [09 검수 PASS](09-review-phase-aligned-measurement-rework.md)를 읽는다. 개발 워크플로 문서의 Git 원칙을 따른다.

## 수행

1. 양쪽 `git status`, HEAD, merge-base, source→target diff를 확인한다. 대상이 dirty거나 source에 지시 범위 밖 변경이 있으면 중단·보고한다.
2. source의 감사/검수/측정 도구·테스트·fixture·package script 및 ops 상태 문서만 명시적으로 stage한다. 다른 작업 파일은 건드리지 않는다.
3. `cd apps/web && npm run test:traffic-meters`와 `git diff --check` 재확인. 가능한 경우 변경 JS/TS/MJS lint/typecheck를 수행한다. 의존성 부재 시 정상 경로로 설치/복구를 시도하고 결과를 보고한다. Git hook을 `--no-verify`로 우회하지 않는다.
4. source에 의미 단위로 commit한 뒤 `main2`에 병합한다. fast-forward 가능하면 fast-forward를 사용한다. 충돌 시 독단적 대량 해결 없이 보고한다.
5. target HEAD/상태/파일 목록과 테스트 결과를 `11-result-merge-main2.md`에 기록하고 이 결과 문서도 별도 commit한다. `main2`와 source 이외 다른 branch/worktree 변경 금지.

## 금지

- push, PR, production deploy/write, Firebase 설정·트리거·전송 주기 변경.
- `main` 병합, force, amend, hook 우회, 무관 변경 포함.
- 첨부 성능 보고의 절감률을 billed 확정으로 승격하지 말 것. 측정 도구 준비와 실제 운영 1v2 계측 Ø는 그대로다.

## 완료 조건

main2가 후속 계측 도구·ops 기록을 포함하고 clean이며, QA 명령의 통과/실패/미실행이 정확히 기록된다. 병합 SHA·commit 목록·검증 출력을 결과에 적는다.
