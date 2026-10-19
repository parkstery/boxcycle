# 감리20 — 단순 메뉴·종료·같은 Guest 복귀

Supervisor Codex / Developer Cursor17·20, OpenCode GLM-5.3 Flash Free18·19. Chief 결정은 로그인/게스트로 시작 두 버튼, 종료는 Firebase 세션 보존, 유효한 Guest 재사용, 확정 삭제/빈 세션만 명시 클릭으로 새 계정1. Google4 및 그 데이터 보존, 기존 Guest 재정리 승인.

## 재작업과 Supervisor 보완

- Cursor17: 기본 종료·재사용 구현. 종료 Guest→Google 성공 경로에서 종료 표시가 남는 감리 발견으로20 재지시.
- Cursor20: Google 성공 후 서버 검증·노출, 오류 버튼도 로그인/게스트로 시작 유지. **검수에서 fixture에 맞추려고 Firebase User에 currentUser 자기참조를 임시 주입한 코드는 거절·제거**. 테스트 fixture의 SDK 인자가 잘못됐던 문제는 Supervisor가 User 인자로 바로잡았다. 제품은 정식 linkWithPopup(current, provider)만 사용한다. 결과20의 자기참조 해결 설명은 최종 승인 코드가 아니다.
- GLM18: SDK spec4개 작성. 무조건 true인 motion 부재 검사, 잘못된 offline 증가 기댓값, 잘못된 runQuery URL과 미정의 함수, 8초 관찰로5분 heartbeat를 단정한 한계를 감리해19 재지시.
- GLM19: 실제 JSON 부재 검사·snapshot 기준·clock 가속/요청 계수·URL 교정. 최종 감리에서 arrayContaining([afterCreated])의 중첩 배열 오류를 Supervisor가 arrayContaining(afterCreated)로 수정.
- 공용 readGuestUid helper의 TS2352는 결과 holder와 런타임 string 검증으로 Supervisor가 수정. 타깃 spec tsc 오류0 확인.
- root 실제 App handler 시험을 종료 계약(endAppUse1·signOut0)으로 교체. 실제 hook fixture는3회복귀·정리차단·검증중종료·Google연결성공/취소/빈세션popup까지 확장.

## 현재 독립 검증

- `node --test scripts/guest-auth-hook-supervisor.test.mjs scripts/guest-logout-supervisor.test.mjs`: 최종17 PASS. fixture 인자 오류로 실패했던 이전 실행은 최종 코드로 재실행해 해결.
- `node --test scripts/guest-lifecycle-supervisor.test.mjs scripts/guest-orphan-maintenance.test.mjs`:12 PASS.
- 실제 demo HTTP·Firestore/RTDB Rules14 PASS(통합에서도 재실행). 오래된 토큰 재생성·Admin 지연쓰기·Google 보호 포함.
- web identity4파일33 PASS, selector19 PASS, spec 대상 tsc exit0.
- 실제 주행 진입1 PASS. 최종 Guest SDK4개 모두 PASS(2.3분): 최초1계정/새로고침, 종료3회동일UID·Auth1·개인fixture·종료중새탭/재접속·heartbeat5분간격2칸가속요청0, 삭제확정만명시신규1, 실제offline생성0/복구동일UID. 통합 exec24425 exit0. fake clock 아래 종료 탭의 Firestore backend timeout 경고는 있었으나 종료 사용자는 노출되지 않고 활동요청0/서버활동시각불변·시험통과.
- web build 독립exit0. 기존 riderRig SADDLE/PELVIS 및 큰bundle 경고 잔존. lint 독립exit0/error0/warning40(기존). viewport667×300/844×390 PASS, dev-tools PASS/WARN0, git diff --check exit0. 배포/커밋/푸시 없음.

## 운영 Guest 재정리

`scripts/guest-test-reset-supervisor.mjs`는 기본dry-run. 원본 Auth Google4 UID집합/provider/disabled 상태 일치 확인, 익명·관리자아님·비활성아님만 exact manifest,1시간 유효, 프로젝트/상한/생성시각 재확인. link lease/Google 전환 재확인·차단 후 개인자료 정리·Auth삭제·tombstone. 원본 백업은 ignored private만.

19:44 새 dry-run: Auth9/Google4/대상Guest5/확인된개인문서13/보호Google문서2227. `node scripts/guest-test-reset-supervisor.mjs --apply --project=boxcycle-dc2df --max=5` exit0: Guest5삭제·skip0·failure0, Auth4/Guest0, 보호문서2227 누락0/값변경0, 개인문서재생성0. 19:46 `--verify` 읽기전용 재확인 exit0: Google4 provider/disabled일치, 문서2227해시동일, Guest Auth재생성0/개인문서재생성0/RTDB motion0. 증거: evidence/test-reset-summary.json, evidence/test-reset-verification.json.

삭제 core의 반환은 Firestore 삭제요청28·motion삭제요청3이며, 원래 없는 경로도 요청수에 포함한다. 실제 존재했던 snapshot개인문서13·motion0과 혼동해28개 실문서를 삭제했다고 보고하지 않는다. 삭제 tombstone5는 이전 토큰의 재생성 방지용으로 남긴다. 구글/공용자산 통삭제 없음.

운영 Functions/Rules/Hosting은 미배포. 로컬 검증을 운영 적용 완료로 보고하지 않는다.

## 판정·Chief 직접 확인

**LOCAL_VERIFIED / TEST_READY**, Chief CLOSED 미승인. Cursor17·20/GLM18·19 자체 결과를 그대로 승인하지 않고 위 감리 보완 후 독립검증했다. 운영 Guest 재정리 완료, 운영30일 스케줄/Rules/Hosting 반영은 별도배포단계로 잔존한다. 같은 브라우저의 유효한 Firebase 지속성만 재사용하며, UID 문자열만으로 인증을 복원하지 않는다. 브라우저 데이터 삭제/다른 브라우저는 같은 Guest를 식별하지 못하므로 Google 연결로 기록을 보존한다.

실행 폴더 **C:\20.HDev\boxcycle**. demo 앱 http://127.0.0.1:5004 GET200, exec46556 실행중. 운영 Firebase와 분리되어 Guest 시험이 운영 계정을 늘리지 않는다. 서버가 꺼졌을 때 복사 실행:

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --serve"
```

확인순서: 게스트로 시작→개인 기록 확인/주행→사용자정보→종료(주행중이면확인)→로그인/게스트로시작 두메뉴→게스트로시작→기존기록확인. 종료 상태 새로고침/새탭도 시작 메뉴, 재접속해도같은Guest. 서버재시작은휘발demo데이터를새로시작하므로브라우저만닫기/재접속과구분한다.

통합회귀 재실행(위 demo서버 먼저 종료, 같은port 중복실행 금지):

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs"
```

실기기 BLE·성능·실제 Google 계정 팝업 연결은 미검증. Google 전환 성공/취소는 실제 React 훅+SDK callback fixture로 검증했다.
