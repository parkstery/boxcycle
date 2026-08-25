# G-1 REPORT — 260825-gient 라이더 20배 시각 실험

지시서 `INSTRUCTION.md` 정본. 이 보고는 §8 과 같은 판정을 쓴다.

## 결론

제품 코드는 `RIDER_GLB_MODEL_SCALE = 1.15 * 20 = 23` 한 줄 경로로만 바꿨다. 실행 중 지도의 `model-scale` 은 before `[1.15,1.15,1.15]` / after `[23,23,23]` 이다 (G0 통과).

화면 실루엣 비는 **17.07배**(256/15) 로 G1 ±5% 를 넘지 못한다. 접지 y 는 **12px** 차로 G4 ±2px 를 넘는다. 지시서 기준 **전체는 실패**다. 다만 G4 클로즈업은 바퀴가 지면 원판·S 핀(모델 원점)에 붙어 있고, BB 원점이면 생길 5.14m 부양은 보이지 않는다.

## §0

- origin/main2 = `c6754bd70ee7113fe514dbf296123c4c017f809e`
- 브랜치 = `260825-gient` (오타 유지)
- base_ok = BASE_OK
- ahead at ACK = 0
- worktree = `C:/20.HDev/rtw-gient/repo`
- 기존 worktree(rtw-sync-s4-2 · rtw-hud-h1 · rtw-orchestrator) 미사용

## 감리 사실 검산

| # | 판정 |
|---|---|
| 1 | 일치. `apps/web/.env` 와 `.env.local` 모두 `VITE_RIDER_PROTOTYPE=glb` |
| 2 | 일치. `MapView.tsx` `specs` 에 `live-self` 와 peer 가 같이 push → `syncRiderGlbModels` |
| 3 | 일치. `glbModelLayer.ts` paint `model-scale` |
| 4 | 일치. 상수 하나 |
| 5 | 일치. `syncGlbLiveNametagMarker` / `.map-view__rider-nametag` |
| 6 | 일치. 소비처 4곳: `glbModelLayer.ts:38`, `rideCameraFraming.ts:27,30,156` |
| 7 | 일치. `riderRig.geometry.mjs` 「지면 y=0」, BB `[0, 0.2705, 0]`. 생성기 주석도 동일 |
| 8 | 일치. 변경 전 `RIDER_GLB_MODEL_SCALE = 1.15` |

## 측정 방법 (제품 코드 아님)

- Playwright + Firebase 에뮬레이터, 입문 Basic 1, 속도 5 후 일시정지, `tickTest=follow` 로 팔로우 끔
- 카메라 고정: zoom 19.0 · pitch 50 · bearing 90 · viewport 1280×900
- 야간 지도에서 GLB 실루엣이 안 잡혀, 측정 프레임에서만 다른 레이어 visibility none + `model-color` 틴트. 복원함
- 지면 그림자 원판은 origin 아래 픽셀을 키에서 제외

## 게이트

- G0 통과. before `[1.15,1.15,1.15]` / after `[23,23,23]`
- G1 실패. 15px → 256px = 17.07배. 원근+고정 카메라. 엔진 스케일은 G0 이 23
- G2 실패. before 바퀴 밴드 축퇴(8/15). after r=4.49. 샷 `g2-ratio.png` 는 사람+자전거가 한 덩어리로 커진 모습
- G3 통과. 세션 간 약 0.5m. 스케일이 경로 좌표를 바꾸지 않음
- G4 숫자 실패(12px). 시각적으로는 접지. BB 원점 부양은 아님
- G5 통과. 네임태그 17.11/17.11 · HUD 20.41/20.41 · 경로선 4/4 · 라벨 12/12 (road-intersection). 모두 0 아님
- G6 부분. 2 브라우저로 peer 모델 id 확인. 출발점 겹침으로 실루엣 76px/76px 동일. pair before 없음
- G7 통과. 제품 코드 `config.ts` 1 파일
- G8 통과. tsc 0 · eslint 0 · smoke green · ride-entry 5 passed
- G9 통과. `RIDER_GIANT_SCALE_FACTOR=1` 에서 G0=[1.15,…]·h=15px, 다시 20 으로 복귀. 그 확인은 커밋하지 않음

## 고치지 않은 지점

`glbModelLayer.ts` · `MapView.tsx` · `rideCameraFraming.ts` · `peerMotion/**` · `public/rider/**.glb` · `riderRig.*` 를 고치지 않았다. `RIDE_CAMERA_DISTANCE_*` 를 늘리지 않았다. main2 에 병합하지 않는다.

## 이견

G1 을 화면 픽셀 20.0±5% 로 묶으면, 고정 카메라+피치 50 원근에서는 실패가 기본값에 가깝다. 엔진 20배는 G0 로 이미 증명된다.
