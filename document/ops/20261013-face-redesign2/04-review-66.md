# 검수66~70 — 상단 카메라·맵 버튼 확대/줌순서

2026-10-15 Supervisor Codex. **APPROVED / Chief 확인 대기**. 이번부터원본 C:/20.HDev/boxcycle main2에서작업. Developer Cursor교대구현,다른dirty문서보존.

코드2파일: MapHud.tsx 맵버튼순서 style/확대+/축소−로교환. aria/title/disabled/onClick/pointer/touch콜백그대로. MapHud.css 기본·짧은화면·폰3구간에서카메라/줌/맵선택실제버튼높이·폭약20%확대(숫자font·색·기능유지). 맵선택은자연글자폭을감안해별도padding보정.

좁은폰<=740px/높이<=560px에서계기판이있으면카메라6개만한줄아래배치. 오른쪽4rem을비워기존맵트리거·세로지도컨트롤과간섭없음. 844/PC/계기없는화면기존한줄유지. 맵트리거/세로컨트롤위치·크기,계기판,다음주행카드불변.

독립검수:
- `node document/ops/20261013-face-redesign2/controls-66-qa.cjs` 최종exit0. 실제MapHud 및 실제MapView/Mapbox CSS의세로지도열DOM mock. Firebase/main/map서비스호출없이 원본main2서버5014재사용.
- 667×300/740×300/844×390/740×180/1024×360/1366×768 × active1/2/6·camera1 routeFit/aerial500/aerial20·줌각disabled·route-preview=48상태. 추가740계기없는화면은카메라position static확인.
- 모든카메라/맵선택/줌버튼전후높이+19.99~20.03%,폭+17.50~20.03%(맵선택자연폭차이;약20%요구범위). 폰740 카메라기본20.921875→25.109375px,active1 24.96875→29.96875px. font크기동일.
- 순서style/+ /−,disabled각동작,카메라1~6/맵선택/줌콜백,Enter/Space PASS. 기존44px세로hit확장보존. 모든상단버튼쌍/계기판/카메라와native지도열bbox겹침0,조작중심hit가림0,pageerror0. 740스크린샷시각확인완료.
- `npx eslint src/components/maphud/MapHud.tsx` exit0; `npx tsc -b --pretty false` exit0; `node scripts/ride-verify/verify-selectors.mjs` exit0(15계약); `git diff --check -- apps/web/src/components/maphud/MapHud.css apps/web/src/components/maphud/MapHud.tsx` exit0. source최종pre-commit통과.

수정이력/실패구분:66최초맵선택폭은폰+4.5%/PC+12.4%로목표미달,67/69padding보정. 667/740계기+긴계정에서24상태겹침→67카메라다음행. 67맵트리거이동이native지도열침범할수있어68기존맵트리거복원/카메라right3rem. 시각확인시camera6·맵트리거약3px겹침→70right4rem/모든버튼쌍교차검사추가. 검증fixture의Mapbox CSS설치경로오류는hoisted실제경로로고친뒤재검증. 최종48상태모두PASS.

코드커밋 **8f341a0 fix(hud): enlarge camera and map controls and swap zoom order**. 원본main2소스잔여dirty0. 실기기터치체감·실지도/BLE/실주행미검증. rootmain2용개발서버5014시작,기존face-redesign2/5013별도유지. push/배포없음.
