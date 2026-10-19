# 결과12 — 최초 콜로세움 지역 표시

2026-10-17. Codex 직접 교정. main2 @ 0936cfe, 지시07~11 등 기존 dirty 보존. Chief가 초기 지구본을 폐기하고 기본 지역을 바로 보여 달라고 명시했다. 커밋·푸시·배포 없음.

## 변경

- MapView 생성자가 처음부터 `center: bootCenter, zoom: bootZoom`을 사용한다. App 초기값은 기존 콜로세움 주변 `[12.4905,41.8902]`, zoom15. 일반 motion에서도 지구본 zoom0.6을 거치지 않는다.
- 첫 위치 결정 후 카메라 effect는 대기/지구본 줌 조건/3500ms fly를 제거하고 직접 `jumpTo`한다. 이미 콜로세움이면 그 위치 유지, 위치 허용이면 현재 좌표로 바로 이동. 수동 지도 조작·검색/주행의 명시 이동 취소 계약은 보존.
- 사용하지 않는 BOOT_GLOBE 세 상수와 bypass ref 제거. 인트로·권한 UI·인증·수동 지구본 버튼은 변경 없음. 제품 결정 로그 최신 행 추가.
- 기존 카메라 시험은 zoom15에서 목적지 jump를 검증하도록 갱신. 실제 MapView 생성자 AST의 center/zoom 인자도 검사. Edge DOM시험의 실제 Mapbox 초기값도 콜로세움zoom15로 바꾸고 첫 위치결과 후 한국 좌표/zoom15 도달을 확인한다.

## 검증

폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | exit | 결과 |
|---|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` | 0 | 33 PASS |
| `node --test scripts/identity/entry-location-dom.test.mjs` | 0 | Edge 실제 native 위치결과→실제 Mapbox 카메라, 최초 콜로세움zoom15/한국목적지zoom15 PASS. 위치 권한/좌표는 테스트 context 지정 |
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 19단계 PASS |
| `npx.cmd eslint src/components/map/MapView.tsx src/lib/map/mapBootCenter.ts scripts/map/entry-location-camera.test.mjs scripts/identity/entry-location-dom.test.mjs` | 0 | 오류0, MapView 기존 hook 경고8 |
| `npm.cmd run build` | 0 | 타입·Vite PASS, 기존 큰 청크/SADDLE/PELVIS 경고 |
| `git diff --check` | 0 | 공백 오류 없음, LF→CRLF 안내만 |

기존 실제 앱 http://127.0.0.1:5180 에 fresh Edge context/740×300으로 접속(인트로 버튼 클릭 없음): `__RTW_MAP__.getZoom()=15`, center `[12.4905,41.8902]`, 인트로 게스트/로그인 표시를 직접 확인했다. 즉 인증·위치 선택 전부터 기본 카메라가 로마 지역이다. 샌드박스의 실제 위성 타일 요청은 `api.mapbox.com net::ERR_NETWORK_ACCESS_DENIED`로 차단되어 첫 일반 캡처는 배경 검정이었다. 로컬 단색 스타일 시험은 카메라 검증이며 실제 타일 외관 성공으로 혼동하지 않는다. 실기기 GPS·실제 권한창 사람 클릭은 미검증.

추가 실제 타일 검수: 읽기 전용 브라우저의 네트워크 권한을 확대한 재실행은 자동심사를 통과했지만 `loaded()` 25초 대기가 timeout(exit1)했다. 반복하지 않았다. 초기 좌표·줌 검증 PASS와 타일 로드 외관 미검증을 분리해 보고한다.

## Chief 확인

현재 같은 폴더의 5180 서버를 사용 중이면 http://127.0.0.1:5180 을 새로고침한다. 별도 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 → 인트로부터 콜로세움 주변 지도 확인 → 게스트/로그인 → 위치 선택 대기 중에도 콜로세움 유지 → 위치 사용/브라우저 허용 시 현재 위치로 직접 이동. 지구본 축소·대기·확대 연출이 나오면 실패. 운영 배포는 하지 않았다.
