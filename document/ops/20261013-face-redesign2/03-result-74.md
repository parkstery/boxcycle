# 결과74 — 인트로 배경을 로마 콜로세움 위성 지도로

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `1f5f14dbbfa025097492592ff0ccf2c45fc322ad`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시74 파일은 수정하지 않음. 기존 dirty 문서·증거는 유지.

## 변경

- `apps/web/src/lib/map/appIntroMapView.ts` 신규. `createAppIntroMapView(viewportWidth)`만 계산한다. Colosseum 중심 `[12.4922, 41.8902]`, zoom 16. 유한 양수 폭만 쓰고, 아니면 800. `lng = 12.4922 - (width * 0.26 * 360) / (512 * 2**16)`, `lat = 41.8902`. 반환 `{ lngLat: [lng, lat], zoom: 16 }`. 주석에 Colosseum을 screen-right(약 76%, 카메라만 서쪽)로 두는 의도를 적었다. `APP_INTRO_MAP_STYLE`은 `rtwMapConfig`의 `MAP_STYLE_SATELLITE`와 같은 값이다. 이미지·지도 인스턴스·외부 API·토큰·데이터 모델·MapView props 없음.
- `apps/web/src/App.tsx` `showAppIntro` 바로 다음에 `useEffect([showAppIntro])`. `false`면 return. `true`일 때만 `createAppIntroMapView(window.innerWidth)` 후 `setMapStyle(MAP_STYLE_SATELLITE)`, `setMapZoom(view.zoom)`, `cameraJumpSeqRef` 증가, `setExternalCameraJump({ ...view, requestId })`. 기존 `externalCameraJump` 전달은 그대로다. 소개가 꺼져도 스타일·카메라를 되돌리지 않아 인증 선택에 로마 위성이 남는다. `showAppIntro`가 거짓인 로그인·명시 로그아웃·탈퇴 안내(`account-deleted`)·busy·서명 중·error에는 효과가 실행되지 않는다. `mapBootCenter`·지역 저장·경로·검색·로그인은 건드리지 않음.

`git diff --numstat`에서 추적 파일은 `apps/web/src/App.tsx` +12/−0. 신규 `appIntroMapView.ts`는 untracked.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS |
| `apps/web`에서 `npx eslint src/App.tsx src/lib/map/appIntroMapView.ts` | 0 | PASS. error 0. warning 7은 기존 `App.tsx` exhaustive-deps(715, 1178, 1215, 1231, 1273, 1354, 2852). 이번 effect·신규 파일 경고 없음 |
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 17단계 전부 유효 |

## 미실행·잔여

- 브라우저, 개발 서버, 실앱 소개→인증 카드 회귀, 위성 타일 요청, production build는 미실행. 지시는 그 검수를 Supervisor에 두고, 외부 지도 요청 실검수를 이번 턴에서 하지 말라고 했다.
- 화면 오른쪽 76% 프레이밍은 위 수식만 구현했다. 뷰포트에서 콜로세움 픽셀 위치는 확인하지 않았다.
