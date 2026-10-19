# Guest 수명·고아 데이터 정리

- 날짜: 2026-10-19 / Chief 승인: 현재 요청으로 구현·기존 고아 데이터 정리 승인.
- 상태: LOCAL_VERIFIED / TEST_READY. [최신 감리20·실행 방법](04-review-20.md). 운영 Guest 재정리 완료, Functions/Rules/Hosting 미배포. Chief CLOSED 미승인.
- 목적: 운영 Google 사용자 4명과 데이터 보존, Guest 유지, 로그아웃 자동 삭제 철회, 활동 30일 만료·재접속 복구·누적 고아 정리.
- 담당: Supervisor Codex / Developer OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 한도·사용불가 시 Cursor AI.
- 최신 결과: [통합 감리20](04-review-20.md). [Cursor20](03-result-20.md)·[GLM19](03-result-19.md) 뒤 Supervisor 보완·실제 SDK4/HTTP·Rules14/주행1/인증·종료17 독립 PASS. 서버127 PASS는 감리16에서 확인한 같은 서버 코드의 기존 결과다. 운영 재삭제 후 Google4·문서2227 해시동일. 개별 Developer 보고의 감리 재작업은 감리20이 최종 판정한다.
- 금지: 기존 dirty 변경 되돌림·무관 변경 커밋/푸시·Google 사용자 삭제·공용 자산 통삭제·자동 신규 Guest 생성에 의한 운영 시험 오염.

## 지금 할 일

2026-10-19 [감리25](04-review-25.md): 위치선택창 「내 위치/기본 위치」·아이콘·220×162카드·44px버튼. 단위26/실제hook DOM1/selector19/lint/build·3화면12상태 PASS. 실앱추가캡처는창해제실패·실기기/Chief디자인확인대기. 주소추적중지·redirect초안제거. 운영변경/배포없음.

2026-10-19 [감리23](04-review-23.md): Ready Ride5004 복구. demo자동경로API등록·거리클릭즉시탐색·잔액미확인0오판정교정. 실제SDK/Mapbox2·3·5·10km4 PASS·잔액1/selector19/lint/build/diff PASS. 5004 Ctrl+Shift+R 후 확인. Cursor CLI ENOMEM으로 Codex직접, 운영변경/배포없음.

2026-10-19 [감리22](04-review-22-localhost5000.md): Chief localhost5000 진입실패 원인은 운영 guestActivityHttp 미배포(OPTIONS404). 현재 시험주소는 http://127.0.0.1:5004, 실제SDK Guest진입·새로고침동일UID 1 PASS(800×360)·selector19 PASS 재확인. 제품 우회·운영배포 없음.

2026-10-19 재개: [감리21](04-review-21-resume.md). 이전 채팅 completed·감리20 완료를 확인하고 회귀29 PASS·diff 검사 exit0 재확인. 꺼진 demo 서버를 복구해 http://127.0.0.1:5004 응답200 및 Auth/Firestore/RTDB hub 등록 확인. 제품·운영데이터 변경 없음. 운영 보존 수치는 기존19:46 증거이며 이번 재조회가 아니다. Chief 직접 확인·운영 반영 범위 검수/배포가 잔여다.

2026-10-19 최신 Chief 지시 구현·감리 완료: 로그인/게스트로 시작, 종료는 인증세션 보존. Cursor17·20 제품구현, GLM18·19 SDK spec, Codex 감리보완·독립검증. 실제hook+종료17/HTTP·Rules14/Guest SDK4/주행1/identity33/selector19/viewport PASS. build·lint exit0(기존warning40). 운영Guest5명 재삭제·현재Auth4/Google4/Guest0. 검사한Google문서2227 누락0/값변경0,재생성0. 원본 스냅샷은 ignored private에만 보관, 외부 모델 전송 없음.

직접 테스트 앱: http://127.0.0.1:5004 (demo Firebase, 운영과 분리), GET200 실행중. 실행 폴더 C:\20.HDev\boxcycle, 재시작 명령·확인 순서는 감리20. 운영 배포·커밋·푸시는 하지 않았다.

최신 운영 보존 검사19:46: Google4의 UID집합/provider/disabled 상태 동일, 검사문서2227 해시동일·누락0. Chief 명시승인으로Guest5삭제,따라서초기Auth5전원보존이라는과거검사조건은더이상현행이아니다. 과거Guest Trail members1부재의원인미확정기록은감리16에보존하며이번삭제와혼동하지않는다.

누적 정리: FS213(기존17+개인 고아 캐시196)/RTDB2. 추가 캐시 보호248문서 해시 동일·삭제0, 구글4동일. [추가 정리 기록](10-cache-cleanup.md). 다음은 기존 dirty 변경과 분리한 운영 반영 범위 검수·배포이다.
