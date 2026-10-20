# 구현03 중간 감리 메모 — 최종결과 전 잠정

2026-10-20 Supervisor. Developer가 아직 쓰는 중인 파일의 잠정관찰이다. 최종diff에서 재확인하며 이 문서를 완료판정으로 쓰지 않는다.

- 독립 Playwright `npx playwright test ui-800x360 --grep '지표가 읽히고|시작·센서' --workers=1 --reporter=line`: exit0,2PASS.800×360긴값의계기판이제y61..117,우상단y11..41로겹침해소.시작한줄·도크타깃44·시작정지재개결과통과. 캡처 .out/ui-800x360/after-interim-riding.png.
- EdgePanelHandle 초안: 키보드 Enter/Space는 onClick으로 오지만 현재onClick은억제만하여열리지않음. 반대방향/짧은드래그에서 dragged=false이면onPointerUp이onOpen하므로의도치않은열기위험. 취소/lostcapture후생성click억제와멀티터치/resize정리도실제확인필요. 속도판정에최소의도거리필요.
- usePanelHeaderCloseDrag 초안에는lostpointercapture·resize정리가없음. 드래그중capture상실이후다음입력이잠기지않는지확인.
- useDialogFocus 초안은첫focus/복원만하고Tab trap없음. 숨은항목제외/순환·nested모달Escape우선순위필요. 메뉴닫기후트리거복귀와목록닫기후메뉴복귀회귀추가.
- standalone좌측핸들64px높이/세로중앙은낮은화면의RouteDock과겹칠가능성. 실제 App에서미니맵·Mapbox나침반/지구본/검색·도크와양쪽핸들의교차/elementFromPoint검사필요. fixture에는실Mapbox컨트롤이없음을주의.
- 상단카메라/스타일/줌/계정기존작은타깃은도크만커져도남음.44px일반원칙과기존승인예외를구분해실제타깃측정,667폭에서겹침없이배치해야함.

운영읽기smoke추가: 800×360공개사이트 titleSpinatlas·게스트로시작/로그인표시·수평overflow없음. 클릭/인증/주행쓰기는안함.
