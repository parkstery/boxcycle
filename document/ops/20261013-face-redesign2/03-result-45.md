# 결과45 — 접힌 주행 패널의 시작 안내

`apps/web/src/components/route-dock/RouteDock.tsx` 두 곳만 수정. 다른 파일·시험·커밋·푸시 없음.

1. `setupCue` 비교 블록에서 `freshCompleted`가 true이면 `setExpanded(true)`. 새 경로 설정 시 시작 버튼이 보이게 펼친다.
2. `onCaretClick`의 `preRouteCollapsed && cadence` early-return 뒤, `setExpanded` 앞에 `if (expanded) setSetupCue(...)`로 진행 중 attention을 끈다. 접은 뒤 다시 펼쳐도 점멸이 재시작하지 않는다.

Supervisor가 검증을 실행한다.
