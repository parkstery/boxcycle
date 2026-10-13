# 감리11 — 맵 뷰 하단 빈 공간 제거

판정: 요청한 빈 공간 제거 검수 완료, Chief 사용 확인 대기. 대상은 정확히 첨부 '맵 뷰' 창. 경로 생성창·계정창이 아니다.

Developer Muse Spark1.3, exec98061 exit0. target face-redesign2의 MapViewSheet.css에서 max-height560px 미디어쿼리 .map-view-sheet align-items:stretch→flex-start 한 선언만 변경. 전후 snapshot diff 확인. 폭/위치/컨트롤/폰트/색/기능 수정 없음. min-height/고정높이 추가 없음.

독립 실제앱 headless 검수(supervisor-view.cjs map; 각exit0/pageerror0):

| viewport | 패널 전→후 w×h(px) | 높이 절약 |
|---|---|---|
|800x360|229.50×349.22→229.50×227.02|122.20px(35.0%)|
|740x300|229.50×289.22→229.50×227.02|62.20px(21.5%)|
|667x300|229.50×289.22→229.50×227.02|62.20px(21.5%)|

세뷰포트 모두 geometryDifferences는 panel 한 요소의 높이/scrollHeight만: 내부 모든 요소의 좌표/크기 그대로. clientHeight225=scrollHeight225,clientWidth228=scrollWidth228,불필요스크롤없음. 800x360 afterPNG직접시각확인:슬라이더바로아래정상padding만남음. 캡처·JSON:map-11-shots/。확인한화면에서패널점유27.83%→18.09%(800x360),740x30029.90%→23.47%。

별도 기능시험 map-11-function/：카메라free선택/줌한단계확대/닫기/재열기 실제앱실행. 정확한앱cwd에서tsc -b --pretty false 및git diff --check exit0. Muse최초&&명령은PowerShell파서오류로미실행,후속단독diff-check출력없음으로통과,실패숨기지않음.

사용자관찰탭조작/실제로그아웃/탈퇴/commit/push/deploy없음. 실제스마트폰터치·안전영역·주행상태별거리슬라이더별도미검증. 기존작은터치표면은이번단일요청에서변경않았으므로전체모바일UI규약PASS아님.
