# 승인된 변경 커밋·main2 병합 (원격 push는 보류)

Chief 2026-10-06 「로컬, 원격에 push, merge 진행해」 요청. Cursor CLI 담당. Codex는 Supervisor 검수. **자동 승인 검토가 원격 목적지·payload 승인이 불명확하다는 이유로 실행을 거절했다. 이번 실행은 로컬 커밋·main2 병합·시험만 허용하며 원격 push를 절대 수행하지 않는다.** 별도 검증/승인 후 후속 지시로 처리한다. 토큰 절약: 필요한 diff와 ops 결과만 조사하고 전체 소스/로그 덤프 금지. 결과 20-result-integrate-push.md에 정확한 SHA·브랜치·검증·잔여 dirty 기록.

## 범위

현재 codex/document-system HEAD f093c15. main/main2 및 원격 추적도 조사 당시 f093c15. 이번 대화 완료 작업: 문서 체계 정리(20261005-document-system), 제품 가치/이름/칼로리 조사 문서(20261005-product-value-name-calories), 맵 버튼·카메라 고도(20261005-ride-map-controls), 내 경로 가독성(20261006-saved-route-readability), 칼로리·단일 재개 슬롯(본 묶음18 검수). 각각 최신 검수와 지시의 파일 소유 범위를 따른다.

현재 workspace에 다른 작업 변경이 다수 있다. 전체 git add -A 금지. auth GuestEntryCard·conquest·functions·storage policy·activity/debug/focus-read 신규 구현 등 다른 작업은 이번 커밋에서 제외하고 그대로 보존한다. App.tsx/MapView/MapHud/dep-layers 등 공유 파일은 diff hunk를 대조하여 이번 작업만 포함한다. 문서 이동에 따른 링크 변경(과거 ops/skill 포함)은 문서 정리 범위다. 기존 파일 원본을 덮어쓰거나 reset/clean/stash하여 다른 작업을 지우지 말 것. .out CLI 로그·로컬 실행 산출물·개인정보는 커밋하지 말 것. 필요하면 깨끗한 임시 worktree에서 이번 승인 patch만 적용하고 게이트를 검증하라(본 채팅 작업 디렉터리 변경 보존).

## 실행

1. git fetch origin 후 refs/원격 변경 확인. 의미 단위 커밋으로 승인 변경만 구성하고 최종 커밋 diff의 범위·공유 파일 다른 작업 혼입을 확인한다. 작업 브랜치명 codex/ 접두어 유지. 게이트 우회 금지, force push 금지.
2. staged/committed 상태에 필요한 tsc-b·lint·문서 검사·칼로리/재개 시험·entry selectors 및 실제 pre-push 게이트 실행. dirty tree의 다른 변경 덕분에 시험이 통과하는 것을 방지할 것. 실패는 이번 변경 원인만 최소 보완하고 별도 기존 원인이면 근거를 남긴다.
3. 로컬 main2에 병합(가능하면 fast-forward)한다. **원격 push 금지.** main은 전체 개발 완료 선언이 없으므로 이번에 갱신하지 않는다. branch 삭제는 이번에 불필요. 충돌은 다른 작업을 보존하여 해소, 명백히 범위가 다른 충돌이면 보고.
4. 로컬 main2·작업 commit 관계 검증. 최신 결과20 작성 후 별도 docs commit으로 결과/ops 상태를 기록하여 작업 브랜치/main2에도 로컬 반영하고 최종 CLI 메시지에 실제 최종 SHA를 남긴다. 성공보다 먼저 성공 기록을 쓰지 말 것. 본 작업은 hosting 배포를 포함하지 않는다.

기존 18의 미실행 실 Firebase/다중 탭/e2e 한계를 없어진 것처럼 쓰지 않는다. 결과 작성 후 CLI 종료. 다른 작업 사용자 확인을 요구하지 않고 승인 범위 수행.
