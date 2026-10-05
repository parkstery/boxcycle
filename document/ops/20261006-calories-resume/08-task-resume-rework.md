# 단일 슬롯 재작업

담당 Cursor CLI. 04·05·07-preliminary-review.md를 읽고 07 지적사항을 모두 해결·검증하라. 코드와 결과 불일치: 05는 typecheck 미실행이라고 기록한다. 필수 typecheck/lint를 실행하고 hook/tx 동작시험을 추가한다. 결과09-result-resume-rework.md. 다른작업보존·커밋/push/배포금지.

07 검수의각항목(eligibility/no-op TTL/expectedId abandon/error callback/UID guard/ready bootstrap/새유효ride만acquire/조회실패vs삭제/Guest경쟁/실배선)을코드근거로확인하고최소수정. hooks lint무더기disable로통과시키지말고state lifecycle을정리. 현재 hook status ready라도error message10초뒤생기는timeout버그와등록 bootstrap실패catch무시는필수해결. 초기부트스트랩후 과거B가acquire되는효과제거. clear완주/삭제와servermax업데이트 race검증. TTL보호중낡은다른routeprogress write가expiresAt을복원하는지검증.

같은workspace에서 별도 Cursor가칼로리구현한다. 당신 ownership: resume관련policy/repo/hook/tests, NextRideCard/RouteDock/nextRideTarget/savedRoutesLocal/dep-layers, App의resume영역, UserInfoSheet의resume영역만. App/공유파일수정은최신파일기준부분patch, 칼로리영역/다른변경revert금지. caloriehelper/RideSummarySheet/useRideEndAndPersistence칼로리영역은손대지말라. 검증 typecheck실패가상대진행중이면관련진단과타임스탬프구분후끝에재실행.

최소 meaningful hook/repo·fake transaction tests+기존59/4시험+selectors+tsc+변경TS lint. 740×300 UI는fixture로라도캡처(전체auth우회금지), 예외/한계정직하게기록. 실Firestore미검증은명시. 핵심배선/정책오류는미완으로보고.
