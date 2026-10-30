# 결과 — 도구 A안·Trail 밀도

2026-10-30 Codex 직접 구현·감리·캡처. LOCAL_VERIFIED, 미커밋·미푸시·미배포.

- 지도 스타일·줌±는 32px 흰 분할그룹, 계정은8px 떨어진 독립 둥근사각형32px. 닉네임 유지·약자원 없음·safe-area끝 정렬. 줌 문자를1.7px SVG 선으로 맞춤. 투명 클릭영역을 셀 폭에 제한, 양쪽 경계의 클릭 가로채기 없음.
- 긴 닉네임도 4가로크기에서 잘리지 않음. 680px이하 가로+긴 누적거리 조건에서는 계정은 위끝 유지, 도구·카메라만 다음줄로 내려 계기판 겹침 방지. 일반값은 한줄 배치.
- Trail 현재식별부는28px 한줄. 번호/지역명/거리/합류도26px 한줄(구분선 포함). 연한 파랑 현재행·파란 합류/번호·초록 정적 주행상태, 타 Trail 주행중 합류 비활성. 공개/비공개는 기존 호스트권한 그대로. 큰 카드·두줄행·상하 중복 설명 없음. 목록에 남은 높이를 전부 배분하고 그 목록만 세로 스크롤.
- 새 데이터 조회·정렬·인원 의미·콜백·주행 제어·인증 변화 없음. 지도 위 접속표시/사용자 목록도 범위 밖. 고정55에 이번 승인 기록.
- preview의 `trailPreview` 옵션에만 12개 in-memory Trail과 콜백 카운터 추가. 제품 목록에 가짜 데이터 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

```powershell
npm run build
npx eslint src/components/trail/TrailHubPanel.tsx src/components/maphud/MapHud.tsx e2e/toolbar-trail-style.spec.ts scripts/ui-800x360/preview.tsx
node scripts/ride-verify/verify-selectors.mjs
$env:RTW_DEV_PORT='5031'
$env:TOOLBAR_TRAIL_EVIDENCE='C:\20.HDev\boxcycle\document\ops\20261030-toolbar-trail-implementation\evidence'
npx playwright test toolbar-trail-style.spec.ts ui-800x360.spec.ts --grep '도구A|Trail 한줄|주행 도구|고정30|준비·주행의 지표' --workers=1 --retries=0
```

PASS: build(TypeScript 포함, 기존 큰번들경고), ESLint, 셀렉터21/21, 관련e2e22/22(신규20·기존2), diff --check. 이후 preview 줌 콜백 카운터/검증 추가분4/4 재실행PASS·ESLintPASS. 제품 소스는 최종22PASS 뒤 변경 없음(주석 제외).

| 화면 | 대기 완전 표시 행 | 주행 완전 표시 행 |
|---|---:|---:|
| 800×360 | 10 | 9 |
| 736×300 | 7 | 6 |
| 699×273 | 6 | 5 |
| 667×300 | 7 | 6 |

모든 크기: 총12행 유지·마지막행 스크롤 접근·가로넘침0·26px행·합류 콜백·호스트공개 전환·주행중 타Trail 비활성PASS. 도구4크기:32px높이·8px간격·끝정렬·경계hit test·스타일 위성/야외 전환·줌±각1회 콜백·계정열기PASS. 주행/일시정지 긴 거리·닉네임에서 계기판/도구/계정/카메라 비겹침8상태PASS. PNG 눈검수PASS.

초기 실패: preview 중복 User import로 로드FAIL→중복제거. fixture Date.now 렌더 ESLint2FAIL→지연 state초기화. 추가 비겹침 시험의 옛카메라셀렉터8FAIL→실제 `.camera-view-menu`로 수정. 667px긴값 실제겹침2FAIL→조건부2행·12px행간 보정 후22PASS. 실패를 통과로 계산하지 않음.

Ego-browser 스킬 사용: space18에서699×273 실제 메뉴 열기·목록6행/전체12행 확인, 종료완료. 재현 가능한 캡처/조작은 headless Chromium Playwright로 수행. 실폰·실센서·운영Firebase·실계정합류 미실행(제품 UI만 수정, in-memory 실제 컴포넌트). Firebase 미배선으로 ride-entry live 미실행, 셀렉터21단계 방어선은PASS.

## 확인

5031 기존 서버 사용(5032에 추가 실행한 검수서버는 종료). 필요시:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

`http://127.0.0.1:5031/` 새로고침→우상단 지도스타일/줌/계정→왼쪽 반달Trail메뉴. 실제 Trail은 활성 데이터 수만큼 표시.
12행 로컬 검수: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=ready&trailPreview=1` → 왼쪽 메뉴. 주행/호스트예시는 `&trailRiding=1` 추가.
