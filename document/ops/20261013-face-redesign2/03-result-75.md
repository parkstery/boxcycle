# 결과75 — 인트로 우측을 고정 콜로세움 사진으로 교정

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `d4d7ec0363e22e5c9e9d37a10816837b1778d57f`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시75 파일은 수정하지 않음. 기존 dirty 문서·증거와 과거74 ops·검수 스크립트는 유지. 사진 파일은 생성·다운로드·교체하지 않음.

## 변경

- `apps/web/src/components/auth/AppIntroScreen.tsx`: `img.app-intro__photo` 추가. `src="/images/intro/rome-colosseum.jpg"`, `alt=""`, `aria-hidden="true"`, `fetchPriority="high"`, `loading="eager"`. 기존 `__map-reserve` 제거. 우하단 `a.app-intro__credit`로 대체. 문구 `Photo: Aeroshot.it · CC BY-SA 4.0`, href `https://commons.wikimedia.org/wiki/File:Foto_aerea_del_Colosseo.jpg`, `target="_blank"`, `rel="noopener noreferrer"`. 설명 주석을 고정 로컬 사진으로 갱신. 문구·CTA·`onStart`·포커스 스크롤은 유지.
- `apps/web/src/components/auth/AppIntroScreen.css`: `.app-intro` 배경 `#fdfcf9`, `pointer-events: auto`. 사진 `absolute` `top/right/bottom: 0` `left: 32%` `width: 68%` `height: 100%` `object-fit: cover` `object-position: center` `z-index: 0` `pointer-events: none`. `::after`는 기존 좌측 포슬린 gradient, `inset: 0`, `z-index: 1`, `pointer-events: none`. `__scroll`과 `__credit`은 `z-index: 2`. 스크롤 `bottom: calc(44px + safe-area)` 유지. 출처 배지는 우하단, `min-width/min-height: 44px`, `font-size: 0.75rem`. CTA 폭 180px·폰트·short-height·reduced-motion 유지. 우측 클릭 통과 없음.
- `apps/web/src/App.tsx`: `createAppIntroMapView` import와 `showAppIntro` 직후 `useEffect`만 제거. `mapBoot`·`mapStyle`·`externalCameraJump`·소개 조건·CTA·인증은 변경하지 않음.
- `apps/web/src/lib/map/appIntroMapView.ts` 삭제. 제품 소스(`apps/web` `*.ts`/`*.tsx`)에서 남은 참조 없음.
- `apps/web/public/images/intro/rome-colosseum.LICENSE.txt` 신규. Title Foto aerea del Colosseo, Author Aeroshot.it, Date 2017-08-19, Commons 파일 페이지·원본 URL, CC BY-SA 4.0, 원본 바이트 불변·표시는 CSS crop/gradient, 라이선스는 사진에 적용.
- `apps/web/public/images/intro/rome-colosseum.jpg`는 이미 있던 untracked 파일을 그대로 둠.

`git diff --numstat`: `App.tsx` 0/12, `AppIntroScreen.css` 53/15, `AppIntroScreen.tsx` 18/4. `appIntroMapView.ts`는 tracked 삭제(`D`). LICENSE와 jpg는 untracked.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS. 삭제 후 재실행 |
| `apps/web`에서 `npx eslint src/App.tsx src/components/auth/AppIntroScreen.tsx` | 0 | PASS. error 0. warning 7은 기존 `App.tsx` exhaustive-deps(714, 1177, 1214, 1230, 1272, 1353, 2840). 줄 번호는 이번 삭제분만큼 이동. `AppIntroScreen.tsx` 경고 없음 |
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 17단계 전부 유효 |

## 미실행·잔여

- 브라우저, 개발 서버, 800×360 및 667×300/740×300/844×390/1366×768 캡처, 사진 `naturalWidth` 1920, 콜로세움이 화면에 보이는지는 확인하지 않음. 지시가 그 검수를 Supervisor에 두었다.
- 소스 경로와 CSS만 구현했다. 이 결과만으로 사진 구현 PASS가 아니다.
