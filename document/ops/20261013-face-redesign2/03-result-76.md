# 결과76 — 인트로 우측을 수직 위성영상 URL로 교체

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `d4d7ec0363e22e5c9e9d37a10816837b1778d57f`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시76 파일은 수정하지 않음. 기존 dirty 문서·75 변경·ops 증거는 유지. JPEG를 `public`에 복사하지 않음.

## 변경

- `apps/web/src/components/auth/AppIntroScreen.tsx`: `img.app-intro__photo`의 `src`를 상수 `INTRO_SATELLITE_SRC`로 바꿈. 값은 `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=12.4865%2C41.8875%2C12.4979%2C41.8929&bboxSR=4326&imageSR=3857&size=1600%2C1000&format=jpg&f=image`. `referrerPolicy="no-referrer"` 추가. `alt=""`, `aria-hidden="true"`, `fetchPriority="high"`, `loading="eager"` 유지. `onError` 없음. 주석을 「수직 정사투영 위성영상, 온라인 고정영역 이미지」로 고침. 로컬 사진이라고 하지 않음. `a.app-intro__credit` 문구 `Esri · Vantor · Earthstar Geographics · GIS User Community`, href `https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9`. `target`·`rel`·문구·CTA·`onStart`·포커스 스크롤은 유지.
- `apps/web/src/components/auth/AppIntroScreen.css`: 75의 사진 레이어·불투명 `#fdfcf9` 셸·그라데이션·CTA는 유지. 머리글의 「로컬 배포 자산」 문구를 같은 수직 위성영상 주석으로 교체. `.app-intro__credit`에 `max-width: calc(100% - 1rem)`, `white-space: normal`만 추가. 다른 wrap 속성은 넣지 않음.
- `apps/web/public/images/intro/rome-colosseum.jpg`(2,423,456 bytes)와 `rome-colosseum.LICENSE.txt` 삭제. 둘 다 75의 untracked 자산. `apps/web/public/images`에 남은 파일 없음. 대체 이미지를 `public`에 두지 않음.
- `apps/web/src/App.tsx`와 `apps/web/src/lib/map/appIntroMapView.ts` 삭제는 75 상태 그대로. 지도 API·카메라·회전·pitch·위치 제어는 추가하지 않음.
- `intro-76-source.json`, `intro-76-item.json`, `intro-76-satellite.jpg`, `intro-76-qa.cjs`는 ops에 그대로 둠.

`git diff --numstat` (HEAD 대비, 75+76 누적): `App.tsx` 0/12, `AppIntroScreen.css` 55/15, `AppIntroScreen.tsx` 23/4. `appIntroMapView.ts`는 tracked 삭제(`D`).

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS |
| `apps/web`에서 `npx eslint src/components/auth/AppIntroScreen.tsx` | 0 | PASS. 출력 없음 |
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 17단계 전부 유효 |

## 미실행·잔여

- 브라우저 fixture 주입, 5 viewport 캡처, 실패 시 하위 지도 차단, CTA 확인은 하지 않음. 지시가 그 검수를 Supervisor에 두었고 실네트워크 브라우저를 금지했다.
- `intro-76-satellite.jpg` 원본 픽셀과 ArcGIS export 응답은 이 턴에서 열거나 다운로드하지 않음. 원본 그림 확인은 Supervisor의 독립 다운로드이며, 이 결과의 정적 검증과 별개다.
- 이미지 로드 실패 시 불투명 cream 셸(`background: #fdfcf9`)은 CSS에 남아 있다. 로드 실패를 브라우저로 재현하지는 않았다.
