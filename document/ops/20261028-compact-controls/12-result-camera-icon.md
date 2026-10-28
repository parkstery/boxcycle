# 2~6번 선택 버튼 카메라 아이콘

2026-10-28 Chief 첨부 지시로 상단 통합 카메라 버튼의 2~6번 상태를 `번호 · 파란 비디오 카메라 · 방향 화살표 · 캐럿`으로 표시한다. CameraViewMenu.tsx에 작은 inline SVG를 추가했다. 1번과 드롭다운의 번호·방향 도안, 카메라 계산·선택·접근성 계약은 유지했다. 작은 UI 보완으로 Supervisor 직접 구현·검증. 커밋·푸시·배포 없음.

관련 회귀에서 이전 계정 정렬 후 699×273의 둘째 줄 카메라 메뉴가 화면 하단을 넘는 문제를 발견했다. CameraViewMenu.css에서 높이330px 이하 패널에 viewport 기반 max-height와 세로 스크롤을 적용해 모든 항목에 접근하도록 했다. 아이콘 추가로 인해 패널 자체의 항목 수·크기가 늘어난 것은 아니다.

검증(실행 폴더 `C:\20.HDev\boxcycle\apps\web`):

- PASS: `npx tsc -b`, `npx eslint src/components/maphud/CameraViewMenu.tsx`.
- PASS: `npm run build`(타입·Vite), 해당 두 파일 `git diff --check`. 기존 Vite 대형 chunk 경고만 발생.
- PASS: `$env:RTW_DEV_PORT='5031'; npx playwright test e2e/compact-controls.spec.ts --grep '카메라|우상단' --workers=1 --retries=0` 최종5/5. 첫 실행4PASS/1FAIL(699×273 패널 넘침), CSS 보정 후5PASS.
- PASS: `node C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/camera-icon-check.cjs` — 800×360·736×300·699×273·667×300 ×2~6번20개 아이콘·번호·화살표·클릭위치·계정 비겹침, 1번 아이콘 유지. 결과 `evidence/camera-icon-check.json`, 새 캡처 `evidence/camera-icon-699x273.png`.
- 실제 폰·실주행·전체quick 미실행: 표시 아이콘 및 패널 경계 변경으로 관련 UI에 한정.

확인: 기존 http://localhost:5031/ 새로고침 → 주행 → 카메라 메뉴 →2~6번 선택. 서버가 없을 때만 아래 실행:

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
npm run dev:localhost -- --port 5031
```
