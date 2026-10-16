# 감리 M2 — 주행 중 가까운 카메라 글자 숨김 (Chief 결정 A)

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark**(한도 없음) |
| 판정 | **APPROVED** — 병합·운영 배포, 배포 후 Supervisor 실제 GPU 측정 |

- 주행(running/paused) + 줌 ≥ 19 에서만 베이스맵 symbol 숨김, 18.7 미만 복원(히스테리시스), 원래 `none` 유지, 상태 변화 때만 `setLayoutProperty`, `style.load` 재적용, 앱 레이어·DOM 이름표 제외, `?labels=1` 비상 표시. `?mapcut=` 공존.
- 검증: tsc 0, check-dep 미지정 0, test:quick(worktree `functions/lib` 3건 외) — map 102/0(신규 11), rider-preserve 44+6, build 0.
