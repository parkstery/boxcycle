# 감리21 — 중단 세션 재개·테스트 환경 복구

- 날짜: 2026-10-19 / Supervisor: Codex.
- 요청: ‘게스트 로그인 유지 방안 검토’ 채팅을 이어서 작업.
- 판정: LOCAL_VERIFIED / TEST_READY 유지. 기존 채팅의 마지막 턴은 completed이며 감리20·운영 Guest 정리·최종 보고까지 기록되어 있었다. 이번 재개에서 제품 변경이나 운영 삭제를 반복하지 않았다.
- 시작 상태: main2 / HEAD b6c991792c65d30c0c7c7989f771be14b453e2a8. 기존 다수 dirty 변경 보존, 커밋·푸시 없음.

## 이번 실행 결과

실행 위치 `C:\20.HDev\boxcycle`.

```powershell
Set-Location C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs scripts/guest-logout-supervisor.test.mjs scripts/guest-lifecycle-supervisor.test.mjs scripts/guest-orphan-maintenance.test.mjs
git diff --check
```

- 회귀 시험 exit0: 29 PASS / 0 FAIL. 동일 Guest 종료·재시작, Google 연결 성공·취소, 검증 경합, 오프라인 복원, 수명 정리·보호·고아 정리 계약 포함.
- diff 검사 exit0. 기존 CRLF 변환 경고는 남아 있다.
- 기존 demo 서버가 꺼져 있어 복구했다. 최초 일반 실행은 Firebase CLI 설정 파일 접근 EPERM으로 exit1. 권한 있는 재실행 후 정상 기동, 앱 GET http://127.0.0.1:5004/ 응답200. hub `/emulators`에서 Auth9099 / Firestore8080 / Database9000 확인.
- CLI가 중복 suite 경고를 출력했다. 기동 전 대상 포트 listener 조회 결과가 없었고, 이번 suite는 지정 포트로 정상 기동했으며 hub도 해당 포트를 보고했다. 경고만으로 다른 실행을 강제 종료하지 않았다.
- 운영 보존 수치는 이번 재조회가 아닌 기존 19:46 증거다: Google4·보호 문서2227 누락0/변경0·Guest0. 근거 `evidence/test-reset-verification.json`. 이번에는 운영 데이터에 접근하거나 삭제하지 않았다.
- build·lint·실제 SDK E2E는 감리20 통과 기록을 유지한다. 제품 변경이 없어 이번 재실행 대상에서 제외. 실기기 BLE·실제 Google 팝업은 여전히 미검증.

## Chief 직접 확인

현재 주소: http://127.0.0.1:5004 (운영 Firebase와 분리된 demo).

확인 순서: 게스트로 시작 → 기록 확인 → 사용자 정보 → 종료 → 로그인/게스트로 시작 메뉴 → 게스트로 시작 → 기록 유지 확인. 종료 상태 새로고침·새 탭도 시작 메뉴를 유지한다. 이번 서버 복구는 휘발 demo 데이터로 새로 시작했으므로 이전 서버의 시험 기록은 복원되지 않는다.

서버가 꺼졌을 때만 아래 명령 실행. 같은 포트 서버가 실행 중이면 중복 실행하지 않는다.

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --serve"
```

잔여: Chief 직접 확인·최종 CLOSED, 기존 dirty 변경과 분리한 운영 반영 범위 검수 및 Functions/Rules/Hosting 배포. 이번 복구를 운영 반영으로 표시하지 않는다.
