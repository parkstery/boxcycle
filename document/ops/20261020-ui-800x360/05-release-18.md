# UI·지도 길게누르기 릴리스18

| 항목 | 내용 |
|---|---|
| 문서 유형 | record |
| 작성 | 2026-10-22 |
| 상태 | DEPLOYED / Chief 실제폰 확인 대기 |
| 근거 | [통합검수18](04-review-18.md) |

Chief가 승인한 계기판13~14(박스 없는 검정 외곽선), 주소창15~16(미니맵 동일폭), 지도17~18(정지500ms 길게누르기, 메뉴/이동/확대 차단)을 배포했다.

## Git·게이트

- `2bc02dc2`: 계기판/주소 UI. `95020c5e`: 길게누르기/회귀시험. `e7fd5acf`: 기존 방향선택 계약 갱신.
- `codex/map-route-long-press-20261022` push exit0 → main2 fast-forward 병합 → main2 push exit0. 원격 두 ref 모두 `e7fd5acfcbf8e880e0929f437e08b85a88bbc3d9` 확인. main 변경 없음.
- 최종 pre-push 전체 PASS: 단위1335/실패0/취소0, 타입, 의존성, 개발부산물 등록부, 동행 재생, 진입 selector19. 브랜치와 main2 푸시 모두 통과. 로그 `.out/release18-push-final.log`, `.out/release18-main2-push.log`.
- 최초 Git Bash npm shim 문제는 해당 Bash의 PATH에 정상 Node 설치 우선 지정으로 해결. 기존 위치 DOM 시험이 기본 Edge에서60초 timeout되어 게이트가 차단됐으나 기존 지원 환경변수 `ENTRY_LOCATION_TEST_BROWSER=chromium`으로 지정 후 단독1 PASS·전체1335 PASS. 게이트 우회/훅 변경/시험 제거 없음.
- 브라우저 통합12 PASS(실제 MapView+Mapbox2, 긴 주소1, 경로·주행9), 기존 UI13 PASS. 실지도 타일은 stub이고 실제폰 체감 미검증. 변경파일lint 오류0/기존MapView경고8. 최종 build exit0, 기존 SADDLE/PELVIS·큰 번들 경고 유지.
- 공용 ops 두 파일의 기존 미커밋 변경은 임시stash→복원, 두 파일 해시 원상 일치 확인. 관련 없는 .out/cdbox/evidence 변경은 커밋 제외.

## 배포·파일 일치

`C:\20.HDev\boxcycle`에서 `firebase deploy --project boxcycle-dc2df --only hosting --non-interactive` exit0.46파일 업로드·finalize·release 완료. Functions/Rules/운영 데이터 변경 없음.

운영 https://boxcycle-dc2df.web.app 의4파일 모두 HTTP200/로컬빌드SHA-256 일치:

| 파일 | bytes | SHA-256 |
|---|---:|---|
| index.html |632|d9bfc0805be76dc54b0d21aca3f1b97f06132d5f03305764e1bb1badb623a82c|
| assets/index-CDjgoVCm.js |3738196|7adfa82731837d7ce5bdf259c836dba0a8a73be8680e620fa516af115954ba3f|
| assets/jsx-runtime-1YrJdh_0.js |8446|0d12fda61ef6df75717ab89d9cb62feb5711275aa1279dcfe6ce18b3bd764522|
| assets/index-IesAu7_8.css |229157|52564a5ea4c36b194cbd035cfa39c25276c35e264ddc50fa6c4a3f017fed2b29|

## 서버 정리·Chief 확인

Chief 추가 요청으로 개발 Vite5000(PID29340)/5002(PID11932) 종료. 5180은 조사 시부터 비실행. 시험 임시서버는 시험완료 후 종료. 최종3000/5000/5001/5002/5173/5180/24678 검사에서3000(PID15620, imgman)만 수신 확인. OS·동기화·다른 앱 내부 서비스는 종료대상에서 제외했다.

운영주소를 새로고침(남으면 강력새로고침) → 가로화면 → 짧은지도탭은 경로창 없음 → 같은 위치에서 약0.5초 누르면 경로창 → 출발 지정 → 다른 위치 길게누르고 도착/경유 지정. 메뉴/지도밀기/핀치확대에서 의도치 않은 위치가 찍히지 않는지 확인. 거리·방향 명시 준비 상태의 짧은 탭은 방향선택으로 동작한다.

현재 로컬 개발서버는 꺼져 있다. 필요할 때만 아래 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 — 운영 확인에는 로컬 실행 불필요.
