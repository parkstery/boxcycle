# Task05 통합 감리 — 진행 중

수행·감리 Codex. 서버/Rules GLM Task07, web Cursor Task06. 운영 데이터 접근 없는 demo/fixture 시험이다. 제품 전체 승인 아님.

## 실제 Rules

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node --test scripts/guest-rules-supervisor.test.mjs"
```

- 첫 시도 RTDB JSON중복 tail 파싱 실패(exit1). GLM 형식 교정 후 재실행: **행동 subtest 7 PASS / 1 FAIL**(상위 suite 포함 tests9/pass7/fail2).
- PASS: 실제 익명 토큰 기본 FS/RTDB 쓰기, deletionScheduled/disabling/deleting/failed/deleted의 재쓰기 및 FS marker 위조 거부·다른 활성 UID 쓰기 허용, Auth 삭제후 기존 token 재생성 거부.
- FAIL: Admin adapter `rides-only orphan must be discovered`. 이미 Task07 구현대상으로 인계한 listProfileUids 누락을 실제 에뮬레이터로 재현. RTDB-only 삭제는 같은 subtest 앞 assertion에서 멈췄으므로 아직 통과로 주장하지 않는다.

## 실제 Hook fixture

```powershell
Set-Location C:\20.HDev\boxcycle
node --test scripts/guest-auth-hook-supervisor.test.mjs
```

실제 useAppAuth를 React/Edge667x300에서 실행하며 Firebase callback만 모킹. pending verification UID노출·영속쓰기 차단 PASS, offline local데이터보존·같은UID재시도 PASS, disabled Google기록보존 PASS. SDK가 reload 실패 전에 null callback을 알리는 경우 만료안내소실 FAIL. Cursor Task06에 요구사항·시험경로 추가. 단순 reducer 시험만으로 대체하지 않는다.

## 로그아웃·최초정리 도구

`node --test scripts/guest-orphan-maintenance.test.mjs scripts/guest-logout-supervisor.test.mjs` exit0 **7 PASS**. 실제 App.handleServiceExit 함수 실행으로 Guest/Google 둘 다 signOut1회, 계정삭제0·reload0 확인. 도구 프로젝트가드/공용보호/CAS 등5 PASS. `node scripts/check-dev-tools.mjs --check` PASS/WARN0.

실행 중 제품 변경이 계속되므로 최종 파일 해시 고정 후 필요한 미해결 시험만 재실행한다. 현재 미배포.
