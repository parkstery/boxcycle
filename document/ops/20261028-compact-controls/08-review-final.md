# 최종 감리 — 로컬 구현 완료

상태: **APPROVED / LOCAL_VERIFIED, Chief 실폰 확인 대기·미배포**. 구현 Cursor AI, 계획·독립 감리 Codex. Chief「구현하라」승인 범위 완료. Cursor 첫 실행 session65555·보완85856 모두 종료. 커밋·푸시·배포 없음.

## 최종 동작

- 주행 거리 순위 창: 기본440×236px, 행24px·왼쪽1~5/오른쪽6~10위. 데이터10명 이상일 때10명 동시 표시, 실제 인원 부족시 있는 행만 표시. 기존740×324 대비 면적 약57% 감소. 추가 순위/내 주변·개척 이용은 접어서 접근 유지. 게스트·빈목록·오류도 유지.
- 반달: 좌우 보이는 크기20.4×43.2px(기존 가로·세로60%). 터치44×76 유지·클릭/기존 제스처 유지.
- 주행 설정: 폭460px·두열. 기본 및 최대유효인터벌/미설정/음악비활성/고도로딩 혼합상태에서699×273 안에모든컨트롤과설명표시·스크롤0. 스트레스실측460×257px, y8~265. 준비/마무리/다중라운드·휴식 요약, 운동설정/프로필편집 이동복귀 유지. 시안약249px보다높이8px차이는44px닫기와내용노출을위한실제측정결과로허용.
- 카메라: 단일트리거, 두세로컬럼동시열림. 왼쪽1번62px·높이우측정렬, 오른쪽2~6기존방향도안·6아래3D. 판154×235px. 선택·Escape포커스복귀·외부닫기 유지. 카메라계산·지도스타일정책은변경하지않음.

실제제품소스는7파일 변경. 新compact-controls spec1개·기존관련spec/preview fixture 수정. baseline 대비 audit-current.diff로 이전dirty와구분해감리. App/데이터서비스/카메라계산/functions/Rules/dep-layers.json은 이번 baseline에서불변. 동행시험2개는카메라트리거셀렉터교정만이며동행알고리즘변경없음.

## 독립 검증 (Codex 직접 실행)

실행폴더 `C:\20.HDev\boxcycle\apps\web`, 기존5031재사용. 각명령의원본출력은evidence/에보존.

| 명령 | 결과·증거 |
|---|---|
| `$env:RTW_DEV_PORT='5031'; $env:COMPACT_CONTROLS_EVIDENCE_DIR='C:/20.HDev/boxcycle/document/ops/20261028-compact-controls/evidence/final-review'; npx playwright test e2e/compact-controls.spec.ts --workers=1 --retries=0 --output=../../document/ops/20261028-compact-controls/evidence/final-test-results` | **24 PASS/0 FAIL**, final-compact-tests.log |
| `$env:RTW_DEV_PORT='5031'; npx playwright test e2e/ui-800x360.spec.ts e2e/ui-redesign-batch4.spec.ts e2e/ride-interval-settings.spec.ts e2e/ride-ui-moments.spec.ts e2e/map-menu-consolidation.spec.ts --workers=1 --retries=0 --output=../../document/ops/20261028-compact-controls/evidence/final-regression-results` | **66 PASS/0 FAIL**, final-regression.log |
| `npx playwright test e2e/ui-800x360.spec.ts --grep '주행·일시정지는\|Chief 고정10' --workers=1 --retries=0` (PowerShell 실제인수는ログ参照) | 캡처경로수정2 PASS, review-capture-guard.log. 위66에도포함됨 |
| `npm run test:ride-camera-framing` | **102 PASS/0 FAIL**, review-camera.log |
| `node scripts/ride-verify/verify-selectors.mjs` | **19계약PASS**, review-selectors.log |
| `npx tsc -b --noEmit` | PASS, review-tsc.log |
| `npx eslint src/components/leaderboard/LeaderboardSheet.tsx src/components/maphud/CameraViewMenu.tsx src/components/ride/RideSettingsPanel.tsx scripts/ui-800x360/preview.tsx e2e/compact-controls.spec.ts e2e/ui-800x360.spec.ts` | 오류0, review-eslint.log |
| `npm run build` | PASS, review-build.log. 기존큰청크경고 |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS, review-dependencies.log |
| 대상 `git diff --check` | PASS, review-diff-check.log. CRLF안내만 |
| 루트 `node scripts/check-code-tidy.mjs` | **FAIL 기존knip188>186**, 착수독립실행도동일. 새export증가없음 |
| 루트 `python document/ops/20261028-compact-controls/evidence/audit.py` | **보호이미지2181/2181동일**, 기존허용소스21변경·신규spec1. audit-current.json/diff |

핵심화면24와회귀66은최종같은코드에대한서로다른90시험이며, 캡처경로2건은66안에포함되므로별도합산하지않는다. 실제제품컴포넌트의폰가로4크기검증·개척터치정보/마지막행접근·설정스트레스 전체rect를검증했다. 별도독립MCP프로브에서도개척하단285→264px교정/각주접근·모든설정node경계내확인(`rework-independent-probes.txt`). 캡처 `final-review/` 및 `settings-stress-independent.png`를눈검수.

## 실패·보존·미실행 사실

1. 1차독립감리에서개척확장창하단12px넘침/행별개척uses가title에만남음/설정스트레스미검증을발견해Cursor재작업. 최종해결·회귀고정.
2. Cursor1차회귀가이전증거PNG11개를덮어썼다. **착수전ZIP 원본에서11개전부해시일치복구**, 생성파일도 `relocated-first-pass/`에보존. Supervisor가ui-800x360두캡처기본출력을`testInfo.outputPath`로교정해과거폴더재작성차단. 최종2181해시동일. 04보고「덮어쓰기없음」은사실과달랐으며본감리가우선. 과거묶음원본미복구10장은이번복구대상이아니고이전인계대로미해결.
3. Cursor07의「1차전체quick이미실행」은04및로그와불일치. **이번test:quick은미실행**. UI범위관련화면90·카메라102·진입19·타입/빌드로검증,전체quickPASS로보고하지않는다. 07의관련회귀집계도서로다르므로최종수치는상기독립실행로그를정본으로한다.
4. 실폰·실계정순위API·실센서/오디오/실지도주행은미실행. preview는실제제품컴포넌트+검증fixture이며실계정기록증거로주장하지않음. 브라우저실행/기본카메라선택프레이밍알고리즘은기존유지. 주행중오른쪽반달의윤곽선Glance는기존그대로며전체불투명순위창이이번축소대상.
5. 기존code-tidy 실패는미해결. 프로필편집별도창2px서브픽셀스크롤은이번주행설정스크롤금지대상이아님.

## Chief 확인

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
# 기존5031서버가없을때만실행
npm run dev:localhost -- --port 5031
```

기존서버유지, http://localhost:5031/ 새로고침 → 메뉴의순위로전체순위창/10명목록(실제10명데이터필요) → 주행설정모든항목 → 주행카메라단일버튼·양컬럼 → 좌우반달비율/동작확인.

즉시재현용실제컴포넌트fixture:

- `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=leaderboard`
- `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=settings&settingsStress`
- `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding`

다음은Chief실폰확인및별도배포지시. 구현·필수로컬감리는완료했으며승인없는커밋푸시배포는하지않음.
