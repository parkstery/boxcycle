# 감리35 — 모드별표시 PASS, 실제삭제 재작업

2026-10-14 Supervisor Codex. pick-35-qa.cjs exit0 32상태(4viewport×8), 모드분리/44px/가로overflow0/값보존/오류·토큰·재개PASS. 거리화면에서도삭제표시PASS. 갱신한계약36의거리테스트141 PASS.

REWORK_REQUIRED: pick-35-live.cjs exit1. 실제667에서삭제버튼은표시되지만click후popuphidden대기timeout. 원인headerRow가dragHandle안이라handle pointercapture가button.click을가로챔. [재지시37](02-task-37.md)에서삭제pointerdown전파만막고nativeclick보존. 테스트실패를성공으로보고하지않음.
