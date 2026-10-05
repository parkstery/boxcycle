# REVIEW-38 — 정밀도 수정·진단 보완 검수

Supervisor: Codex / Developer: Cursor CLI. 판정: **APPROVED — 로컬 사용자 재시험 후보**. Chief 체감 완료 또는 배포 승인으로 해석하지 않는다.

- 35/37 보고와 실제 encode/self 공용 quantizer, capture 저장 간격·완료 export, mutation 복원 코드를 확인했다. 송신 주기·D600은 유지한다.
- 실제 paired JSON은 주행 중 상대간격 약 0.05–0.15m 반복변동 관찰 근거다. 수정 후 실측은 없다. 0.100→0.008m(92% 감소)는 제품 함수를 사용한 합성 등속 조건의 결과이며 유일 원인 확정 또는 사용자 체감 해결로 일반화하지 않는다. 원본 반올림 전 거리 복구는 불가능하다.
- PNG 두 장을 확인: 실측 간격 반복변동 및 합성 0.1m/0.01m 진폭 감소. 속도 5/6/20km/h × phase 0/40/80/120/160ms 행렬은 악화 없음. 기존 알려진 stall/legacy replay 실패는 해소 주장하지 않는다.
- 비용: 동일 500표본 encode JSON UTF-8 평균 +0.888B, 최대 +1B. 5Hz 단일 송신 기준 +15,984B/h. 네트워크 overhead·수신자별 fanout·billed 비용의 측정값이 아니다.
- Supervisor 직접 실행: `cd apps/web; node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` **6/6 PASS**, 약 8.2초. `git diff --check` PASS. 소스 읽기 두 건은 처음 cwd 경로 중복으로 실패 후 올바른 경로로 다시 확인했다.
- Cursor 검증: quantize gate/mutation, 실제 tsc-b, residual/spacing PASS(37). 실주행·commit/push/deploy 없음.
- 진단: 60/120fps 누락 수정, 완료본 보존·Blob JSON 행동 확인. 전역500표본은 peer UID 하나의 20초를 지원하나 동시 여러 UID는 앞 표본 drop 가능(메타 표시).

테스트 위치: `C:\20.HDev\boxcycle`(기존 혼합 checkout, 새 격리 워크트리 아님). `npm run dev -- --host 127.0.0.1 --port 5010 --strictPort`. 기존 서버가 있으면 재실행할 필요 없다. Chrome/Edge 양쪽 hard refresh, 동일 Trail에서 기존 증상 조건 약20초만 확인. 여전히 튀면 각 창에서 `await window.__rtwPeerIngestDiag.capture(20); window.__rtwPeerIngestDiag.download();`로 보존된 JSON을 받을 수 있다.
