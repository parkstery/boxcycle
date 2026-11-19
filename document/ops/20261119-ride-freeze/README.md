# 주행 중 멈춤·흰 화면 조사

수행: Codex · 2026-11-19. 상태: Chief 지시로 보류. 제품 변경 없음. 후속 Chief 「이 오류는 지금은 무시하고 넘어간다. 커밋하고 푸시해」 및 「배포도 해」. 흰 화면 원인 확정 없이 이번 오류 조사를 보류하고 검증된 변경의 배포를 진행한다.

Chief: 개발용 localhost5000에서 주행 중 멈췄고, 800×360 기기 에뮬레이션 화면이 흰색. 콘솔에 manifest.webmanifest/@react-refresh/client/main.tsx/브랜드SVG 오류6개가 있지만 실제 오류 문구는 스크린샷에 없다. 콘솔 toolbar의 「6개 숨김」·맞춤 수준 표시도 보인다. 직전 3.41fps 로그의 성능 저하와 흰 화면의 원인이 같다고 아직 단정하지 않는다.

## 현재 확인

- 기존 Vite PID17556, 127.0.0.1:5000 LISTEN. 프로세스 시작07:55 KST로 살아 있다. 재시작·종료 없음. 다른 프로젝트 프로세스도 종료하지 않았다.
- HTTP: localhost/127.0.0.1 HTML, localhost의 /@vite/client, /@react-refresh, /src/main.tsx, /manifest.webmanifest 모두200(47~161ms). 오류 시점의 응답 상태를 소급 확정하는 증거는 아니다.
- Ego 별도 브라우저 작업 공간에서 http://localhost:5000/?perflab=1 앱 root·지도 canvas가 생성되고 기존 로그인 상태의 화면이 로드됐다. 800×360 크기 변경 후에도 root/canvas 유지. 새 탐색의 Network.loadingFailed/Runtime.exceptionThrown/targetCrashed 이벤트0. 주행 시작·Trail 합류·경로/기록 조작 없이 로딩만 관측했고 작업 공간 종료.
- 사용자 Chrome157의 기존 문제 탭은 직접 제어하지 않았다. 별도 Ego Chrome156의 정상 로딩으로 기존 탭의 복구나 멈춤 원인 해소를 판정하지 않는다.
- 사용자에게 콘솔 main.tsx 또는 @vite/client 오류 본문을 비동기 요청했다. 요청 결과가 오면 접속 실패/리소스 로드 차단/실행 예외를 분류한다.

## 조사 재개 시 다음

원본 탭의 오류 본문 우선 보존. 맞춤 로그 수준/필터로 숨은6개 오류를 펼쳐 정확한 문자열 확인. 현재 서버가 정상 응답하므로 원인을 모르는 상태에서 서버를 재시작하지 않는다. 브라우저 재현으로 필요해지면 해당 오류 경로만 수정한다. 브라우저 재시작·스토리지 삭제·전체 작업 되돌리기는 수행하지 않았다.

실행 폴더 C:\20.HDev\boxcycle. 확인 명령:

```powershell
Set-Location C:\20.HDev\boxcycle
Get-NetTCPConnection -State Listen -LocalPort 5000
Invoke-WebRequest http://localhost:5000/src/main.tsx -TimeoutSec 8 | Select-Object StatusCode
```

문제 주소는 기존 localhost5000의 사용자 주행 탭. 별도 로딩 관측은 http://localhost:5000/?perflab=1.
