# 감리 M3 — 주행 글자 절충 모드

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark**(한도 없음) |
| 판정 | **APPROVED** — 병합·운영 배포, 이후 Supervisor 실제 GPU 모드별 측정·캡처 → Chief 선택 |

- 모드 `both`(기본: 주변 + 중요 종류) / `near` / `major` / `all` / `none`, `?labeldist=` 0.5–3(기본 1.2). 원래 filter·visibility 복원, 상태 같으면 호출 0, `setFilter` 실패 건너뜀, `style.load` 재적용, 앱 레이어 제외.
- 실제 스타일 3종(night 29·outdoors 34·satellite 20 symbol)에서 `distance-from-center` 적용 성공, 복원 불일치 0. `sizerank` 는 실제 filter 에 없어 POI 는 `filterrank ≤ 2`, 도로는 motorway/trunk/primary/secondary.
- 검증: tsc 0, check-dep 미지정 0, test:quick(worktree 3건 외) map 117/0, rider-preserve 44+6, build 0.
