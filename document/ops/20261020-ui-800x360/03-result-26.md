# 긴 터치1회 재탐색 결과

2026-10-22 · record. native contextmenu가 앱 타이머 전에 오면 진행중 touch를 취소하고, 타이머 뒤 contextmenu/pointercancel이 오면 이미 확정한 touch도 취소해 다음 첫 press를300ms 억제했다. touch pointerType을 저장해 단일·이동없음·허용된 touch의 native longpress는 같은 확정 함수를 한 번만 사용한다. 이미 실행된 longpress는 cancel로 되돌리지 않는다. mouse 우클릭·이동·핀치·메뉴 차단 유지.

신규 결정적2시험 포함 gesture14 PASS, 실제 CDP touch/native menu/cancel 겹침 브라우저 회귀 포함4 PASS. Chief가 긴 탭1회 해결 직접 확인. [검수26](04-review-26.md). 제품 범위 gesture1파일. 커밋·푸시는 Chief 승인 후27에서 수행, 배포 없음.
