# 초기 미추적 후보 정리 결과

2026-10-06 · 실행자 Codex. [25 지시](25-task-retire-untracked.md). Cursor CLI·하위 에이전트 미사용: 이미 조사된 11개 파일의 분류/보관으로 추가 인계 비용을 줄였다.

초기 코드·시험 5개를 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)의 경로에 .txt로 이동했다. SHA256 대조 5/5 일치. 앱 src/scripts/e2e에서 빠져 구조·타입·시험 탐색을 방해하지 않는다. 초기 ops 6개는 원래 경로/본문을 유지하고 대체 안내를 추가해 Git 추적 대상으로 삼았다. 초기 시험의 정책 조건은 현행 resume-cache-policy 시험과 대조했으며 최종 정책에 반하는 초기 60초 TTL·옛 식별자 배선 시험은 이식하지 않았다.

| 검증 명령 | 결과 |
|---|---|
| `node scripts/check-dep-direction.mjs --check` | PASS exit 0 — 임시 park 불필요 |
| `node scripts/check-document-system.mjs` | PASS exit 0, 현재 링크/구조 오류 0 |
| `node scripts/check-document-system.mjs --all --baseline document/ops/20261006-calories-resume/.out/cleanup-link-baseline.json` | exit 1: 과거 누락 23건 유지, 새 오류 0. 전체 PASS로 보고하지 않음 |
| `npm --prefix apps/web run test:focus-read-spike --silent` | PASS 37/37 |

제품 코드·최종 시험·기능 의미·stash 수정 없음. 원격 push·배포·브라우저/Firebase e2e 미실행: 보관/문서 정리 범위이며 제품 변경 없음. 문서 지시·결과·검수와 보관 파일만 정리 전용 로컬 커밋으로 남긴다. 전체 작업 APPROVED 상태와 Chief 사용 확인 한계는 유지한다.
