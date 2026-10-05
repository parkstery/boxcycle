# Supervisor 검수 — 소스 전환 튐 수정, 사용자 재확인 필요

Codex · 2026-10-05. 사용자 확인: 창 간 동기화 만족, 역전 없음. **동기화 APPROVED_BY_CHIEF**, 움직임은 미완료.

27/29 실제 bridge/anchor/quality 코드, raw JSON 및 mutation gate 검수: **확인된 소스전환 결함 수정 ACCEPTED(로컬)**. 사진 당시 선택 source/RTDB공백 미계측이므로 사용자 튐 전체 원인으로 확정하지 않는다. 최종 완료/배포승인 아님.

- RTDB→FS 버퍼 clear 경로의 frame jump3.181→0.058m, axisFlip2→0. mutation PRE FAIL→복원PASS. 정지복구0.076m·가속복구0.174m.
- FS추정시각은 내부quality=estimated로 capture와 구별, 권위anchor 오염 방지·publication|uid경계·late anchor 방어. 송신200ms/FS4초/D600 유지, 추가wire/DB쓰기 없음.
- tsc-b/lint/peer-spacing/common-display, unit10/10·Rulesregex13/13 통과 보고. 새7개재생 약4.5초. jump/back/axis gate는 전체구간, residual정상gate는 명시stall제외. 전체residual pp 등속공백1.238m·정지2.136m·가속10.965m는 **미해결 정확도 한계**. 기존S3정적fixture실패 별도. 브라우저 재확인 미실행.

29 진단해석 정정: capture인데 raw jump크다는 사실만으로 GLB/camera원인이라고 할 수 없다. maxJumpByUid는 registry raw거리 변화라 ingest/integrator/clock/frame정지부터 봐야 한다. 화면만 튀고 raw거리/gap이 매끄러울 때 GLB/camera를 좁힌다. source/quality와 frame기록은 같은시각 ring으로 대조. 진단은 DEV 메모리만 쓰고 서버전송 없음.

현재 path `C:\20.HDev\boxcycle`, branch `fix/peer-spacing-jitter`. 기존 localhost5000서버 사용 또는 루트 `npm run dev -- --host 127.0.0.1 --port 5010 --strictPort`. 양쪽 Ctrl+Shift+R(변이시험 HMR 제거), 독립UID/같은Trail, 5~6km/h10~20초 확인. 남으면 각창콘솔 `window.__rtwPeerIngestDiag.reset()` 후 짧게관측하고 `copy(JSON.stringify(window.__rtwPeerIngestDiag.export(), null, 2))`로 증거확보. 장시간주행 불필요.

commit/push/deploy 없음. 사용자재확인/로그로남은결함 좁히기. 전체smoothness완료보류, 공통동기화 유지.
