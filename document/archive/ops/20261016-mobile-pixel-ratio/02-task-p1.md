# 지시 P1 — 고밀도 화면 렌더 해상도 상한

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-dpr` (브랜치 `perf/mobile-pixel-ratio`, 기준 `main2` `4109f2c`) |
| 결과 파일 | `C:\20.HDev\boxcycle-dpr\document\ops\20261016-mobile-pixel-ratio\03-result-p1.md` |

## 배경 (운영 perflab 실측)

폰(갤럭시, Adreno 730, `devicePixelRatio` 3, 699×273 CSS px) 가까운 줌: 프레임 31.8 ms 중 JS 21.5 ms, **계산 밖 대기 10.3 ms**(GPU·합성 추정). 지도는 DPR 3 으로 2097×819 픽셀을 그린다. PC(DPR 1.25)는 GPU 3.5–7.2 ms 로 여유.

## 할 일

1. `apps/web/src/components/map/MapView.tsx` 1114행 부근 `new mapboxgl.Map({...})` 에 **`pixelRatio`** 옵션을 준다: `Math.min(window.devicePixelRatio || 1, RIDER_MAP_MAX_PIXEL_RATIO)`, 상수 `RIDER_MAP_MAX_PIXEL_RATIO = 2` 를 적절한 설정 모듈 한 곳에 둔다(새 lib 파일이면 `apps/web/dep-layers.json` 등록 필수).
2. 비교용: `?maxdpr=<숫자>` 쿼리(운영 포함, 1–4 범위, 없으면 상수)로 상한을 바꿀 수 있게 — perflab 측정 비교용. 페이지 수명 동안 한 번 읽어 캐시.
3. 화면 회전·창 크기 변경 시에도 상한이 유지되는지 확인(Mapbox 는 resize 때 pixelRatio 를 다시 읽을 수 있음 — `map.setPixelRatio` 가 있으면 resize 이후에도 상한을 강제). 지도 위 3D 라이더 레이어(three.js, 지도 GL 컨텍스트 공유)는 지도 캔버스 해상도를 따르는지 확인.
4. perflab 기기 정보에 실제 적용된 pixelRatio(`map.getPixelRatio()`)를 한 줄 추가.

## 시험

- 상한 계산 함수 단위 시험(DPR 1 → 1, 1.25 → 1.25, 3 → 2, 쿼리 4 → 3(DPR 3 이면 3), 잘못된 쿼리 → 상수).
- `npx tsc --noEmit -p tsconfig.app.json`, 변경 파일 eslint, **저장소 루트 `node scripts/check-dep-direction.mjs --check` 에서 "lib 파일 전원 도메인 지정 PASS(미지정 0)"** 확인(M0 의 `functions/lib` 부재 실패는 worktree 환경), `npm run test:quick`(route 3건 `functions/lib` 부재 외 0), `npm run test:rider-preserve`, `npm run build`. 모든 npm 은 **PowerShell** 에서.
- 브라우저: 헤드리스 1회(dev 서버 포트 5070, `deviceScaleFactor: 3` 컨텍스트로 `?perflab=1` 열어 지도 캔버스 `width/height` 가 CSS 크기 × 2 인지 확인), 끝나면 서버 종료.

## 금지

DPR ≤ 2 기기 동작 변경, 지도 스타일·카메라·라이더 로직 변경, commit · push · 배포, 백그라운드 잔류.
