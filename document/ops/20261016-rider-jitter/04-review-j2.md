# 감리 J2 — 떨림 수정

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 판정 | **APPROVED** — Chief 지시("끝나면 배포해")로 병합·운영 배포 |

- 근본 원인: 지도 rAF 가 세션 rAF 적분보다 먼저 거리를 읽어, 화면 이동은 이전 프레임 간격·측정 분모는 이번 간격 → 불규칙 프레임(20/30 ms)에서 이동량이 들쭉날쭉. Chief PC 실측(역행 0, speedCv 0.22–0.59)과 일치. 60 Hz 일정 간격에서는 0 이라 폰에서 안 보였다.
- 수정: 표시용 거리만 `projectRideDistToFramePerfMs` 로 이번 프레임 시각까지 투영(`virtualDistance` 적분은 그대로 → 이중 가산 없음), 표시 시계를 프레임 epoch(`performance.timeOrigin + now`)로 통일·같은 epoch 만 재사용, 단독 주행 한 틱 지연으로 버퍼 전환 금지.
- 재생: 20/30·16.7/33.3 ms 섞임에서 본인·페이서·동행 speedCv 0.29/0.49 → **0.0000**, 역행 0. 60–165 Hz 8조합 역행 0. 카메라 대비 잔여 후퇴 < 1 cm(τ 불변, 정상 추종 지연).
- 회귀 방지: `scripts/jitter/raf-beat-replay.test.mjs` 를 `test:quick`(pre-push 게이트) `jitter` 묶음에 포함 — 2026-10 c57e0c6 의 시계 통일이 다시 틀어진 일을 반복하지 않게.
- 동행 동기화 게이트 `test:peer-spacing` PASS, pacer 14, rider-preserve 42+6, tsc 0.
- 배포 후 확인: PC `?perflab=1` 떨림 줄 speedCv 가 0.05 근처로 내려가는지 Chief 실측.
