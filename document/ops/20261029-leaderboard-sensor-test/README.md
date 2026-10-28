# 순위 센서 조건 임시 완화

상태: LOCAL_VERIFIED · 미배포 · 출시 전 복구 필요

Chief의 2026-10-29 테스트 요청. [지시](01-task.md) · [결과·검수](02-result.md).

센서 사용 여부를 기록하는 원본 tier는 유지하고 순위에서만 t0를 임시 포함한다.
복구 지점은 `functions/src/leaderboardCore.ts`의 `LEADERBOARD_SENSOR_ONLY`(false → true).
상세 절차는 [출시 전 확인사항 §6](../../출시%20전%20확인사항.md).
