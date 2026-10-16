# 감리 F1 — `?perflab=1`

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 판정 | **APPROVED** — Chief 지시로 병합·운영 배포 |

- 쿼리 없는 운영: `shouldMeasure()` = DEV 또는 perflab 만 → 둘 다 아니면 콜백만(`performance.now()` 0회), 시험으로 고정. 패널은 perflab 일 때만 마운트·rAF.
- 리그·흔들림·LOD·코너 로직 무변경, 계약 문자열 유지. tsc 0, rider-preserve 42+6, perf-lab 9, test:quick 은 worktree `functions/lib` 부재 3건 외 통과.
- 서버 전송 없음(복사만). 다음: 동행 추적 기록 추가(동행 떨림 조사).
