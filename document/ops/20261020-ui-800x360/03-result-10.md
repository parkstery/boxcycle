# 결과10 — 경로보기와 독립 주행바

2026-10-21 Supervisor Codex. Chief가 승인한 제안 구현. OpenCode DeepSeek v4.1 Flash/GLM5.3 Flash를 실제 호출했으나 각각 약5분간 조사만 해 중단했다. 공식 session.interrupt=true 확인.09는 Cursor Composer2.5(session ba93f75c-5b14-4bcb-b474-665bcfb62088, exit0)가 구현,10은 Supervisor 직접 구현. [교대09](03-handoff-09.md)·[교대10](03-handoff-10.md). 완료되지 않은 모델 작업을 성공으로 보고하지 않는다.

## 제품 변경

- 경로생성: 출발·도착/거리·방향 탭 중 하나만 보임. 출발/도착 한글, 경유지+한개로추가·최대3유지. 좌표/고도 자세히. 탭28px·수단28px+명시생성28px 한행. 공통수단선택은API호출없고 실제생성만기존콜백. 탭에서거리모드활성/해제와수동생성버튼잠김·출발미설정안내 조건을 Supervisor가 재검수/교정.
- 수단선택/방향대기 준비는이미생성된경로의프로필/공식연결을바꾸지않음. 실제생성결과에서만기존적용콜백이변경. 경로API·토큰·서버정책불변.
- RouteDock은주소전용.24px행,출발도착2개170×54px,경유지3개추가시170×126px,내부스크롤없음·단일면. 기존주행/센서/재개선택CSS를제거.주소접기와주행바독립.
- RideControlBar는우하단시계위,34px한줄.경로없음센서만/준비수단표시+센서+시작/주행수단+rpm+일시정지+종료/일시정지재개+종료.이어달리기·처음부터·포기는필요할때보조팝오버. 기존중앙일시정지재개·종료창/스크림제거,경로변경은일시정지옵션에보존.
- 센서슬롯한군데,주소캐럿LED·우상단폴백없음.기존센서시트/수동선택·준비/단절정책·BLE훅그대로.경로없이접근가능. 결과에서는바없음,결과닫기후idle센서만. NextRide카드는센서바위에충돌없이배치.
- 기존팝업예약영역에바추가,에지시작은바조작에양보. resize 이벤트보다 pointerup이먼저도착하는경합은시작viewport크기와끝크기비교로취소. 주행중지도중앙pan·비노출에지유지.

## 면적 및 검증

800×360 준비fixture 실컴포넌트: 주소170×54=9,180px² + 주행바163.109×34=5,545.719px², 합14,725.719px²(5.113%). 이전통합도크175.25×85=14,896.25px²(5.172%)보다약1.1%감소. 분리때문에상시가림총면적이늘지않음. 실제폰/브라우저폰트에따른차이는실기기검수대기.

실행폴더 C:\20.HDev\boxcycle\apps\web.

- selector19, 관련계약4파일39/39 PASS. 팝업관련Node계약52/52 PASS(Cursor의거리전체142/142도확인). 변경소스tsc/build PASS. 전체lint오류0/기존37경고,dev-tools/diffcheck PASS.
- Playwright route-ride-controls + ui-800x360 최종20/20 PASS(exit0,51초), 800×360/667×300/844×390. 실제생성DOM모드배타·선택무생성/명시생성·경유지최대/주소높이·센서단일/주소접기독립·pause/resume/end·큰수치·에지/취소/resize. 짧은주행종료후시작재노출금지·새경로토큰에서다시노출도검증. fixture지도는SVG배경,실Mapbox와구분.
- 최초구형시험은옛클래스·우하단버튼영역스와이프좌표로실패. 새앵커/지도띠155px로변경. 별도Windows npm서버teardown timeout발생해 기존서버5025재사용으로전환하고 exit0확인. 추가중앙재개중복은제품에서제거.
- 기본sandbox test-quick은1,320PASS/3FAIL(도구watchdog가자식종료/생존검사를실행못함). 제품묶음은오류0. 정상권한pre-push결과는감리에후속기록,실패를성공으로취급하지않음.
- 실지도시험첫실행은기존ride-entry의숨은메뉴마우스click이실패,focus/Enter로시험수정. 중첩Windowsgrep따옴표오류는파일:행선택으로교정. 다음실행진입1PASS/실지도1FAIL(바·시계2.2px겹침)→공통하단패딩교정후재실행. 최종결과는감리10기록.
- 최종실지도+진입2/2 PASS(exit0,에뮬레이터포함165.6초). 거리100m미만은기존정책상결과시트없이버려지므로,결과시트시험은수동속도30km/h·누적0.11km초과후종료하도록교정. 제품에는종료한경로토큰을기억시켜짧은종료에서도시작재노출을막음. 기록저장정책/인증은수정없음. 정상종료→결과닫기→센서만노출/주소0도통과.
- 최종변경후selector19·관련Node65/65·변경파일eslint·tsc PASS. 루트 npm run build PASS(index-7A29VczA.js/index-Cj3WzBDE.css). 기존SADDLE/PELVIS export·대형번들경고는별도이슈로보존.
- 캡처 .out/ui-route-ride-20261021/bar-*.png, popup-*.png. 실지도 .out/ui-edge-20261021/actual-*.png/actual-geometry.json. 운영인증/주행쓰기없이로컬에뮬레이터에서만검증. 실제Galaxy/BLE/외부실센서미검증.

현재기능브랜치 feat/route-ride-controls-20261021,미관련기존ops/evidence/cdbox/.out보존.커밋/푸시/배포성공은후속릴리스증거로구분한다.

직접확인:
```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```
http://localhost:5000 → 800×360 → 지도지점선택/두탭전환→경로생성→우하단센서/시작→주소접기→일시정지/재개/종료.배포주소는릴리스증거확인후사용.
