# 묶음 1 감리 — Codex

상태: LOCAL_VERIFIED / Chief 화면 확인 대기 · 2026-10-23

## 실행 분배

- [지시서](01-task-batch1.md): Chief 요청대로 OpenCode `opencode/deepseek-v4.1-flash-free` 조사·검토, `opencode/glm-5.3-flash-free` 검증 하네스, 로컬 Cursor 제품 구현에 배분.
- Supervisor는 실제 App 에뮬레이터 캡처 시험 `e2e/ui-redesign-batch1-live.spec.ts`를 추가. 메모리 하네스와 실제 앱을 구분한다.
- 실행자 결과는 직접 검증 전까지 승인으로 취급하지 않는다. 커밋·푸시·배포 없음.

## 인수·기준

- 시작 main2 `5671a014`. 기존 dirty 증거 JSON SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F`. `.out/`·`cdbox.bat` 보존.
- 실제 시안 PNG 06/07 열람. 07은 투명 지도 목록, 06은 흰 메뉴. 공통 흰 판 규칙보다 승인된 개별 07을 우선한다.
- ego-browser CLI 없음. 기존 설치 Playwright를 검증·캡처에 사용. 전용 harness 서버 `http://127.0.0.1:5020`, 기존 3000·5000 서버 유지.

## 검증 기록

| 명령 (실행 폴더) | 결과 |
|---|---|
| `npm test` (`C:\20.HDev\boxcycle\functions`) | PASS 169/169, 서버 소스 변경 없음 |
| `node scripts/check-document-system.mjs` (루트) | PASS 현재 문서 342·깨진 링크 0 (중간 확인) |
| `RTW_DEV_PORT=5020 npx playwright test ui-800x360 --workers=1 --retries=0` (`apps/web`) | 구현 중 중간 검사: 11 PASS·2 FAIL. :84 기존 조작바 높이44 >36, :259 새 메뉴의 입문 exact 접근성 이름 유실. 최종 구현 후 재검 필요 |
| `node scripts/check-code-tidy.mjs`·`node scripts/check-dep-direction.mjs --check` (루트) | 중간 PASS; 최종 diff 기준 재검 필요 |

## 최종 감리

Cursor 구현·재작업 후 Codex가 직접 diff·실제 PNG·실제 DOM·스타일을 확인했다. 입문 exact 접근성 이름, 제목 id, 레거시 CSS specificity(460px 잔류), 검색 글자색, 목적지의 출발 오표시를 재지시해 교정했다. 이어 Codex가 공통 목록 렌더링의 54줄 중복을 합치고, 중첩 모달 뒤 원래 메뉴 트리거로 포커스 복귀, 내 경로 3열·흰 글자·선택행, 밝은 지도 위 윤곽선, 뒤 조작부 숨김, Guest 안내 대비, Trail 두 행 공간을 교정했다. 내 경로의 날짜·프로필·만료·심사·이어달리기 상태도 두 번째 줄에 보존했다.

DeepSeek은 읽기 조사만 하고 보고 저장 전 무료 한도로 종료([기록](02-analysis-deepseek.md)). GLM은 preview 두 파일을 생성한 뒤 같은 공통 한도로 종료했고 Codex가 CSS·동작 관찰·시험을 완성했다([기록](03-result-glm.md)). 두 모델의 독립 감리 완료로 표시하지 않는다.

| 최종 검증 | 결과 |
|---|---|
| `npx tsc -b --noEmit` (`C:\20.HDev\boxcycle\apps\web`) | PASS |
| 변경 TSX·프리뷰·새 spec·ride-entry·위치 시험 eslint | PASS 오류 0, 기존 App hook 경고 7 |
| `node scripts/ride-verify/verify-selectors.mjs` (web) | PASS 19단계 |
| `npm run test:quick` (web, 프로세스 종료 허용 환경) | PASS 1353/1353; `evidence/batch1-unit-final.log` (마지막 감리 보완 후 재검 로그: `batch1-unit-complete.log`) |
| `npm test` (`C:\20.HDev\boxcycle\functions`) | PASS 169/169 |
| `RTW_DEV_PORT=5020 npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0` (web) | 17 PASS·기존 실패 1 (:84, 조작바 높이44 >36). 신규5/5·기존12/13. `evidence/batch1-ui-final.log` |
| 아래 에뮬레이터 명령 (web) | PASS 8/8 (기존 주행 진입7 + 실제App 캡처1). `evidence/batch1-app-final.log` |
| 루트 `node scripts/check-code-tidy.mjs` | PASS 반복18줄, 미사용 export185; 기준선 수정 없음 |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS 위반0·순환0 |
| `git diff --check` | PASS |

초회 단위 시험은 샌드박스의 프로세스 종료 차단 3건·위치 시험의 과거 증거 파일 쓰기 1건으로 실패했다. 프로세스 종료 권한이 있는 환경에서 재실행해 통과. 위치 시험은 출력만 기본 `test-results/entry-location-dom` / 선택 `RTW_ENTRY_LOCATION_EVIDENCE_DIR`로 교정했다. 덮인 추적 PNG는 HEAD로 복원했고, 시작부터 dirty였던 JSON SHA256은 위 값과 동일하다. 시험 조건·기준선 완화 없음.

에뮬레이터 첫 두 번은 전역 `playwright` CLI 충돌·잘못 추정한 설치 경로로 시험 시작 전에 실패. `require.resolve`로 실제 루트 node_modules 위치 확인 후 아래 직접 경로로 실행했다. 실제 주행 거리 시험은 부제에서 오른쪽 열로 옮겨진 새 배치에 맞춰 locator만 갱신, 양수·제목·수량 조건 유지.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5017'
$env:BATCH1_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence'
node scripts/e2e/run-with-deadline.mjs --limit-sec 600 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry ui-redesign-batch1-live --workers=1 --retries=0'
```

## 시안 대 실제 캡처

[비교 화면](comparison-batch1.html)에서 시안·실제 App·메모리 예시를 전환한다. `evidence/batch1-live-*.png`는 실제 App+Firebase 에뮬레이터, `batch1-preview-*.png`는 실제 제품 컴포넌트+메모리 데이터. 프리뷰는 제품 CSS·JSX 복제가 아니다. 실제폰 검증은 미실행.

| 항목 | 판정·차이 |
|---|---|
| MENU 06 | 300px 흰 판·18px 모서리·6행·선 아이콘·Trail 합류. 800×360에서 Trail 두 행 전체 노출. 667×300은 본문 스크롤로 접근 |
| 목록 07 | 740×324 투명 판·출처/검색/정렬/닫기·44px 기본행·오른쪽 거리. 긴 이름은 행 확장. 밝은 실제 위성지도 때문에 시안보다 글자 윤곽선 강화 |
| 가까운 순 | 지리 정렬이 없어 기존 최근순·거리순·이름순 유지 |
| 출발 주소·완주 | 실제 주소 없는 곳에 주소 생성 없음. 입문/퍼블릭 개인 완주 정보 없음; 실제 활동 배지만 표시. 내 경로는 실제 완주·진행률 표시 |
| 내 경로 | 기존 필터·선택 후 관리 도구 유지로 시안보다 상단2줄 추가. 두 번째 줄에 실제 날짜/만료/상태. 안내도 실제 행 선택→열기 동작에 맞춤 |

## 직접 확인

전용 서버 5020 유지. 아래 프리뷰는 운영 데이터에 쓰지 않는다. 이미 열린 화면은 새로고침한다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness
```

주소 `http://127.0.0.1:5020/scripts/ui-redesign-batch1/preview.html?state=menu`. 메뉴→입문→퍼블릭→내 경로, 검색·정렬·항목 선택 후 이름/삭제/이어달리기, ESC 복귀 순으로 확인. 비교 HTML은 아래 명령으로 연다.

```powershell
Set-Location C:\20.HDev\boxcycle
Start-Process 'C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch1.html'
```

Chief 화면 승인 대기. 커밋·푸시·배포 없음. 묶음 2 미착수.
