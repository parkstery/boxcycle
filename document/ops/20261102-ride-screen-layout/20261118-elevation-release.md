# 표고 표시 — 커밋·푸시·Hosting 배포

- 수행: Codex, 2026-11-18. Chief 「커밋, 푸시, 배포 해」 승인.
- 제품 커밋: `e0d2acfe43d0a1639e27f13b9897016e460c74b6` (`main2`, origin 반영).
- 범위: 표고 무배경·비겹침 배치, 미수신 축약/수동 재시도, 조회 timeout/응답 검증, 미니맵과 공통 시·종점 도안, 하단 현재 표고와 중복 거리 제거. 제품/시험/문서17파일.
- 보존: 인터벌 거리 안내(App.tsx 포함), 도구/운영 설정 등 타 작업 미커밋은 스테이징·배포에서 제외. 디자인 고정 문서는82·83만 부분 스테이징, 기존48 변경은 그대로 미커밋 유지. HANDOFF의 기존 타 작업 변경을 포함한 전체 파일은 커밋하지 않고 로컬 최신 상태로 유지.

## 검증

- 원본 pre-push: lib 의존 방향·DB 접근 통로·개발 부산물·tsc·동행 간격/소스 전환·진입 셀렉터21·코드 정련·전체quick **1563/0**, 모두 통과. 개발 부산물 만료8건은 기존 WARN. HMR24678 포트 경고에도 동행 게이트 PASS.
- 커밋된 web JS/TS11파일의 ESLint 별도 검사 통과. 새 CSS의 EOF 빈 줄을 제거하고 게시 전 커밋에 반영. 원본 훅/전역 설정은 유지, 실행 전용 `tmp/elevation-release-20261118/hooks/{pre-commit,pre-push}`에서 시스템 npm PATH를 설정해 원본 훅 호출(기존 Kimi npm 래퍼 우회, 검사 생략 없음).
- 배포용 소스: `git archive e0d2acfe`를 아래 별도 폴더에 풀고 설치된 의존성을 junction으로 연결, 기존 `.env`만 빌드 입력으로 복사(출력/커밋 없음). App/표고/미니맵 소스가 커밋과 동일함을 줄바꿈 정규화 후 검증. 원래 App.tsx 미커밋 내용은 이 사본에 없음.
- 커밋 사본에서 표고/미니맵 UI **22/22** 통과(포트5024), `npm run deploy:hosting`의 tsc+Vite build 성공. 기존 대형chunk 경고만 남음. 운영 Firebase 인증/주행 쓰기·실센서 시험은 하지 않음.

## 배포·운영 확인

- 프로젝트/대상: `boxcycle-dc2df`, **Hosting만**. 함수·Firestore/RTDB Rules 변경 없음.
- 주소: https://boxcycle-dc2df.web.app
- HTML HTTP200, `Cache-Control: no-cache, max-age=0, must-revalidate`.
- 운영 HTML 및 직접 참조된 JS4개·CSS1개가 배포 빌드와 바이트 단위 동일.
- 주 번들: `/assets/index-B8Cpv81F.js`, SHA256 `42b719261cfb1968ea753e53b6ebc50b5811653e10143d0e05ea8bf0b2ec3e16`.
- CSS: `/assets/index-B6hToEoK.css`, SHA256 `87beeb8930650e8b86bc1aa59a0f6900593fa421157c61ceba2ebf4806917ffe`.
- 운영 번들에서 `표고 출발점`·`표고 도착점`·`현재 표고`·`다시 불러오기` 및 readout CSS 확인, 폐기된 distance CSS 없음.
- 증거: `tmp/elevation-release-20261118/hosting-verification.json`·`release-evidence/`. 재생성/인증 입력을 포함할 수 있는 배포 사본은 비추적 tmp에만 보관, 재귀 정리 시 node_modules junction 대상에 유의.

실행 폴더와 재현 명령:

```powershell
Set-Location C:\20.HDev\boxcycle\tmp\elevation-release-20261118\source-e0d2acfe
& 'C:/Program Files/nodejs/npm.cmd' run deploy:hosting -- --project boxcycle-dc2df
Set-Location C:\20.HDev\boxcycle
node tmp/elevation-release-20261118/verify-hosting.mjs
```

확인 순서: 운영 화면 새로고침 → 경로 주행 → 표고선 양 끝 초록점/체크 깃발·하단 현재 표고 확인 → 접기/펼치기. 데이터 미수신이면 작은 `표고 — ›` → 눌러 사유/수동 재시도 확인.
