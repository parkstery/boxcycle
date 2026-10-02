# TASK-05 — 최종 감사·브랜치 커밋

Owner: Cursor CLI Developer. Supervisor: Codex. [15 검수](15-review-listener-grace.md)를 읽고 수행하라.

## 작업

1. 현재 전체 diff를 TASK-01~04 범위와 대조한다. 제품 변경은 계측, catalog TTL/in-flight, Activity World fresh-resume, listener grace, presence resume throttle로 한정돼야 한다.
2. generated `.out`, emulator data, 로그, 비밀값이 stage에 포함되지 않게 확인한다.
3. 최종 검증:
   - `apps/web`: `npm run test:focus-read-spike`, `npm run test:s42-meters`, `npm run test:listener-scope`, `npm run build`.
   - repo root: `npm run check:dep`, `git diff --check`.
   - changed-file lint. E2E는 14에서 2/2 PASS한 동일 diff라면 재실행 생략 가능하되 근거를 적는다. 코드가 바뀌면 포트 5015로 재실행한다.
4. `codex/focus-read-spike` 브랜치가 현재 base와 같은 포인터인지 확인하고, 안전하면 그 브랜치로 전환해 scoped 변경만 commit한다. 다른 변경이 있으면 중단·보고한다.
5. 커밋 메시지는 의미를 드러내는 `fix(firestore): reduce foreground resume read spikes`를 사용한다. `--no-verify`, amend, force 금지.
6. 결과를 `17-result-final-audit-commit.md`에 작성하고 그 결과 문서·상태판까지 별도 docs commit으로 남긴다. 각 commit SHA와 파일 범위, 검증을 기록한다.

push, merge to `main2`, deploy, production Firebase 접속은 금지한다.
