# 로그인 환경 복구

2026-10-23 Codex. Chief 보고: 프리뷰 실행 뒤 localhost:5021 로그인 팝업의 127.0.0.1:9099 연결 거부.

원인: 이전 안내의 `--mode harness`는 `.env.harness`의 demo 프로젝트·`VITE_USE_EMULATOR=1`을 쓰는 프리뷰/시험 서버다. 그 루트 `/`에서 실제 App을 열고 로그인하면 꺼진 Auth Emulator9099로 연결한다. 앱 인증 알고리즘 결함이 아니라 잘못 안내된 실행 모드다.

조치:
- 정상 개발 서버5000 복구. development env: emulator false, 필수 설정 true, demo project false. 비밀값 출력 없음. GET200.
- vite harness 모드의 `/`·`/index.html`은 로그인용 앱 대신 「검증 화면 서버예요」 안내와 정상앱/프리뷰 링크를 제공. scripts 프리뷰·시험 경로 유지.
- 로그인 주소는 `http://localhost:5000/`, 프리뷰는 `http://127.0.0.1:5020/scripts/ui-redesign-batch1/preview.html?state=menu`로 구분. 5021도 같은 harness 안내 적용.
- Playwright 실제브라우저에서 기존 Guest 복원·사용자정보 확인, 회원등록→정상 Firebase auth handler→Google accountchooser 연결 확인. 계정 선택·Google 로그인 최종 완료는 수행하지 않았으며 생성한 인증 팝업은 닫음. 인증 우회/운영 데이터 정리 없음.
- ego skill 적용: 실행 중 ego lite와 CLI0.6.0.20 설치 확인. CLI skill 성공; nodejs는 sandbox 및 권한확대 모두 bootstrap 연결 실패. 5분 반복 대기 없이 Playwright로 전환. ego 사용 가능하다고 보고하지 않음.
- OpenCode models에 9모델 존재. MiMo-v2.6-flash 짧은 조사 실행도 공통 Free usage limit으로 종료. 유료 구독/모델 전환 지출 없음. Cursor로 묶음2 실행 중.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5000'
npm run dev -- --host 0.0.0.0 --strictPort
```

Chief는 기존5021 탭 대신 `http://localhost:5000/`을 연다. 정상 서버는 유지 중. 개발앱이 운영 Firebase에 연결됨은 기존 개발 정책 그대로다. 프리뷰는 로그인 없이 확인한다.
