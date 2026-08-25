# G-2 REPORT — 260825-gient 라이더 400배(20배를 두 번) 시각 실험

지시서 `INSTRUCTION.md` 정본. 이 보고는 §8 과 같은 판정을 쓴다. G-1 보고는 `INSTRUCTION-G1.md`.

## 결론

제품 코드는 `RIDER_GIANT_SCALE_FACTOR = 400` → `RIDER_GLB_MODEL_SCALE = 460` 한 줄이다. 한 세션에서 paint 만 `[23,23,23]` ↔ `[460,460,460]` 로 토글했다. **G0 = 20.0 정확**. 엔진 스케일은 맞다.

G1' 역투영 비는 **18.53** (20±5% 밖). G4' 접지 y 는 **10 px** (한도는 2 px) — before 실루엣이 9 px 라 숫자가 축퇴한다. 클로즈업에서는 460배 바퀴가 S핀(원점)에 붙어 있다. G6' 는 월드 90 m 분리 뒤에도 화면에서 겹쳐 **미검증**.

## 게이트

- G0 통과. `[23,23,23]` / `[460,460,460]` · 비 20.0
- G1' 실패. H_before 38.01 m · H_after 704.27 m · 비 18.53 · 이분탐색 수렴. 자가 검산 HEAD_C×23 = 31.88 m — 실루엣 꼭대기(헬멧)라 38 m
- G2' 통과. before 303 px / 67 px · r=4.522 · after 387 px / 86 px · r=4.500 · 편차 0.50%
- G3' 통과. lngLat 동일
- G4' 숫자 실패(10 px). 시각적으로는 접지. before 전고 9 px 는 ±2 px 게이트에 부적합
- G5 통과. 네임태그 17.14/17.14 · HUD 20/20 · 경로선 4/4 · 라벨 12/12
- G6' 미검증. 분리 실패. 겹친 H 를 통과로 쓰지 않음
- G7 통과. 제품 `config.ts` 1 파일
- G8 통과. tsc 0 · eslint 0 · smoke 1 passed · ride-entry 5 passed
- G9 통과. factor=20 에서 paint `[23,23,23]`, 400 복원(커밋 안 함)
- G10 통과(렌더). 컬링으로 사라지지 않음. 콘솔 오류 27건(고유 404·401) · ActivityWorld 경고는 기존. WebGL 크래시 없음

## 카메라

400배 제품 follow zoom **16.42** (pitch 80, leftFlat). G4 토글은 zoom 14 · pitch 50 로 고정했고 토글 중 카메라는 그대로였다. `rideCameraFraming.ts` 는 수정하지 않았다.

## 고치지 않은 지점

`glbModelLayer.ts` · `MapView.tsx` · `rideCameraFraming.ts` · `peerMotion/**` · `public/rider/**.glb` · `RIDE_CAMERA_DISTANCE_*`. main2 에 병합하지 않는다.

## 이견

G1' 의 H 는 실루엣 꼭대기라 HEAD_C 31.9 m 와 어긋난다. 다른 zoom 에서 꼭대기를 재면 비가 20.0 에서 조금 빠진다. 엔진 20배는 G0 가 증명한다.

G4' 를 같은 카메라 zoom 14 로 묶으면 23배 전고가 9 px 가 되어 ±2 px 가 다시 축퇴한다. 클로즈업이 접지의 근거다.
