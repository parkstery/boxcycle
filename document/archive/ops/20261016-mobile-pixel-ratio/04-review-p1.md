# 감리 P1 — 고밀도 화면 렌더 해상도 상한

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer **Muse Spark** (+ Supervisor 보정 1건) |
| 판정 | **APPROVED** — 병합·운영 배포 |

- 지시 오류 인정: mapbox-gl 3.23.1 `MapOptions` 에 `pixelRatio` 없음(d.ts 15597행 `pixelRatio` 는 `SpritePosition` 필드), `get/setPixelRatio` 없음 — MapLibre 전용 API 를 잘못 지시했다. Developer 가 문면 대신 같은 효과(Mapbox 가 읽는 `window.devicePixelRatio` 에 상한)로 구현하고 차이를 먼저 보고 — 적절.
- **Supervisor 보정(직접 수행)**: Developer 구현은 설치 시점 배율로 **고정** → PC 브라우저 확대·축소·모니터 이동 시 실제 배율을 못 따라감. 원래 브라우저 접근자를 잡아 매번 `min(현재 실측, 상한)` 을 돌려주게 바꾸고, 접근자를 못 찾는 환경은 설치 값으로 후퇴(자기 자신 재귀 방지). 시험 "배율 변화 따라가기" 추가 → 8/8.
- 효과: DPR 3 폰은 지도·3D 라이더(지도 GL 컨텍스트 공유)를 2배로 그림 — 픽셀 약 55% 감소(헤드리스 캔버스 1398×546 = CSS×2 확인). DPR ≤ 2(PC 1.25)는 무변경.
- 부작용 범위: 페이지 JS 가 읽는 `devicePixelRatio` 가 DPR > 2 기기에서 2 로 보임(CSS·미디어쿼리·srcset 등 브라우저 자체 동작은 영향 없음). 되돌리기: `?maxdpr=3`(비교) 또는 상수 `RIDER_MAP_MAX_PIXEL_RATIO` 를 4 로.
- 검증: tsc 0, eslint 0, check-dep 미지정 0, test:quick(worktree `functions/lib` 3건 외) 통과, rider-preserve 통과, build 0.
- 배포 후 Chief 폰 perflab 로 "계산 밖 대기"(10.3 ms) 감소 확인.
