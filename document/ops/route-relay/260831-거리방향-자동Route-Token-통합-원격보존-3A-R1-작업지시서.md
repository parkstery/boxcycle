# 거리·방향 자동 Route — Token 통합 원격 보존 3A-R1 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **Git 원격 보존** — 검수된 두 로컬 브랜치를 원격에 안전하게 push |
| 작성일 | 2026-08-31 |
| 상태 | **PASS · 원격 push 완료** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-TOKEN-3A-R1` |
| 원본 자동 Route | `feat/distance-based-auto-route` at `2693f659fb140eb7b5e2d9c21754b5c211c17ba6` |
| 통합 브랜치 | `feat/distance-auto-route-token-integration` at `43db30681446d8c88871fda77802fe476209b035` |
| Token 기준 | `fix/route-token-default-enforcement` at `ad4d7764e846c1016d13ea74cbdd6812bfff69af` |

## 1. 목적

독립 검수를 통과한 자동 Route 최신 commit과 Token 통합 브랜치를 원격에 보존한다. 이번 단계는 Git 보존만 수행하며 새 구현, PR, `main2` merge, 배포는 하지 않는다.

## 2. 작업 전 확인

1. `git fetch origin --prune`을 실행한다.
2. 다음 포인터가 맞는지 확인한다.
   - `origin/feat/distance-based-auto-route` = `2b0bfec8b784f9c633605991044e05484556285f`
   - 로컬 `feat/distance-based-auto-route` = `2693f659fb140eb7b5e2d9c21754b5c211c17ba6`
   - 로컬 `feat/distance-auto-route-token-integration` = `43db30681446d8c88871fda77802fe476209b035`
   - `origin/fix/route-token-default-enforcement` = `ad4d7764e846c1016d13ea74cbdd6812bfff69af`
3. 자동 Route 브랜치는 원격보다 정확히 1 commit 앞서 있고, 통합 브랜치는 upstream과 원격 브랜치가 아직 없어야 한다.
4. 통합 worktree가 clean인지 확인한다.
5. 루트 worktree의 `document/README.md`와 `document/ops/route-relay/` 문서 변경을 코드 commit에 섞지 않는다.

포인터가 다르거나 원격에 예상하지 못한 새 commit이 있으면 push하지 말고 BLOCK으로 보고한다.

## 3. 실행

1. 자동 Route 원본 브랜치를 일반 fast-forward push한다.

```powershell
git -C C:\20.HDev\boxcycle push origin feat/distance-based-auto-route
```

2. 통합 브랜치를 최초 push하면서 upstream을 설정한다.

```powershell
git -C C:\20.HDev\boxcycle-distance-auto-route-token-integration push -u origin feat/distance-auto-route-token-integration
```

3. force push, rebase, amend, reset, cherry-pick은 하지 않는다.

## 4. push 후 검증

- 원격 `feat/distance-based-auto-route` = `2693f659fb140eb7b5e2d9c21754b5c211c17ba6`
- 원격 `feat/distance-auto-route-token-integration` = `43db30681446d8c88871fda77802fe476209b035`
- 두 브랜치 모두 local/remote delta `0/0`
- 통합 worktree clean
- `ad4d776`와 `2693f65`가 통합 HEAD의 ancestor
- `main2`와 배포 환경에는 변화 없음

## 5. 범위 보호

- 제품 코드 수정 금지
- Token 획득 조건·적립률·완주 판정 변경 금지
- 작업지시서 문서와 제품 코드를 같은 commit에 혼합 금지
- PR 생성·`main2` merge·배포 금지
- 사용자의 통합 화면 확인 전 다음 개발 단계 착수 금지

## 6. 완료 보고

1. 두 push 명령의 결과
2. 원격 branch와 정확한 commit hash
3. local/remote delta
4. 세 worktree의 상태
5. force push·PR·merge·배포가 없었음을 명시

완료 후 사용자 검토를 기다린다.

---

## 7. 2026-08-31 독립 확인

- `origin/feat/distance-based-auto-route` = `2693f659fb140eb7b5e2d9c21754b5c211c17ba6`
- `origin/feat/distance-auto-route-token-integration` = `43db30681446d8c88871fda77802fe476209b035`
- `origin/fix/route-token-default-enforcement` = `ad4d7764e846c1016d13ea74cbdd6812bfff69af`
- 세 브랜치 local/remote delta: 모두 `0/0`
- 통합 worktree: clean
- force push·PR·`main2` merge·배포: 없음

원격 보존 작업은 PASS로 종결한다. 다음 자동 Route UI 보완은 `260831-거리방향-자동Route-컴팩트UI-거리원-3B-작업지시서.md`에서 진행한다.
