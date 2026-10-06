# 검수 09-2 — ✕ 닫기 · 보조 줄 · 스위트 재실행

- Supervisor: Claude · 판정: **APPROVED** (지시 09 포함 최종)

| 항목 | 판정 | 근거 |
|---|---|---|
| ✕ 우상단(oc-modal__close 동형), `aria-label="닫기"` 유지, 저장 있을 때 숨김 | PASS | 690 시트 캡처 |
| 보조 줄 시간·평속·칼로리·설정 한 줄 | PASS | 캡처, 평속 lines=1 |
| `tsc -b --noEmit` 0 · 컴팩트 시트 describe 통과 | PASS | 결과 09-2 |
| 스위트 실패 ① 다음 주행 카드가 Mapbox 줌 + 를 가림 | **a275e3a 회귀**(지시 06) | worktree 비교: a275e3a^ PASS / a275e3a FAIL → 지시 06-3 |
| 스위트 실패 ② RouteDock 센서 안내 깜빡임 | 기존 | a275e3a^ 에서도 FAIL |

## 사고 기록
worktree 비교 정리 중 Windows junction + `worktree remove` 로 `apps/web` 작업 트리가 비워졌다. Developer 가 `git restore apps/web` 로 추적 파일을 되살렸으나 **git 비추적 파일(`.env.local` 등 비밀 설정, `.out/` 증거)이 소실**됐다. 커밋된 코드는 영향 없음. 이후 지시서에서 worktree 사용 시 junction 금지·`git worktree add` 만 쓰도록 명시한다.
