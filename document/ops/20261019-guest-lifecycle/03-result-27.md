# 결과27 — 종료 후 첫 인트로·기존 Guest 재사용

Codex 직접수행. 기존Auth세션재사용로직은변경하지않고,App표시조건만교정했다. 종료시introDismissed=false/entryRequested=false,복원완료된appUseEnded상태를첫인트로대상에포함,AuthSessionGate중복노출방지. 오프라인/만료/오류안내분기는그대로유지한다. 기존dirty보존·서버/Rules/운영데이터수정없음.

검증: 실제SDK종료3회반복1 PASS(27.7초),기존UID·개인fixture유지·계정증가0·종료중새로고침/새탭첫인트로·heartbeat/membership정지. 실제App종료handler단위2 PASS,인증게이트/탈퇴회귀14 PASS,selector19 PASS,변경lint exit0(기존App경고7),webbuild exit0(기존riderRig/bundle경고). 모바일844×390캡처를추가한최종spec을다시검증하고웹후속배포한다.

사용자질문답: 첫페이지Guest버튼은기존beginAuthenticatedSession을호출한다. 같은브라우저/주소의유효한익명인증이있으면서버확인후재사용,없는세션또는서버에서확정삭제된세션만명시클릭시새Guest하나. 브라우저데이터삭제/주소변경은같은Guest복귀와구분한다.
