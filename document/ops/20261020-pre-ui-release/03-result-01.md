# 결과01 — 이전 수정 릴리스

2026-10-20 Codex. **DEPLOYED / 실제 사용 확인 대기**.

- 원래 main2 HEAD6cd54e27 및 UI작업직전 baseline을 분리 worktree로 보존. 새 UI제품6파일·fixture·문서를 배포에서 제외했다. commit67ba0a75, main2 병합5f012a52fc090d156aba497a8e031a9f7ff89904. 원격 main2 동일SHA 확인. main 변경없음.
- 범위: 앞선 profile/menu/신규도로4커밋, 미니맵·도크위치·24px캐럿·SPINATLAS브랜드·4시험lint정리와 관련기록. 기존dirty는 명시경로 stash로 보존하고 릴리스코드와 동일함 확인, 혼합ops의 기존내용은 복구. stash는 복구용으로 남김. 새UI미커밋상태 유지.
- GitHub origin https://github.com/parkstery/boxcycle.git : 최초 자동검토에서 소유근거부족으로 푸시차단. 읽기전용 gh 조회로 로그인parkstery/동일공개repo ADMIN 확인후 재시도 허용. 민감파일/.env/.out는 커밋하지 않음.
- 최초2회 pre-push는 Git Bash의 C:/Users/kdrea/bin/npm이 존재하지않는 Kimi runtime을 호출해 실패. Git Bash프로세스안에서 정상Node경로를 앞세워 해결, 게이트우회안함.

## 실제 검증

분리위치 C:\20.HDev\boxcycle\.out\pre-ui-release-20261020.

- npm run build: exit0. Vite457모듈. 기존SADDLE/PELVIS export·bundle크기 경고 유지.
- npm run lint: exit0, web 오류0/기존40경고. functions에서 npm run lint: exit0.
- functions npm test: exit0,132/132 PASS.
- pre-push 전체: exit0, lock동기/의존방향·순환/개발도구/타입/동행간격·전환/selector19/web1319/Claim벡터4 PASS. web에뮬레이터·하네스3파일 제외는 기본도구정책이며 성공으로세지않음.
- 수정4시험17 PASS.
- firebase emulators:exec --only firestore --project demo-new-road-display 'node --experimental-strip-types apps/web/scripts/conquest/recent-road-rules.emulator.test.mjs': exit0,1PASS. 소유자읽기허용,타인·인증전읽기/클라이언트쓰기·삭제차단. PERMISSION_DENIED 로그는 이 시험의 기대차단이다.
- git diff --exit-code HEAD -- apps/web/src functions/src firestore.rules: exit0, 실제배포소스와커밋동일.

## 배포·읽기 smoke

실행명령(exit0):
```powershell
Set-Location C:\20.HDev\boxcycle\.out\pre-ui-release-20261020
firebase deploy --project boxcycle-dc2df --only 'hosting,firestore:rules,functions:conquestOnRideCreated,functions:deleteAccountHttp,functions:resetGuestHttp,functions:guestLifecycleSweep' --non-interactive
```

Hosting/Rules/위함수4종 successful update·Deploy complete 확인. 운영계정삭제·reset·정리함수 수동호출없음. SDK업그레이드권고는 기존버전경고이며 이번범위에서의존변경안함.

운영 https://boxcycle-dc2df.web.app HTML200. HTML이 index-C__535G-.js / jsx-runtime-1YrJdh_0.js / index-OOUxgq3Q.css 참조,3파일HTTP200·로컬대비SHA256바이트일치·immutable캐시확인. 실제로그인·실주행·센서·개인기록변화검증은미실행.

## Chief 직접 확인

운영URL 강력새로고침 → 진입/로그인 → 경로준비에서 도크위·미니맵아래/24px캐럿 확인 → 주행완료후 새도로표시 및 결과닫은뒤 '신규도로만' 복원확인. 운영자료를 만드는 주행은 Chief가 직접 실시한다.

로컬개발서버가없을때:
```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```
http://localhost:5000 은 이후미배포UI작업이포함되는개발화면이다. 운영릴리스화면과구분한다.
