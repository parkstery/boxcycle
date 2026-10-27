# 지시·결과96 — 지도 축소 버튼 500m 제한 해제

## Chief 지시 (2026-10-27)

지도 `−` 버튼으로 약 500m까지만 축소되는 것은 의도한 제한이 아니다. 제한을 해제한다.

## 원인

- 지도 자체는 이미 Mapbox `minZoom: 0`으로 지구 전체 축소를 허용했다.
- 그러나 주행 중 거리 지배 카메라(aerial·전후좌우) HUD `−` 경로에만 `RIDE_USER_ZOOM_DISTANCE_SOFT_MAX_M = 500`이 있었다.
- 500m에서 다음 거리 625m를 계산해도 `Math.min(500, 625)`로 다시 500m가 되고, 동시에 `zoomOutDisabled`가 참이 되어 버튼이 꺼졌다.

## 구현

- 500m 소프트 상한과 상한 기반 버튼 비활성화를 제거했다.
- HUD 줌 거리 계산을 `lib/camera/rideUserZoom.ts`로 분리했다.
- `−`: 현재 거리 × 1.25, `+`: 현재 거리 ÷ 1.25. 0.1m 단위 반올림은 유지한다.
- 거리 지배 주행 카메라의 `−` 버튼에는 제품 임의 상한을 두지 않는다. 실제 렌더 최종 하한은 기존 Mapbox `minZoom: 0`이 맡는다.
- 카메라 프리셋·실제 지도 최소 줌·카메라 2~6 야외 고정 정책은 변경하지 않았다.

## 검증

- 신규 계약 `ride-user-zoom-contract.test.ts` — 3/3 PASS.
  - 500→625m
  - 1000→1250m
  - 500→625→500m 확대/축소 역관계
- 기존 카메라 프레이밍 — 99/99 PASS.
- `test:quick ride` — 879/879 PASS.
- `npm run build` — PASS(기존 청크 크기 경고만).
- TypeScript — PASS.
- 변경 파일 ESLint — 오류 0, `App.tsx` 기존 hook 경고 7.
- tidy·의존 방향·셀렉터19·문서·diff — PASS.

## 상태

**LOCAL_VERIFIED / 미커밋·미푸시·미배포 (2026-10-27 00:38 KST).** 구현·검증은 Codex Supervisor가 직접 수행했다.
