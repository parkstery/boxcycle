# 결과44 — 경로 설정 시 주행 시작 버튼 두 번 점멸

- branch: `face-redesign2`
- HEAD: `b4239b5541cce88ea1481c5fcdf033ce6a4d5f45`
- model: Cursor Auto (Developer 교대. Muse Spark 1.3 quota 이후)
- session: 이 대화. Muse session `ses_ec44079b2ffe1Pm8y4q5fzX0Tz` 는 선행 exit1, 앱 수정 없음
- 작업 경로: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`

## 수정

| 파일 | 내용 |
|---|---|
| `apps/web/src/App.tsx` | RouteDock에 `routeSetupToken={routeGeometry ?? null}` 한 곳 |
| `apps/web/src/components/route-dock/RouteDock.tsx` | 선택 prop. 렌더 중 이전 token/loading/stage 비교. `ready-to-start`이고 로딩이 끝난 새 참조(또는 로딩→완료)만 attention·sequence 증가. loading/삭제/그 외 stage는 attention 해제. `animationend`가 현재 시퀀스 이름일 때만 해제. 버튼은 유지하고 클래스만 `setup-a`/`setup-b`로 교대 |
| `apps/web/src/components/route-dock/RouteDock.css` | 색·그림자. `600ms` × `iteration-count: 2`. disabled도 opacity 1로 강조. `prefers-reduced-motion`은 동일 정적 키프레임 1.2s 후 `animationend` |

접기/펼치기·센서·같은 참조 재렌더는 token/loading/stage가 같으면 시퀀스를 올리지 않는다. 끝난 cue(`attention` false)는 패널을 다시 열어도 클래스가 없다.

## 정적 확인

cwd `apps/web` (diff만 저장소 루트).

| 명령 | exit |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 (셀렉터 15 PASS) |
| `npx tsc -b --pretty false` | 0 |
| `npx eslint src/App.tsx src/components/route-dock/RouteDock.tsx src/components/route-dock/RouteDock.css` | 0 (error 0, warning 8) |
| `git diff --check --` 위 세 파일 | 0 |

eslint warning 7건은 `App.tsx` 기존 `exhaustive-deps`(712, 1175, 1212, 1228, 1270, 1351, 2830). 이번 연결 행과 `RouteDock.tsx`에는 warning 없음. CSS는 설정 없음으로 ignored warning 1.

`git diff --stat`: App.tsx +1, RouteDock.tsx +51/−1, RouteDock.css +78.

## 미검증·한계

- browser, 서버, 전체 suite, subagent, 커밋, 푸시, 배포 없음
- 두 번 반복·종료·재렌더·경로 교체·로딩/센서/재개·reduced-motion·버튼 콜백의 런타임은 Supervisor 경량 fixture 몫
- 접힌 동안 버튼이 마운트되지 않으면 그 사이 애니메이션은 시작되지 않는다. 이미 `animationend`로 끝난 cue는 다시 열어도 재시작하지 않는다
