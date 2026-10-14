# 감리15 — HUD 노란 강조·첫 라이딩 안내창

1차통합후Chief추가지시. Developer Muse Spark1.3 exec97736 exit0. worktree face-redesign2(코드8fdedae)에서추가미커밋작업. 허용2CSS만diff:MapHud.css4color치환,LocalFirstEntryCard.css11줄추가. TSX/로직/다른UI무변경. main2·원격코드는이번에변경하지않았다.

HUD: hero/cumulative값·새도로라벨/값을#FACC15로. 실제React MapHud localprops로riding/paused/route-preview×3뷰포트검수(지역카드검수와합계12조합). riding/pausedcomputed누적거리·새도로라벨/값rgb(250,204,21)확인. 전체경로목표값/시간/평균/속도/단위색보존. HUD전요소rect/fontSize/textShadow전후동일. route-preview기존파랑보존. 실제주행/센서/다중라이더실행검증아님.

첫안내:정확한문구'어디에서 첫 라이딩을 할까요?'만13.5px→12.1667px(1pt=1.3333px감소). 지역미선택prompt하단입문경로행min-height44→22,padding절제. 현재위치/지역선택버튼44px기능/폰트유지. 지역선택후S1카드rect와font전후동일,Ready상태별별도실행미검증이나scope상prompt직계제목있는경우에만적용.

실제앱freshGuest첫안내(supervisor-view.cjs first,800x360)exit0/pageerror0:높이124.44→100.44px(24px감소),overflow0. mock컴포넌트에서도800x360/740x300/667x300동일높이감소/overflow0. 실제앱afterPNG직접확인. mockHUD+promptafterPNG직접확인. 증거followup-15-live/및followup-15-shots/results.json·PNG. mock콜백과실제앱을구분한다. Geolocation/실제경로생성/입문로드실행없음.

정확한target apps/web cwd tsc -b --pretty false 및git diff --check exit0. Musediff-check도출력없음. commit/push/merge/deploy/서버조작/사용자관찰탭조작없음. 실기기터치미검증. 5013에서Chief추가확인대기.
