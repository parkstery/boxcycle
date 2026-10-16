# 감리 J1 — 떨림 원인

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 판정 | **APPROVED** — 원인 확정, 계측 커밋. 수정은 J2 |

- 원인: 표시 시계 `ensureFrameDisplayRenderTimeMs` 가 `Date.now()`(정수 ms) + **8 ms 재사용 창**. 120/144 Hz 에서 프레임의 절반 이상 시계가 멈춰 `isDisplayRenderCatchingUp` 이 참 → 본인 거리가 200 ms 버퍼 보간으로 교체 → 본인·페이서 공통 미세 튐 → 카메라 τ 0.1 s 가 늦게 따라가 화면상 약 5 cm 역행. 60 Hz 는 0.
- 재현 수치(제품 함수 직접 재생, 20 km/h): 60 Hz 화면 역행 0/360, 144 Hz 434/870. Chief 관찰(PC 고주사율에서만 페이서 떨림)과 일치.
- 계측: `?perflab=1` 일 때만 라이더별 역행·속도 변동계수·상대 거리 표준편차. 쿼리 없으면 즉시 반환.
- J2 채택 방향: ① 표시 시계를 rAF 시각 기반(`performance.timeOrigin + now`, 소수 ms)으로, ② 재사용은 같은 프레임 세대에만, ③ 단독 주행에서 한 틱 뒤짐으로 버퍼 전환 금지. `test:peer-spacing` 게이트와 동행 동기화 시험을 반드시 유지.
