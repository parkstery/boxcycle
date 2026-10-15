# 검수77 — 시작 때 정상 로그인 대기를 연결 실패로 표시하던 버그

2026-10-15 Supervisor Codex. 원본main2 HEADdbab829. Developer Cursor session5f6bdcbe-bed1-4f7b-95fa-75999936c189 exit0. 지시77·결과77·실제diff·수정전후증거검수. **APPROVED / Chief 확인 대기**. useAppAuth의provider·인증요청·storage정책은바꾸지않고표시만교정했다.

## 재현된 원인

Google시작은useAppAuth.handleGoogleSignIn에서guestEntryAccepted를세우고busy=true, error=null로한다. App의needsGuestEntry는false로바뀌어인증gate로넘어간다. 기존gate는부트/authSigningIn만대기로봤고busy를빠뜨렸다. 나머지기본분기는error유무를확인하지않고항상'서비스에 연결할 수 없습니다.'였다. 따라서정상Googlepopup대기·자동익명시작전짧은idle·popup취소후idle도실패로보였다.

수정전실제App에useAppAuth만fixture주입: authInitialized=true,busy=true,error=null에서실패문구와비활성…버튼노출을재현. before-pending-error.png가Chief캡처와같은증상이다. 이것은네트워크장애를확인한것이아니라오류없는상태에서도실패를그리는UI버그의재현이다.

## 수정

AuthSessionGate를순수컴포넌트로추출하고App의동일조건에연결. 설정없음→초기화/자동로그인/busy대기→명시로그아웃→실제error→오류없는선택화면순서. 대기에는role=status '연결 중…'/'로그인 중…', 실패·상세오류·선택/재시도버튼숨김. 취소후에는Google/Guest선택복귀. 실제error일때만실패제목과상세·다시시도/Google로그인노출. 로그인성공시App의기존stage가gate를제거한다. 인증콜백/계정정보/서버설정/CSS변경없음.

selector계약에auth-session-state와App연결검증추가(18단계). 하나의계약단계가추출컴포넌트와App을함께검사하도록verify-selectors의also파일검사확장. 기존단계의검사동작유지. E2E helper는새선택화면을정착신호로인식하되연결/로그인중은ready로받지않음.

## 독립 검증

- `node document/ops/20261013-face-redesign2/auth-77-integration.cjs` exit0: 실제App/게이트사용, useAppAuth만상태/콜백fixture, 모든외부통신차단. **8전환PASS**: 부트대기, Googlepopup대기(실패/버튼0), 취소후선택및Google재시도콜백, 실제오류보존및Guest재시도, stale error대기중숨김, 명시로그아웃선택보존, 자동Guest대기, 모의인증성공후gate제거. 800×360및667×300캡처. google-pending-800.png직접열람: '로그인 중…'만표시. 실계정/OAuth/Firebase쓰기없음.
- apps/web `node --import ./scripts/identity/auth-session-gate-tsx-register.mjs --test scripts/identity/auth-session-gate-render.test.mjs` exit0, **4테스트PASS**. 실제React컴포넌트SSR출력과React버튼트리로상태전환/버튼콜백/설정누락/로그아웃검사. 초기1건은테스트의hidden문자열이aria-hidden과충돌한오탐으로FAIL, 고유stale error문자열로교정후독립재실행4/4PASS.
- apps/web `node scripts/ride-verify/verify-selectors.mjs` exit0,18단계PASS.
- apps/web `npx eslint src/App.tsx src/components/auth/AuthSessionGate.tsx` exit0,오류0/기존hooks경고7.
- apps/web `npm run build` exit0,423모듈. 기존번들크기/riderRig SADDLE·PELVIS export/plugin timing경고있음.
- apps/web `npx playwright test --list` exit0,105테스트/58파일수집. 실제E2E주행실행아님.
- 제품`git diff --check` exit0. Developer의타입/렌더/lint/selector는결과77참조.

브라우저fixture초기시도는Vite React URL의?v해시를빠뜨려중복React디스패처오류,하네스에실제Vite변환URL을사용하도록교정후재현및검수통과. 실패하네스프로세스종료확인. 제품오류와구분.

## 제한

에뮬레이터9099/8080/9000미실행확인. 실계정Google로그인/실네트워크장애/실주행전체E2E/실기기미검증. 인증provider는변경하지않았으며외부서비스권한을허용해검수하지않았다. 온라인영상/기존화면보존,배포/푸시없음. Chief는http://localhost:5014새로고침후확인가능.
