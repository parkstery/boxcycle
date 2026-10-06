# 지시 06-3 — 「다음 주행」 카드가 Mapbox 줌 + 를 가리는 회귀(a275e3a)

- 담당: Developer(Cursor CLI) · 보고: `03-result-06c.md` · 커밋 **금지**

## 문제
`npm run test:e2e:ride-summary` 의 「다음 주행 카드 자리」(`e2e/ride-summary-compact.spec.ts` ~450–, 폰 가로) 가 a275e3a 부터 실패: `elementFromPoint` 로 `mapboxgl-ctrl-zoom-in` 에 닿지 못한다. worktree 비교: a275e3a^ PASS / a275e3a FAIL([검수 09-2](../20261006-ride-summary-layout/04-review-09b.md)).
추정 원인: 대기 화면에서도 맵 제어(야외 − +)가 우상단 줄에 상시 들어가 `.map-hud__tr` 기하가 바뀌었고, 다음 주행 카드는 tr 기준으로 배치돼 Mapbox 우측 컨트롤 열과 겹친다. **추정 — 먼저 계측으로 확인.**

## 요구
1. 다음 주행 카드·우상단 줄·Mapbox 우측 컨트롤(+/−/나침반)·「맵」 트리거가 폰 가로(690×275, 740×360)와 1000×640 에서 **서로 겹치지 않게**. Mapbox 기본 컨트롤은 **유지**(Chief 결정 — 제거·숨김 금지).
2. 지시 06 의 배치 의도(우상단 `[카메라][야외 − +][계정]`, 시계 우하단)는 유지.
3. 위 spec 을 **기대값 변경 없이** 통과.

## 허용 파일
`components/maphud/MapHud.tsx/.css`, 다음 주행 카드 컴포넌트·CSS(`components/ride/NextRideCard.*` 등 — grep 으로 확인), `components/map/MapView.css` 의 우측 Mapbox 컨트롤 margin 규칙. 그 밖 금지.

## 금지 (사고 재발 방지)
- **`git worktree` 사용 시 junction/symlink 로 node_modules 를 연결하지 말 것**, 정리는 `git worktree remove` 전에 junction 이 없음을 확인. 지난 실행에서 `apps/web` 작업 트리가 비워져 비추적 비밀 설정이 소실됐다. 이번 지시에서는 worktree 비교가 필요 없다 — 사용 금지.
- `git restore`·`git checkout -- <path>`·`git clean` 금지.

## 완료 조건
1. `cd apps/web && npx tsc -b --noEmit` 0, eslint 증가 0.
2. `npm run test:e2e:ride-summary` 에서 「다음 주행 카드 자리」 PASS(센서 깜빡임 실패는 기존 — 결과에 그대로 기록).
3. `npm run test:e2e:menu-a` PASS.
4. 촬영: 3폭 대기 화면(다음 주행 카드 있음) — 이 묶음 `shots-06c/` 에. 겹침 계측표.
5. `03-result-06c.md`.
