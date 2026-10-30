# 결과 — 구름 버튼 상단 밀착

2026-10-30 Codex 직접 구현·감리·캡처. 로컬 검증 완료, 미커밋·미푸시·미배포.

카메라/지도스타일/줌±/계정의 정형 버튼 배경을 흰 구름 SVG alpha-mask로 대체. 외곽 Gaussian feather .65, 글자/아이콘은 마스크 밖의 선명한 전경. 별도 raster이미지/네트워크자산/상태로직 없음. 32px 버튼·지도도구 독립 셀·계정8px간격·닉네임·포커스/클릭/장애상태 보존. 카메라 메뉴 내용은 기존대로. 위쪽 margin/padding 추가 없음, safe-area 위끝 유지.

기존 MapHud.css/CameraViewMenu.css 뒤에 CloudMapControls.css를 import해 앞선 A안 레이아웃을 보존하고 외형만 대체. 밝은/어두운 혼합지도 위에서 읽을 수 있게 흰코어96%, 파랑/남색 전경. 강제색 모드에서는 일반 시스템색 버튼 fallback. Trail/순위/인터벌은 이번 구현에서 변경 없음. 고정56에 승인 기록.

## 검증

실행 `C:\20.HDev\boxcycle\apps\web`:

```powershell
npm run build
npx eslint src/components/maphud/MapHud.tsx e2e/toolbar-trail-style.spec.ts
node scripts/ride-verify/verify-selectors.mjs
$env:RTW_DEV_PORT='5031'
$env:TOOLBAR_TRAIL_EVIDENCE='C:\20.HDev\boxcycle\document\ops\20261030-cloud-toolbar-implementation\evidence'
npx playwright test toolbar-trail-style.spec.ts --workers=1 --retries=0
```

PASS build(TypeScript포함, 기존큰번들경고), ESLint, 셀렉터21/21, e2e20/20, diff --check. e2e:800×360·736×300·699×273·667×300, 도구상단0·32px높이·독립8px·mask실재/일반배경/테두리없음·경계hit/스타일전환/줌각1회/계정열기·주행/일시정지긴값 비겹침·카메라열닫기. 앞선 Trail밀도/합류 회귀8건도PASS.

추가1000×455 실제컴포넌트 캡처: map-hud__tr / 카메라 / 지도도구 / 계정의 y가 모두0. cloud-1000x455.png·cloud-toolbar-detail.png 눈검수PASS. 마스크는 실제 DOM 버튼의 외곽만 바꾸므로 투명구름 여백에서도 사각형 클릭영역 유지. 검수스크린샷 일부에 키보드포커스 표시가 있으나 클린캡처2장은 포커스 없는 상태.

실폰/WebKit·운영Firebase·실센서 미실행. 인증/주행 시작변경 없어 ride-entry live 미실행(셀렉터계약은PASS), 위성지도의 실제픽셀검증 대신 기존 in-memory실제품 preview 사용. 기존5031서버 재사용. 다른작업파일 보존.

## 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

`http://127.0.0.1:5031/` 새로고침→우상단 구름외곽/상단밀착→지도스타일·줌±·계정→주행시 카메라 메뉴.
저장없는확인 `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding`.
