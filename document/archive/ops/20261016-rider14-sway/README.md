# 20261016-rider14-sway

| 항목 | 내용 |
|---|---|
| 목적 | 제품 라이더 rider14 에 상체 좌우 흔들림·상하 움직임·자전거 반대 롤을 넣는다(최종값 어깨 **1.0°**(Chief 2배 지시)·자전거 0.4°·상하 2 mm·타이밍 −60°) |
| 상태 | **DONE** — main2 병합·푸시·운영 배포 2026-10-16 |
| 계획 | [01-plan](01-plan.md) |
| Supervisor | **Claude** · Developer **Cursor Agent CLI** · 작업 위치 worktree `C:\20.HDev\boxcycle-sway` (브랜치 `feat/rider14-sway`) |
| 다음 | 후속: LOD1·LOD2(P8) |

## 기록

| 순서 | 파일 | 상태 |
|---|---|---|
| 지시 W1 | [02-task-w1](02-task-w1.md) → [03-result-w1](03-result-w1.md) → [감리](04-review-w1.md) | **APPROVED** — 시험 37+6 |
| 지시 W2·W3 | [02-task-w2w3](02-task-w2w3.md) → [03-result-w2w3](03-result-w2w3.md) → [감리](04-review-w2w3.md) | **GW2 Chief 승인 · GW3 통과** — 드로우콜 14, ms 증가 없음 |
| 미리보기 | https://boxcycle-dc2df--sway-s9uwmo52.web.app | Chief 확인 — 상체 2배(1.0°) 재배포 후 "배포까지 진행해" (만료 2026-10-23) |
| W4 배포 | main2 병합·푸시·`firebase deploy --only hosting` | Chief 지시 2026-10-16 |
