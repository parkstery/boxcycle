# 검수76 — 콜로세움 수직 위성영상

2026-10-15 Supervisor Codex. Chief의 수직위성영상 지시에 따라75조감도사진대체. **APPROVED / Chief 화면 확인 대기**. 최종 제품 diff는App.tsx의74카메라effect/import제거, appIntroMapView.ts삭제, AppIntroScreen.tsx/css의불투명고정이미지레이어와영상출처표시. 인증/CTA·주행·기타dirty유지.

## 영상 및 직접 확인

공개 World Imagery 고정영역 export JPEG1600×1000. bbox[12.4865,41.8875,12.4979,41.8929], EPSG3857 정사투영. 공개서비스단일HTTP GET으로 받은 intro-76-satellite.jpg를 view_image로 직접 열어 수직콜로세움·주변도로확인. 사진에는 지평선·기울어진시선의조감구도없음. 앱은동일고정URL을img로표시하며 실시간지도/좌표/토큰과무관. referrerPolicy no-referrer, 출처Esri/Vantor/Earthstar/GIS User Community표시및공급자페이지링크.

서비스 metadata intro-76-source.json, intro-76-item.json보관. 이레이어는offline tile export용이아니므로이미지를public배포하지않고온라인정적영상으로표시한다. 이전Aeroshot사진/CC라이선스파일public삭제확인. ops다운로드영상은검수증거이며배포자산아님.

## 독립 검증

- `node document/ops/20261013-face-redesign2/intro-76-qa.cjs` exit0. 브라우저외부요청은샌드박스차단되므로 **동일서비스에서직접다운로드한JPEG응답을fixture로주입**. 실제앱667×300/740×300/800×360/844×390/1366×768 다섯뷰포트에서natural1600×1000·고정영역URL·no-referrer·object-fit cover·CTA44px·가로넘침0·하위지도차단PASS. credit44px및출처, CTA→기존인증카드PASS. 영상요청실패abort후불투명cream/pointer auto확인하여서울지도노출없음PASS.
- 캡처 intro-76-shots/800x360.png,667x300.png 직접열람: 콜로세움수직형태가우측에표시됨확인. 원본다운로드확인과브라우저fixture검수를구분하며, 브라우저외부통신전체허용/이전거부우회없음.
- Supervisor apps/web `npm run build` exit0,422모듈. 기존riderRig SADDLE/PELVIS export·번들크기경고, plugin timing경고있음.
- 제품diff 공백검사PASS. Developer session d69406ce-4d1c-49bc-968d-516016bd1efd exit0, tsc/변경TSX lint/selector17 PASS. Supervisor selector17·App/Intro eslint exit0(기존hooks경고7)도독립확인.

증거 intro-76-shots/results.json 및캡처, intro-76-qa.cjs. 실기기·실인증·실주행미검증,배포/푸시없음. 온라인이미지라공급자네트워크필요; 실패시서울이나조감도폴백없음. 참고:75/74검수script는역사기록이며현재수직영상검증은76하네스사용.
