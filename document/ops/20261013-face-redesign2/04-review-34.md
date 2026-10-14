# 감리34 — 모드 분리 검수, 국소 재작업

2026-10-14 Supervisor Codex. 이전30~33 디자인은Chief거부,34컨셉승인에따라 별도화면으로교체. 실제667/740에서 위치→거리→위치/거리값보존/drag/경계PASS, 최종전체판정아님.

REWORK_REQUIRED: pick-34-qa.cjs exit1, 새전환button44px CSS가 뒤의base min-height0에덮임. 거리화면에서deletebutton숨김, 위치profile행5개혼잡, 복귀/제목시각분리부족. [지시35](02-task-35.md) 국소마감. 옛clearRoute DOM위치문자열계약은Chief승인UI구조보다우선하지않음.
