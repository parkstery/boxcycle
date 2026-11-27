# 주행 출발3초 카운트다운

Codex · Chief 2026-11-27 지시. 경로 설정 뒤 출발 시3→2→1 표시 후 주행 시작. 재개/일시정지 해제는 기존 즉시 동작.

Trail 생성·합류 권한/존재 검사가 성공하면 카운트다운을 시작한다. 생성/합류 두 경로 모두3000ms를 기다린 뒤 resetRide·세션 오프셋·running을 설정한다. 따라서 준비 실패 시 카운트다운이 나오지 않으며3초가 기록에 포함되지 않는다. Trail 시작 busy는 준비부터 카운트다운 종료까지 유지한다.

전용useRideStartCountdown은 경로·계정 변경/언마운트 시 타이머를 취소하고 이전 네트워크 요청에서 돌아온 시작도 거절한다. 중앙 반투명 오버레이는 클릭을 막고3/2/1을 status로 알린다. 소리·추가 버튼·재개 카운트다운은 요구 범위에 넣지 않았다.

타이머2/2(2999ms 이전 미시작·3000ms 시작·취소 정리), 진입 셀렉터22/22, 빌드 PASS, lint오류0(기존App 경고6). 코드 정련·의존성 기준선 유지. 실제진입 e2e 최종 결과는 HANDOFF 참조.

구현: App.tsx·hooks/useRideStartCountdown.ts·lib/ride/startCountdown.ts·components/RideStartCountdown.tsx/css. 계약과ride-entry e2e에3→2→1 후running을 반영했다. 고정105.

검증 후속: 최초 전체진입2/8 통과·6실패(센서 닫기/메뉴30초 시간초과·기존즉시running 기대 포함). 전용시험에서3만 표시 후 취소되는 실제 결함 재현: Trail 준비가 같은 좌표의 새 geometry 객체를 전달한 것을 경로변경으로 오판했다. 객체 동일성 대신 좌표 키+uid로 취소 문맥을 구분해 수정.

최종 전용 실제앱 진입1/1 PASS(38.1초, Firebase 에뮬레이터). 800×360에서3→2→1 표시·카운트다운 중 일시정지 없음·종료 뒤 주행 종료 활성 확인. countdown-landscape.png를 직접 열어 중앙2 표시 확인. 기존전체8건은 재실행하지 않았으므로 전체진입통과로 보고하지 않는다. 최종 빌드·새소스lint PASS, 의존방향0/순환0. dep-layers에는 새 startCountdown 파일의 ride 소유만 등록(허용엣지 확대 없음).
