# Supervisor 검수 — 반복 상대진동, 원인 미확정

Codex · 2026-10-05. Chief 증상 정정: 초당 여러 번, 1m 이내 상대간격 소진동. 기존 FS공백의 드문 수m snap과 같은 증상으로 취급하지 않는다. 이미 확인한 창 간 순서동기화 유지.

실제 첨부21KB 로그 읽기/32코드추적 검수: max28.83는 누적최대, back0은 world거리역행없음일 뿐 상대간격진동 부정이 아님. 5km/h=약1.39m/s에 max28.83는 비정상프레임 기록이지만 발생시각/회수없어 주기진동원인미확정. pt10은 spectator 별도1Hz갱신의낡은시각 진단, Registry시계고정 증거아님. 경로끝정지 구간과주행구간구분.

32의 계단peer vs 연속self 가상모델 pp0.3~0.4m는 가능한형태 예시이지 실제제품경로 재현이 아니다. 실제peer는보간하고self도canonicalbuffer를소비한다. 그러므로 양자화가주원인이라는 '유력'표현/후속selfbuffer계획은확정하지않는다. source/drop/속도/시계/rendergap과화면변환을실제기록으로구분해야한다. 이번에motion수정없음.

capture20 API diagnostic수정과실제tsc-b통과 확인. unit2/2는 상수/clamp만검사하며timer반복/다운로드동작검증이아님. 또한finishCapture후liveframe기록이legacyring을240개로줄일수있으므로별도download/export가20초전체보존을보장하지않는다. 사용자안내는 **Promise가반환하는전체payload를직접copy**하는단일명령을사용한다:

`clearInterval(window.rtwJitterTimer); copy(JSON.stringify(await window.__rtwPeerIngestDiag.capture(20), null, 2));`

같은창에서원래rtwJitterSamples초기화실패로push에러가났으므로이API는그배열에의존하지않는다. 양쪽새로고침후짧게주행,20초자동종료/복사. DEV메모리만사용,새Firebase구독쓰기없음. full20s의25Hz샘플(상한500)/선택ingest(상한200),dt/표시시각/selfbuffer+peerraw거리/gap기록. actual카메라/실제hookself좌표/rawFirebase/큐/offset미기록은missing에명시. 소스전환인가rendergap인가먼저분류.

진단가용성 ACCEPTED(조건부 Promise payload사용), 제품진동해결 미완료. commit/push/deploy없음. 추가Firebase콘솔전체내보내기/관리자키요청불필요.
