# Task07 감리 — 부분 통과 / Task09 재작업

수행 GLM-5.3, 감리 Codex. functions build/lint/98단위 PASS 보고는 확인했으나 최종 완료 승인 아님.

2026-10-19 실제 Auth/Firestore/RTDB demo 에뮬레이터 실행:

`node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node --test scripts/guest-rules-supervisor.test.mjs"`

cwd `C:\20.HDev\boxcycle`, exit1. 독립 동작7 PASS,3 FAIL(부모 실패 포함 tests11/pass7/fail4).

- PASS: 정상 익명토큰 쓰기, blocking 5상태 FS/RTDB 차단·타인쓰기 보존, Auth 삭제 후 기존토큰 client 재생성 거절.
- FAIL: Admin onboarding이 deleted marker 뒤 users/ledger 생성.
- FAIL: 지연 mileage trigger가 deleted marker 뒤 users 생성.
- FAIL: missing-parent traces-only 후보 발견 누락. 이어지는 ledger 검증은 도달하지 못함.

Task09에서 3건과 관련 Admin writer 경합 방지 수정. 운영 접근/배포 없음. 실제 HTTP 등록함수에 HTTP 요청+실제 emulator 토큰 검증도 supervisor 시험에 추가했으며 다음 실행에서 검증한다.
