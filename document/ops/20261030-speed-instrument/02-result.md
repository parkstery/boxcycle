# 결과 — 체험 속도 계기판 스타일

2026-10-30 Codex 직접 구현·감리·캡처. LOCAL_VERIFIED, 커밋·푸시·배포 없음.

- Chief 승인 시안의 큰 숫자·km/h·6분할 게이지·파란 트랙·원형±·선택 체크를 실제 컴포넌트에 적용.
- 숫자는 기존 number 입력. 5~50 제한·직접입력/Enter·슬라이더/키보드·±·기존 콜백 유지. 게이지는 확정된 속도로 계산, 중복 상태 없음.
- 체험 모드에는 잘못된 페달 안내 대신 속도 선택 안내. 서버의 순위 조건에 따른 안내를 그대로 유지. 센서 상태·검색/해제/전환·주행 중 최초 연결 제한 유지.
- 체험 선택 후 실제 가로 창 420×214.5px, 좁은 화면 단일열. 센서 미선택 상태는 작은 readout으로 안내 공간 확보.
- 숫자 조절부를 버튼보다 DOM에서도 앞에 배치해 시각/키보드 순서 일치. 기존 회귀 시험의 옛 ‘＋는 숫자 왼쪽’ 조건은 승인된 ‘숫자는 조절부 위’로 수정.
- 고정51만 체험 계기판 스타일 승인 추가. 다른 작업 변경 보존.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
npm run build
npx eslint src/components/sensor/CadenceSensorSheet.tsx src/components/sensor/SessionSpeedControl.tsx e2e/ride-summary-compact.spec.ts
$env:RTW_DEV_PORT='5031'
npx playwright test ui-redesign-batch4.spec.ts --grep 'sensor|센서|케이던스|BLE|수동' --workers=1 --retries=0
node ../../document/ops/20261030-speed-instrument/verify.mjs
```

- 최종 build PASS(TypeScript 포함, 기존 큰 번들 경고), ESLint PASS, diff --check PASS.
- 기존 센서 UI 9/9 PASS: 3가로크기 경계, 연결/수동/단절 콜백, 주행 자동시작 없음, 주행 중 첫 연결 제한, 82rpm, BLE 미지원, 접근성·선택 후 닫기.
- 자체 검수30/30 PASS: 800×360·736×300·699×273·667×300·320×568 각각 센서/체험선택/연결/단절/미지원/주행중체험. 화면 경계·가로넘침·버튼/입력 잘림0, 체험 직접입력35→36→35·슬라이더Home5/End50·±비활성·게이지0/6·99입력50/빈입력5·닫기 검증. PNG 눈검수 PASS.
- 최초 작은 화면에서 버튼 잘림 FAIL → 숫자 영역 높이와 간격·미선택 숫자 크기 보정 후 PASS.
- Ego space17 DOM/조작 성공, 캡처 Page.captureScreenshot timeout FAIL → 별도 headless Chromium으로 캡처 성공. space17 종료.
- 동시 Claude 커밋/빌드 중 센서 파일이 이전 내용으로 돌아가 최종 검수가 게이지0/6 FAIL. 승인 변경 재적용·source-snapshot 사본 보존 후 빌드/ESLint/9건/30건 재실행 PASS. 최종4소스 해시가 사본과 일치.
- `ride-summary-compact`의 실앱/에뮬레이터 시나리오는 미실행(서버·데이터 로직 변경 없음, 이번 검증은 실제 제품 컴포넌트 in-memory preview). 실폰·실센서·운영Firebase 미검증.

증거: `evidence/qa.json`, `evidence/manual-800x360.png`, `evidence/manual-699x273.png`, `evidence/manual-320x568.png`. 이전 실패 출력은 최종 통과 근거로 사용하지 않음.

## 확인

기존 5031 개발 서버 유지. 종료됐으면:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

`http://127.0.0.1:5031/` → 센서 LED → 센서 없음 → 속도 숫자/±/슬라이더 확인.
저장 없는 검수: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=sensor` → 센서 없음.
