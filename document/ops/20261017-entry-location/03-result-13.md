# 결과13 — 1초 현재 위치 비행

2026-10-17. main2 @0936cfe, 지시07~12 등 기존 dirty 전부 보존. Chief 지시로 OpenCode GLM-5.3(`opencode/glm-5.3-flash-free`) 실행 세션 `ses_eb5eecee2ffe7ks1XaWtPC7DFU`. 첫 실행은 지시/README 읽기 후 `Rate limit exceeded`, exit1. 약30초 후 동일세션 1회 재시도도 같은 오류 exit1. GLM 파일 변경 없음. 반복 호출을 중단하고 Codex가 직접 구현·검증한 예외다. 모델 사용 성공으로 보고하지 않는다. 커밋·푸시·배포 없음.

## 구현

- `MapView.tsx` 최초 생성자 콜로세움zoom15 유지. 첫 위치 목적지가 다르면 `flyTo` duration1000/curve1.42/essentialfalse로 한 번 비행. 같은 위치는 no-op. reduced motion은 jumpTo.
- `mapBootCenter.ts`에 `ENTRY_LOCATION_FLIGHT_MS=1000` 추가. 2초로 늘리지 않았다.
- 비행 중 이전 HUD 줌의 지연 style.load/rAF가 카메라를 덮지 않도록 기존 suppressCameraFollowUntilRef를 1100ms 적용하고 지연 callback에서도 재확인한다. 사용자 제스처/명시 카메라 이동 취소 기능 유지. UI·권한·인증·외부 API·위치 저장 변경 없음.
- 기존 카메라/DOM시험 확장. 별도 도구·제품쿼리 없음.

## 검증

작업 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | exit | 결과 |
|---|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` | 0 | 36 PASS |
| `node --test scripts/identity/entry-location-dom.test.mjs` | 0 | 실제 Edge155/Mapbox 비행·native 위치결과·legacy1회요청 PASS |
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 19단계 PASS |
| `npx.cmd eslint src/components/map/MapView.tsx src/lib/map/mapBootCenter.ts scripts/map/entry-location-camera.test.mjs scripts/identity/entry-location-dom.test.mjs` | 0 | 오류0, MapView 기존 hook경고8 |
| `npm.cmd run build` | 0 | 타입·Vite PASS. 기존 큰청크/SADDLE/PELVIS 경고 |
| `git diff --check` | 0 | 공백오류 없음, LF→CRLF 안내만 |

실제 카메라 [측정JSON](evidence/13-entry-flight-metrics.json): 초기 로마 `[12.4905,41.8902]` zoom15 → 장거리 이동 중 최저 zoom **2.0299** → 서울가상좌표 `[126.978,37.5665]` zoom15. 요청1000ms, 실측 **1006.8ms**, 중간 move샘플 **101개**. 줌이 내려갔다 다시 올라오는 순서·중간 경도·최종점·0.7~2초 종료를 assert했다. 첫 지도를 낮은 줌으로 시작하지 않는다. node 회귀에서 같은 위치 no-op/reduced jump/반복실행 방지/예약된style.load·rAF의 중단 방지도 확인했다.

브라우저 시험은 실제 hook/dialog/native 위치결과와 실제 Mapbox 엔진에서 MapView의 제품effect를 추출해 실행한다. 전체 App 인증·실지도 타일 외관·폰 성능/체감 검수는 아니다. 권한과 가상서울좌표는 Playwright context로 지정한다. 단색 로컬 스타일·토큰 없음으로 기존 Mapbox 인증경고가 발생하며 타일성공으로 보고하지 않는다. 1초의 실제 시각적 체감은 Chief 화면 확인이 남아 있다.

## Chief 확인

기존 동일폴더 5180 앱이면 http://127.0.0.1:5180 새로고침. 별도 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 → 첫 콜로세움 주변 지도 → 게스트/로그인 → 위치 사용→브라우저 허용 → 로마 상공으로 빠르게 상승·목적지 이동·내 주변 줌인(약1초). 동작 줄이기가 켜져 있으면 즉시이동이 정상. 기본 위치 선택은 비행 없이 로마 유지. 이미권한허용이면 자동 위치결과에 같은비행 적용. 위치허용 전 권한을 묻기로 초기화하면 첫버튼부터 재확인 가능.
