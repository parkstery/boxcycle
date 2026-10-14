# 결과37 — 공통 삭제 클릭과 drag 충돌 차단

- 작업: 02-task-37.md (재지시37)
- 담당: Developer Muse
- cwd: C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle
- 일시: 2026-10-14

## 수정 (1 이벤트만)

- 파일: `apps/web/src/components/map/mapPopupElements.ts` (clearRouteBtn 이벤트 부분만)
- 추가 1줄:
  ```ts
  clearRouteBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
  ```
- 위치: `clearRouteBtn.onclick` 정의 직후, `if (typeof onClearRoute === "function")` 블록 내부
- `preventDefault` 사용 안 함 (네이티브 click 보존)
- 기존 onclick / keyboard / 라벨 / 배치 / 크기 / 다른 drag 핸들 / route 동작 그대로
- `mapPickRouteDock` 공용함수 변경 없음

## 원인 대응

- 제목영역으로 옮긴 삭제 button은 dragHandle 자손이므로, `mountRoutePickDockDrag`의 handle pointerdown이 `setPointerCapture/preventDefault` 하여 `button.click` 미발생
- 삭제 버튼의 pointerdown을 `stopPropagation()` 으로 차단해 기존 dragHandle pointerdown까지 전달되지 않게 함

## 검증

- `git diff --check`: whitespace 오류 없음 (PASS)
- 범위 준수: mapPopupElements.ts clearRouteBtn 이벤트 1줄 + 주석 1줄만 추가, 타담당자 변경 되돌림 없음
- commit/push/deploy/server/하위agent 실행 없음
- Supervisor36 테스트 2파일 보존 (미접촉)

## Supervisor 검수 요청

- 실제 3viewport 15상태/삭제/drag/키보드 검수 요망
