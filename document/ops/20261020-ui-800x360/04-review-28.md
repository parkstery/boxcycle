# 거리·방향 출발 즉시 지정 검수·릴리스

2026-10-22 · record · DEPLOYED / Chief 실제폰 확인 대기. [지시28](02-task-28.md) · [결과28](03-result-28.md).

실제 diff 확인: 출발 미지정·거리 탭에만 즉시 출발 경로 추가, 기존 출발 버튼 처리 공통화, 거리 탭의 버튼 영역 제거, 안내 원문 교체. 일반 위치/기존 방향 탐색 유지. 기존 ops26/27 기록 원문 보존, 공용 ops 두 파일의 기존 미커밋 변경 및 out/evidence/cdbox 제외.

거리145 PASS, 브라우저 최종4 PASS/29.0s, 타입/build PASS, lint 오류0/기존경고8, diff 검사PASS. 브라우저는 실제 MapView/hook/HTTP adapter를 사용하되 지도와 API 응답 대체. 출발·도착 탭 버튼 복귀, 거리 탭 짧은 클릭 무선택, 터치 긴 누름 즉시 출발·임시마커0, 연속 방향 재탐색·삭제 후 마우스 긴 누름·늦은 응답 무시 확인. 실제폰 미검증.

최종 브라우저 명령:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5002'
node scripts/e2e/run-with-deadline.mjs --limit-sec 100 -- node ../../node_modules/@playwright/test/cli.js test e2e/distance-route-continuation.spec.ts e2e/map-route-runtime.spec.ts --workers=1 --retries=0 --reporter=line
```

Chief 확인: 운영 배포 후 https://boxcycle-dc2df.web.app 새로고침 → 가로화면 → 경로 생성/거리·방향 → 출발 미지정 안내·출발 버튼 없음 → 지도 위치 길게누르기 → 출발점 즉시 표시 → 거리 선택·방향 선택 → 경로 생성. 로컬 실행 필요 시:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

접속 http://localhost:5002. 기존 서버 보존. Git/Hosting 최종 결과는 아래에 추가한다.

## 릴리스 결과

- 제품 a55fb50a (`fix(route): select distance route start on long press`)와 기존 검증된 a1f78084/b4b22aa2를 origin/main2에 반영. 원격 a55fb50ae93d3afbed68fbf95803e1394078bdc5 확인.
- 첫 push는 Git Bash의 Kimi npm shim 환경변수 공백으로 실패. 해당 Bash 프로세스 PATH에 시스템 nodejs를 우선하고 ENTRY_LOCATION_TEST_BROWSER=chromium 지정 후 훅 재실행. 게이트/훅 우회 없음.
- 최종 pre-push exit0: 전체 단위1340 PASS/0 FAIL(73.3s), 타입·의존성·부산물·동행재생·진입셀렉터19 PASS. `.out/step28-push-final.log`.
- 저장소 루트 `firebase deploy --project boxcycle-dc2df --only hosting --non-interactive`: exit0, 46파일/업로드/버전확정/릴리스 성공. `.out/step28-deploy.log`. Functions/Rules 변경 없음.
- `node .out/verify-step28.mjs`: exit0, 운영4파일 모두HTTP200/로컬SHA-256일치. `.out/step28-production.json`.

| 파일 | SHA-256 |
|---|---|
| index.html | 16a5d09d954d5edc30f1a3b5b2cf33d9a46c24e24d60fd2033249909c1614d37 |
| assets/index-CSthu3z_.js | 5bcfad937a31fdf22cb6a37d1d5c2b9df8e788da71f533bfb47293365117cd0f |
| assets/jsx-runtime-1YrJdh_0.js | 0d12fda61ef6df75717ab89d9cb62feb5711275aa1279dcfe6ce18b3bd764522 |
| assets/index-Dso_iwiW.css | e7808d742bec28dfca26c9ce4ebad637f7ad90d8f047fa8e50555650d228c7c9 |

공용 ops 색인은 이번 릴리스 한 줄만 선별 stage하여 기존 미커밋 내용은 로컬 보존한다. 실제폰/실 API 미검증 상태로 Chief 최종 사용 확인 대기.
