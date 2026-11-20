# 센서창 1/3 축소

2026-11-20 Codex. Chief 첨부 화면의 센서창을 1/3 크기로 줄이고 군더더기 문구와 내부 여백을 제거하라는 직접 지시를 적용했다. 기존 고정51의 센서창 부분을 대체한다. 계정창은 범위 밖이다.

- `CadenceSensorSheet.tsx`: 왼쪽 상태 열, 중복 제목·설명, 일반 순위 안내 문구와 중복 연결·페달 안내 제거. 제목/닫기 → 숫자·단위/±·슬라이더 한 줄 → 연결·선택 버튼 구조. 센서 연결 상태·장치명·rpm·단절/오류·미지원 안내는 필요한 상태에서 유지한다. 순위 조건은 기존 버튼 title로 유지한다.
- `CadenceSensorSheet.css`: 280px 단일 판, 체험 속도 상태 **280×108px**. 종전 420×211px 대비 면적 **34.1%**. 큰 계기 게이지를 숨기고 직접 입력 숫자·파란 슬라이더·증감·선택 체크를 유지한다. 공용 속도 컴포넌트·다른 설정창 CSS는 변경하지 않는다.
- 콜백·주행 입력 준비 판정·센서 연결 조건·데이터 로직은 유지했다. 다른 작업 변경 보존. 푸시·배포 없음.

## 확인

실행 위치 `C:\20.HDev\boxcycle\apps\web`.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
npm run test:sensor-cadence
node ../../node_modules/typescript/bin/tsc -b --pretty false
```

- 진입 셀렉터 21/21, 센서 로직·UI 계약 46/46 통과.
- 최종 소스에서 TypeScript·변경 TSX ESLint·관련 diff 공백 검사 통과.
- 기존 `sensor-dock.spec.ts` 10/10 통과(31.9초). 서버 기록이 없는 UI fixture를 기존 5199 Vite에서 검사하도록 임시 Playwright 설정 사용. 기존 미커밋 spec 변경 보존. 임시 설정 `tmp/sensor-compact-playwright.config.mjs`, 로그 `tmp/sensor-compact-e2e.log`.
- 852×393·800×360·699×273·667×300·320×568 × 체험/연결/단절/주행 중 체험/미지원 5상태 = **25상태 통과**. 화면 경계·가로 넘침·버튼 잘림 검사, 각 크기에서 직접입력35→증가36→감소35→슬라이더30 확인. 체험 상태 모두 280×108px. 임시 확인 스크립트 `tmp/sensor-compact-layout.mjs`, 측정 `tmp/sensor-compact-evidence/layout.json`, PNG 같은 폴더. 실제 제품 컴포넌트 PNG 눈검수 완료.
- Ego space30 DOM 실측 성공. 스크린샷은 2회 모두 Page.captureScreenshot timeout으로 실패하여 기존 UI fixture를 별도 headless Chromium으로 캡처했다. 이 실패를 성공으로 세지 않았다. space30 종료.
- 실폰·실물 센서 미실행. 기존 5199 서버 보존. 운영에는 미반영.

로컬 앱 `http://127.0.0.1:5199/`에서 RPM의 센서 단추 → 체험 속도 확인. 저장 없는 확인 주소는 `http://127.0.0.1:5199/scripts/ui-800x360/preview.html?state=sensor-riding-manual`이다.

임시 확인을 다시 실행하려면:

```powershell
Set-Location C:\20.HDev\boxcycle
node tmp/sensor-compact-layout.mjs
node node_modules/playwright/cli.js test -c tmp/sensor-compact-playwright.config.mjs
```
