# 감리 F2 — 프레임 항목별 분해

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 판정 | **APPROVED** — 계측만, 병합·배포 후 Chief 실기기 측정 |

- 쿼리 없으면 틱 시계 null·지도 래핑 없음·Profiler 미마운트·LoAF 관찰자 없음(`performance.now()` 0회 시험). `map._render` 래핑은 perflab 전용, 대입 실패 시 이벤트 집계로 후퇴.
- 헤드리스(SwiftShader, 실기기 아님) 1차: 프레임 111 ms 중 측정 JS 33 ms — 지도 JS(라이더 제외) 11.7, React 커밋 10.4 ms/프레임(**93 프레임 중 82 커밋** — 주행 HUD 가 거의 매 프레임 렌더, dev/StrictMode 로 부풀었을 수 있음), 앱 틱 8.7(모델 동기화 2.6, DOM 마커 2.0, spec 1.9, 카메라 1.3), 라이더 2.3. 나머지 78 ms 는 JS 밖(GPU/합성 추정, 헤드리스는 GPU 타이머 미지원).
- 다음: Chief PC·폰 실측으로 확정. 후보 1순위는 React 매 프레임 커밋(HUD 갱신 주기 분리), 2순위 지도 렌더 설정(지형·3D·위성·라벨), 3순위 틱 내 DOM 마커·동기화.
- check-dep 미지정 lib 0(M0 실패는 worktree `functions/lib` 부재), test:quick worktree 환경 3건 외 통과, peer-spacing PASS, rider-preserve 44+6, build 0.
