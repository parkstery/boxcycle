# 결과07 — 비노출 에지·상단 계기·주소 단일면 통합

2026-10-21. Cursor Composer2.5(session `dd62cd52-d076-4c4c-96e5-b057d74d3a0e`) 지시05/06 구현 후 Supervisor 실지도 결함 수정·통합. exec98035/61211은 모두 Ctrl+C exit1이며 개발자 최종제출로 취급하지 않는다. 지시07은 Supervisor가 단일 writer로 이어받았다.

## 구현

- 흰색 에지 상자·파란 막대 제거. 지도 위 pointer-events 레이어 없이 document capture에서 좌우20px 시작위치를 판별한다. 메뉴·맵뷰 중복 시각 트리거 제거, focus-visible·스크린리더 대안 유지. 마우스 누른채 안쪽드래그도 동일하게 동작한다.
- 리렌더에 따라 드래그 세션이 초기화되던 문제, 기존 Mapbox 버튼 가림, 드래그후 compatibility click으로 지도 팝업이 같이 뜨던 문제를 실지도에서 발견하고 수정했다. cancel/resize/멀티터치·중앙pan/헤더닫기 검증.
- 계기판 좌상단(4,4), 좁은화면은 우측 컨트롤만 두행으로. 긴누적수치 전용폭과 한줄표기로 숫자간 겹침 방지.
- 도크 대표두주소 175.25×85px. 주소24px 행, 내부카드·개별삭제박스·hud-glass 중첩 배경/그림자 제거. 경유지1개마다24px씩 전체높이가 증가하며 최대3경유지+출발도착5행은175.25×157px. 주소목록/본문에 높이제한·내부스크롤 없음.
- 펼친 메뉴 헤더와 맵뷰의44px 일괄확대도 조밀화. 서버·인증·DB·주행·인정정책 변경없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

- selector19 PASS.
- 주행/센서/결과 관련 정적시험4파일38/38 PASS.
- Playwright `ui-800x360 ui-edge-live` 14/14 PASS(1.5m). 실제App·Mapbox·Firebase로컬에뮬레이터, 800×360/667×300/844×390. 최초위치선택 지연을 시험에서 명시완료한다.
- compatibility click 최종수정 후 `ui-edge-live` 독립재실행1/1 PASS(58.1s). 실제지도 화면·마우스/터치스와이프·멀티터치취소·지도버튼hit·중앙pan. 운영Firebase쓰기는 시험라우트가 차단하며 차단대상발생0.
- tsc/build PASS, lint전체0errors/기존37warnings. 마지막수정파일eslint0errors. dev-tools·diffcheck PASS. pre-push 전체게이트는 릴리스기록에 추가한다.
- 캡처/rect `.out/ui-edge-20261021/actual-*.png`, `actual-geometry.json`, `addresses-0-final.png`, `addresses-3-final.png`. 실제Mapbox 캡처와 SVG fixture를 구별한다.

실제 Android Galaxy·BLE·OS 뒤로가기제스처 체감은 Chief 기기테스트 대기. Chief가 커밋·푸시·배포를 승인했으므로 검증후main2와Hosting을 반영한다.
