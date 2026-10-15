# 결과78 — 실제 첫 지도 기본점을 로마 콜로세움 주변으로

모델: Auto (Cursor agent router). branch `main2`. HEAD `f20450a05863`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시78 파일은 수정하지 않음. 결정 로그·ops 상태 문서는 건드리지 않음. 다른 dirty 파일은 되돌리지 않음.

## 변경

- `apps/web/src/lib/map/mapBootCenter.ts`: 폴백 중심 `[12.4922, 41.8902]`, `MAP_FALLBACK_ZOOM = 15`. `readLocalFirstRegion()` 이 search/geolocation 지역을 돌려주면 그 좌표·줌과 `source: "localFirst"`. 없거나 잘못됐거나 저장소가 던지면 콜로세움 줌 15, `source: "fallback"`. 반환 좌표는 상수·지역 배열의 복사본. `pickLastRide` / `loadRideSessions` 와 `lastRide` 소스를 제거했다. 이 함수는 지역을 쓰지 않고, geolocation 을 호출하지 않는다.
- `apps/web/src/App.tsx`: `mapBoot` state 를 `mapStyle` 보다 위로 옮겼다. `mapStyle` 초기값은 fallback 이면 `MAP_STYLE_SATELLITE`, 아니면 `DEFAULT_MAP_STYLE`. `mapZoom` 은 `mapBoot.zoom`. `mapViewportCenterLngLat` 초기값은 `mapBoot.center` 복사. 다음 주행 카드가 보일 때 재개 앵커로 카메라를 옮기던 `useEffect` 와 그 전용 `nextRideFramedRideIdRef` 를 제거했다. 카드의 `onResume` / `onExtend` / `onShowOnMap` / `onDismiss` 는 그대로다.
- `apps/web/src/components/map/MapView.tsx`: 내부 `DEFAULT_CENTER` / `DEFAULT_ZOOM` 이 `MAP_FALLBACK_CENTER` / `MAP_FALLBACK_ZOOM` 을 쓴다. `initialCenter` / `initialZoom` 이 유효하면 그 값이 우선인 기존 분기는 유지. 쓰이지 않게 된 `DEFAULT_MAP_ZOOM` import 만 뺐다. 강남 주석을 콜로세움 폴백 설명으로 바꿨다.
- `apps/web/scripts/map/map-boot-center.test.ts` 신규. `resolveMapBootCenter()` 를 storage mock 위에서 호출한다. 자동 카메라 점프를 직접 기대하는 기존 테스트는 없어서 다른 테스트는 고치지 않았다. `entry-contract.mjs` 의 next-ride-card 앵커는 `NextRideCard.tsx` 에 있고 이번 삭제와 겹치지 않는다.

`git diff --numstat` (HEAD 대비, 추적 파일): `App.tsx` +9/−30, `MapView.tsx` +6/−6, `mapBootCenter.ts` +14/−29. 신규 비추적: `scripts/map/map-boot-center.test.ts`, 이 결과 파일.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/map-boot-center.test.ts` | 0 | PASS. 6 tests, pass 6, fail 0 |
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS. 출력 없음 |
| `apps/web`에서 `npx eslint src/lib/map/mapBootCenter.ts src/App.tsx src/components/map/MapView.tsx scripts/map/map-boot-center.test.ts` | 0 | error 0. warning 15는 기존 `react-hooks/exhaustive-deps` (`App.tsx` 7, `MapView.tsx` 8). `mapBootCenter.ts` 와 신규 테스트는 지적 없음 |
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 18단계 전부 유효 |

회귀가 본 동작: 저장 없음 → Rome 15, 지역 키 미기록, geolocation 호출 0. `saveRideSessions` / `loadRideSessions` 로 서울 종료점 `[127.035, 37.505]` 가 저장소에 남은 상태에서도 Rome 15. 깨진 JSON·source 불일치·빈 이름·비유한 좌표는 Rome 15. search 줌 12·geolocation 줌 16.5 는 좌표와 줌 유지. `getItem` 이 던지면 Rome 15. 반환 배열을 바꾼 뒤 상수 `[12.4922, 41.8902]` 와 다음 지역 해석이 그대로다.

## 미실행·잔여

- MapView props fixture 로 Rome / 명시 지역 우선 / 과거 주행 비덮어쓰기 / idle `liveForMap = null` 마커 없음, 공개 정사영상으로 도로 범위를 보는 일은 지시대로 Supervisor 몫이다. 브라우저·서버는 실행하지 않았다.
- `mapLodZoom` 초기값은 기존 `DEFAULT_MAP_ZOOM`(13) 이다. `mapZoom` 만 부트 줌을 쓴다. `showAppIntro` 의 고정 수직 위성 이미지는 바꾸지 않았다.
- 카드의 「지도에서 보기」·「이어 달리기」가 카메라를 옮기는 기존 콜백은 App 마운트 없이 재실행하지 않았다. 자동 점프 effect 만 제거했다.
