# 감리 M4 — 기본 글자 모드 `names` + perflab 패널 위치

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark**(한도 없음) |
| 판정 | **APPROVED** — Chief 지시("끝나면 배포해")로 병합·운영 배포, Chief 직접 확인 |

- 근거(Supervisor 실제 GPU, 파리): all 49 fps / near 49–50(거리 조건 효과 없음) / both 65(이름 거의 사라짐) / **장식만 숨김 57**(이름 전부 유지). 가정 정정: 비용은 먼 글자가 아니라 장식 symbol 레이어·종류.
- `names`(새 기본): `isDecorativeSymbolLayer` — 이름 레이어 우선 유지, 모르는 것은 숨기지 않음. 스타일 3종 숨김 = 기대치 정확 일치(outdoors 20·satellite 6·night 16), 이름층 filter·visibility 호출 0, 복원 불일치 0.
- perflab 패널: 상단 가운데 → 왼쪽 가장자리 세로 중앙, 카메라·맵 버튼 줄과 겹침 0(1280×720·699×273).
- 검증: tsc 0, check-dep 미지정 0, test:quick(worktree 3건 외) map 123/0, rider-preserve 44+6, build 0.
