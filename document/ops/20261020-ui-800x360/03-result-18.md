# Supervisor 교정 결과

2026-10-22 · record · Codex. [지시18](02-task-18.md).

실제 MapView+Mapbox 엔진을 쓰는 서버기록 없는 fixture와 브라우저2시험 추가. 메뉴 열린 동안 뒤 지도 롱프레스 차단, 출발/도착을 서로 다른 위치에서 지정, 네이티브 CDP 터치 롱프레스, 핀치 취소, 열린 경로창에서 명시적 direction tap1회 확인. 외부 Mapbox 스타일/네트워크만 stub하며 MapView는 실제 제품 코드다.

제스처 모듈은 사용자 pan/zoom 시작/종료를 추적해 진행중/종료후300ms 억제한다. 자동 카메라에는 originalEvent가 없어 무차단. document capture로 UI/에지 이동·종료를 관측하고 popup 자체는 차단대상에서 뺐다. 우클릭은 위치 선택을 시작하지 않는다. 마커/경로창을 여는 유일한 일반 입력은 정지500ms 롱프레스다.

주소창은 실제 RouteDock 긴 주소5행으로 세 화면×세 미니맵폭 좌우 일치 및 패널별 접기/펼치기를 회귀시험에 고정했다. 기존 route-pick-popup-title의 짧은 클릭→팝업 진입은650ms 누르기로 갱신했다. 기존 route-ride-controls start-only 시험은 위치 둘이 없을 때 수단버튼 미노출인 현행 계약에 맞췄다.

푸시 게이트에서 옛 방향선택 코드의 `=== direction` 문자열만 찾던 계약1건이 실패했다. 새 콜백의 `!== direction` 조기반환 및 onDirectionShortTap 연결을 확인하도록 갱신, 해당 click-intent21개 재실행 PASS. 최초 Git Bash가 Kimi npm shim을 먼저 찾아 시험 시작 실패2회, Bash 안에서 정상 Node 경로 우선 지정으로 해결(전역 파일·훅 미수정·게이트 우회 없음). 전체 게이트 최종 결과는 릴리스18을 따른다.
