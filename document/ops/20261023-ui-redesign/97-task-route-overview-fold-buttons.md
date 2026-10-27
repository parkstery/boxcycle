# 지시97 — RouteDock·미니맵 접기 버튼 통일

## Chief 결정 (2026-10-27)

RouteDock과 미니맵의 펼치기·접기 버튼이 모양과 위치가 달라 좋지 않다는 문제에 대해, 다음 제안을 수용하고 구현한다.

- 두 패널의 독립 접기 동작은 유지한다.
- 두 버튼은 같은 공통 컴포넌트·같은 28×28px 흰 둥근 사각형·같은 테두리·그림자·아이콘 굵기를 쓴다.
- 두 버튼 모두 각 패널의 **왼쪽 위**를 기준으로 배치한다.
- 펼침 `‹`, 접힘 `›` 방향은 유지한다.
- 접힌 상태에서 어느 버튼인지 구분되도록 RouteDock은 `S—E`/경로 지점 계열, 미니맵은 지도/경로선 계열의 작은 식별 도안을 함께 표시한다. 텍스트 라벨을 화면에 추가하지 않는다.
- 접근성 이름 `경로 패널 접기/펼치기`, `미니맵 접기/펼치기`는 그대로 유지한다.

## UX 계약

1. 주소만 접고 미니맵을 유지하는 현재 주행 기본 상태를 보존한다. 두 버튼을 하나로 합치지 않는다.
2. 펼침·접힘을 전환해도 각 버튼은 해당 패널의 왼쪽 위 기준에 머문다.
3. 둘 다 접히면 같은 `›` 두 개가 아니라 식별 도안으로 서로 구분된다.
4. 패널 내용(S 주소·미니맵 경로)을 버튼이 가리지 않는다. RouteDock은 필요한 내부 여백을 명시적으로 확보한다.
5. 폰 가로 667×300·800×360에서 누르는 영역 28×28 이상, 화면 밖/서로 겹침 없음.

## 구현 허용 범위

- `apps/web/src/components/route-dock/RouteDock.tsx/.css`
- `apps/web/src/features/map-overlays/RouteMinimap.tsx/.css`
- 새 공통 UI 컴포넌트는 위 두 폴더 중 더 자연스러운 한 곳에 최대 TSX/CSS 각 1개
- 관련 `apps/web/e2e/ui-800x360.spec.ts`, `address-minimap-width.spec.ts` 또는 새 좁은 화면 시험 1개
- `apps/web/scripts/ride-verify/entry-contract.mjs`는 기존 접근성 계약이 실제로 바뀔 때만 수정. 이번 지시는 이름 보존이므로 원칙적으로 수정하지 않는다.
- 결과 기록: 이 파일 끝에 `## Cursor 결과` 추가.

## 금지

- RouteDock·미니맵 상태를 하나로 합치기 금지.
- RouteDock 주행 시작 자동 접힘, 미니맵 기본 펼침, 폭 일치, 고정11·12·13·14·27·28 변경 금지.
- 주소·센서·S/1/E·⇅·삭제·미니맵 경로 투영/지도 요청 로직 변경 금지.
- 기존 시험 기대값 완화 금지. 새 레이아웃을 정확히 단언한다.
- 현재 다른 작업의 dirty 변경 되돌림/정리/포맷 금지.
- `git worktree`·`git restore`·`git clean`·`git stash`·브랜치 전환·커밋·푸시·배포 금지.

## 필수 검증

```powershell
cd C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
npx tsc -b --noEmit
npx eslint <변경 TS/TSX/시험 파일>
$env:RTW_DEV_PORT='5022'; npx playwright test ui-800x360.spec.ts address-minimap-width.spec.ts --workers=1 --retries=0
```

화면 시험은 최소 다음을 단언한다.

- RouteDock·미니맵 토글의 실측 크기 28×28px.
- 두 버튼의 배경·테두리·radius·그림자·아이콘 stroke가 같다.
- 펼친 각 패널에서 버튼 left/top 오프셋이 같다.
- RouteDock 토글에는 route 식별자, 미니맵 토글에는 map 식별자가 DOM에 있다.
- 둘 다 접힌 상태에서도 두 토글이 보이고 서로 겹치지 않는다.
- 기존 접근성 이름과 독립 토글 동작 유지.

## Cursor 결과

- 2026-10-27 00:4x KST, Chief 지시에 따라 Cursor CLI `agent -p --force --trust --workspace C:\20.HDev\boxcycle`로 이 지시서 구현을 요청했다.
- Cursor는 `.promote-lock` 누락 경고 뒤 `uv_os_get_passwd returned ENOMEM (not enough memory)`로 제품 파일을 수정하기 전에 종료했다. 종료 직후 범위 파일 상태를 대조해 Cursor 제품 변경 0건을 확인했다.
- 같은 요청에서 직접 수행하는 편이 더 적은 토큰·시간이라고 판단해 Codex Supervisor가 구현·시험·화면 감리를 완료했다.

## 구현·감리 결과

- `RouteOverviewFoldToggle.tsx/.css`를 추가해 공통 28×28 흰 버튼, 테두리·그림자·1.7 선, 경로 지점/지도 식별 도안, 상태별 `‹`/`›`를 한 컴포넌트로 만들었다.
- RouteDock과 미니맵은 독립 state·기본 상태(주소 접힘, 미니맵 펼침)를 유지한다. 펼친 두 버튼의 외곽 패널 기준 위치는 left/top 4px이며, 접힌 상태에도 각 버튼이 남는다.
- RouteDock 목록 전체에 버튼 자리만큼 내부 여백을 주어 S·경유지 들여쓰기 관계와 ⇅ 위치를 보존했다. 대기 화면은 버튼(왼쪽)·센서(오른쪽) 한 줄로 고정12를 10-27 결정에 맞게 갱신했다.
- 캡처 `evidence/riding-address-dock-collapse/riding-expanded-800x360.png`, `riding-collapsed-800x360.png`를 직접 확인해 두 버튼의 모양·위치·구분과 패널 내용 비가림을 확인했다.

## 검증

| 검증 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | PASS, 19/19 |
| `npx tsc -b --noEmit` | PASS |
| `npm run build` | PASS, Vite 517 modules (기존 chunk-size 경고만) |
| 변경 TS/TSX/시험 ESLint | PASS, 오류 0 |
| 관련 잠금 화면 시험(`RouteDock과 미니맵|목록 11|고정12`) | PASS, 6/6 |
| `address-minimap-width.spec.ts` 전체 | PASS, 2/2 |
| 문서·의존 방향·`git diff --check` | PASS (`diff --check`는 기존 LF→CRLF 경고만) |
| `ui-800x360.spec.ts` + 주소 시험 최초 24건 | 19 PASS·5 FAIL 뒤 관련 3건 교정. 남은 2건은 이 범위와 무관한 기존 dirty 상태: 주행 시작 버튼 높이 `44.7397`(기대 44), 결과 설명 글자 `10px`(기대 ≥11px). 모든 시험 본문 완료 뒤 Playwright teardown이 종료되지 않아 중단 |

판정: **LOCAL_VERIFIED**. 커밋·푸시·배포 없음.
