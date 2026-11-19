# 3D·DPR·카메라 Hosting 배포

수행: Codex · 2026-11-19. Chief 커밋·푸시·배포 승인. 흰 화면 오류 조사는 Chief 지시로 보류, 원인 해결을 주장하지 않는다.

## 배포 범위

- 배포 소스 `4c1f2ef0c8729109b369eb418b6a88d04ddcfafd`.
- 원격에 함께 반영한 기존 커밋: `d937c6c7` 결과창/RPM 타이틀 정렬, `98b78269` QC2·3 지형회피.
- 신규 `12f9e121`: DPR 기본1.5, perflab 전환/Context Loss/버퍼 기록, riders OFF 및 자동 지형 전환 중 mapcut 보존. custom rider 레이어는 getStyle 직렬화에서 제외되므로 getLayer로 존재를 확인하도록 수정.
- `4c1f2ef0`: 정련 게이트가 찾은 미사용 export2개를 internal const로 정리. 동작 변경 없음.
- 타 작업의 미커밋 App 인터벌 안내·표고 timeout·센서 등은 스테이징/배포에서 제외하고 보존. Git Hooks/전역 npm 설정 변경 없음. 건물 충돌·FPS 병목 최적화 추가 없음.
- 대상 Firebase `boxcycle-dc2df` **Hosting만**. 함수·Rules 배포 없음.

## 검증·배포

- 정상 pre-commit 통과(기존 MapView hook 경고10).
- 원본 pre-push 검사 통과: 의존 방향·DB 통로·dev-tools·tsc·동행 간격/전환·진입 셀렉터21·정련·전체quick **1581/0**. 기존 만료 경고8·interval-route-hint 그룹 경고 유지.
- 최초 push 실패: 기존 Kimi npm 래퍼가 비어 있는 runtime 변수로 실행 실패, 미사용 export2개 증가. export 정리 후 실행 전용 `tmp/3d-release-20261119/hooks/pre-push`에서 시스템 Node/npm PATH를 먼저 주고 원본 `githooks/pre-push`를 실행했다. 게이트 생략 없음.
- 배포 사본: `git archive 12f9e121` 추출 후 후속 4c1f2ef0의 한 파일을 git show로 반영. 빌드/시험 입력 **1416파일**을 4c1f2ef0 Git blob과 대조해 일치 확인(CRLF 정규화1178). 원본 미커밋 변경 없음. Windows tar의 한글 파일명 추출 실패 사본은 사용하지 않고 Python tarfile UTF-8 추출 사본 사용.
- `node_modules`와 변하지 않은 functions 시험 산출물은 기존 설치에 junction. env는 기존 production 빌드 입력만 복사, 내용 출력/커밋 없음. 사본은 비추적 tmp에만 보관하며 junction을 포함하므로 재귀 정리 주의.
- 커밋 사본 tsc·Vite build 통과(기존 큰 chunk 경고). 커밋 사본의 DPR/계측/mapcut/카메라 관련 시험 **40/0**.
- Firebase CLI Hosting release complete. 운영 HTML HTTP200·no-cache. 빌드의 HTML 및 assets17개 모두 운영과 바이트 일치.
- 운영 진입 번들 `assets/index-3GBKEZ_r.js`, CSS `assets/index-M8eXKDYp.css`. 해시는 `tmp/3d-release-20261119/hosting-verification.json` 참조.
- Ego 운영 브라우저 smoke: CSS800×360·nativeDPR3에서 JS DPR1.5·canvas/GL1200×540, contextLost=false, React root 생성, 수집된 실행 예외/target crash0. 주행 기록 쓰기·실센서 없이 로딩 확인이며 실제 폰 주행 성능 보증은 아니다. 작업 공간 종료.

주소: https://boxcycle-dc2df.web.app/
확인: 새로고침 → 기존 문제 경로 → 3D ON → QC2/3 지면회피, 결과창/RPM 확인. 수동 maxdpr 쿼리가 있으면 그것이 기본1.5보다 우선하므로 기본값 시험 시 제거한다. perflab=1은 계측용.

실행 폴더와 명령:

```powershell
Set-Location C:\20.HDev\boxcycle\tmp\3d-release-20261119\clean-12f9e121
& 'C:/Users/kdrea/AppData/Roaming/npm/firebase.cmd' deploy --only hosting --project boxcycle-dc2df --non-interactive
Set-Location C:\20.HDev\boxcycle
node tmp/3d-release-20261119/verify-hosting.mjs
```

증거: `source-verification.json`, `push-final.log`, `hosting-deploy.log`, `hosting-verification.json`, `browser-verification.json`(모두 tmp/3d-release-20261119).

미실행: 운영 실센서·물리 폰 장시간 주행, 3.41fps 원인 개선. 이전 흰 화면 사건은 보류 중이며 이번 새 탐색의 정상 로딩과 구분한다.
