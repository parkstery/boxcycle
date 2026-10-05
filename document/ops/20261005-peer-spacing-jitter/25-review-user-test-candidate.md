# Supervisor 검수 — 사용자 사전 테스트 가능

Codex · 2026-10-05. 결과22/24, 실제 frame/self/peer/camera 연결 diff와 raw 하네스 수정을 검수했다.

**USER_TEST_READY(조건부 사전 확인)**. 제품 최종 APPROVED/완료/배포 판정은 아니다. Chief 요청에 따라 아래 실제 실행 경로를 안내한다.

`C:\20.HDev\boxcycle`, branch `fix/peer-spacing-jitter`. 전용 clean managed worktree가 아니라 기존 작업 checkout이며 타 작업 파일 혼재. 루트에서 `npm run dev -- --host 127.0.0.1 --port 5010 --strictPort`, URL `http://127.0.0.1:5010/`. Cursor smoke에서 HTTP200/main/App transform200, Vite ready373ms. 관측 서버는 종료했으므로 사용자가 명령으로 다시 시작한다. production Firebase 연동이며 운영 데이터 사용, 앱/Rules 배포 없음. 서로 다른 UID의 독립 브라우저 프로필 둘에서 같은 로컬 빌드/같은Trail로 테스트한다.

정상 후보 근거: 실제 앱 `tsc -b` exit0, 변경파일 lint exit0(기존 warning분리), 기존 수신 gate 통과. raw 표시 거리 사용·local enqueue와 peer delivery 분리한 재생에서 gap1 순서반전 BEFORE1.0→AFTER0, 정상 pass/accel/asym0; leave 프레임 jump약0.11m. self/peer 중앙frame시각, sampled self좌표를 카메라가 소비함을 diff에서 확인. RTDB200ms/FS4초 불변, 선택적tSrv 약21bytes/encode 증가. 송신횟수 검증은 하네스 모델 count이며 실제 queue 비행의 비용 증명을 대체하지 않는다.

완료 보류: 한방향stall 순서불일치39.8%, 큰clockJump rebase약3.45m, queue/coalescing·route전환·±30s 기기skew 미실행, 브라우저2창 미관측, 상대간격/peer프레임jump 게이트 부족. 13 Rules시험은 regex계약이며 emulator평가 아님. 서버축 pause/legacy fallback 시험은 정상후보 보조증거이며 모든경계 완료를 주장하지 않는다. 기존 S3 정적fixture실패 별도 보존.

Chief 육안 테스트는 정상등속→속도변화→정지/resume 각10~15초, 자기/상대/카메라 약600ms 과거·HUD실제 즉시·solo안정상태0 관측. 이탈 catchup전환은 즉시0이 아닌 연속복귀. 남은항목은 후속재작업/검증 대상으로 보존한다. 사용자 테스트 가능과 근본 문제 최종 해결을 구분한다.
