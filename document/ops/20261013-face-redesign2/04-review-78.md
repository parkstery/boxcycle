# 검수78 — 로마 콜로세움 주변을 실제 첫 지도 기본점으로

2026-10-15 Supervisor Codex. Developer Cursor session63f0c029-b3ef-4483-9bab-82b86777b9df exit0. 원본main2 HEADf20450a. 지시78/결과78/실제diff검수. **APPROVED / Chief 화면 확인 대기**. 사용자직접승인제품정책을결정로그한줄에기록.

## 정책과 범위

명시적지역(search/geolocation)이있으면그좌표/줌유지. 없으면[12.4922,41.8902]·줌15·위성보기. 마지막주행의서울종료점과다음주행카드자동등장은첫지도를덮지않는다. 카드의명시지도보기·이어달리기콜백보존(실제diff동일), 주행기록저장과서울실제데이터수정없음. mapBoot는저장/위치API호출없고viewport초기상태도부트중심을사용. 내부MapView폴백도같은상수로통일.

현재위치로사용하지않음: App idle에서liveForMap=null,MapView는liveLngLat없으면자기위치마커제거. fallback좌표를위치공유/지역저장/출발핀/경로로저장하지않음. 기존사용자가위치버튼으로허용/확인한지역은LocalFirstRegion으로복원. 새자동위치요청·권한프롬프트·IP추정없음. 직접검색해선택한지역도사용자탐색의사로존중한다.

## 독립 검증

- `node document/ops/20261013-face-redesign2/map-78-integration.cjs` exit0. **실제MapView/Mapbox WebGL엔진**으로5경우검증. 외부요청전부차단, 인증user와배경style만fixture. 새사용자800×360/667×300와서울기록보유자는Rome15; 위치공유저장부산129.0756,35.1796/13·검색저장파리2.2945,48.8584/14유지. 각경우현재위치마커0·geolocation호출0·dragPan/scrollZoom활성, 명시카메라파리이동후초기값재점프없음. 로마폴백의Satellite초기style요청확인. 결과map-78-shots/results.json.
- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/map-boot-center.test.ts` exit0,**6테스트PASS**. 서울주행저장보존상태·손상지역·search/geo·storage거부·배열변이및저장/위치호출없음검사.
- Supervisor `npm run build` exit0,423모듈. 기존번들크기/riderRig SADDLE·PELVIS export경고보존.
- Developer tsc exit0,4파일eslint error0/기존hooks경고15,selector18 PASS. 제품공백검사PASS.

지도엔진fixture첫시도는수정전중심이서울이라Romeassert실패(정상적으로변경전차이를검출). 수정후초기외부스타일미로딩및getStyle직후예외로실패하여검수용빈스타일을직접설치한뒤초기중심/줌/이동/마커검증을완료. 실제타일이표시됐다고보고하지않으며실Mapbox외부통신을허용하지않았다.

## 도로 구도 확인과 한계

초기800×360/줌15와같은Mercator범위[12.4836169312,41.8873246794,12.5007830688,41.8930751912]의공개수직정사영상을별도다운로드해직접열람(map-78-rome-zoom15.jpg). 가로약1.42km/세로약0.64km. 콜로세움형태와주변교차로·도로/시가지가함께보이며랜드마크만확대한구도아님. 이는도로구도참고영상이며제품에가짜노선/사진레이어/임의RTW경로추가없음. 실제RTW누적경로·서버데이터구조및조회경로불변. 로마축적경로가없으면있는것처럼만들지않음.

실Mapbox타일/실서버의로마경로유무·실기기·GPS·실주행미검증. 실시간지도자유탐색은Mapboxfixture에서확인. mapLodZoom은기존13초기값후기존지도LOD콜백으로실측값동기화(이번범위밖),지도실제줌15는검증완료. 인트로고정이미지와인증수정은그대로. 배포/푸시없음.
