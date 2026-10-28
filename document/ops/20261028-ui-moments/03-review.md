# UI·인터벌·응원 최종 감리

2026-10-28 / Supervisor Codex / 구현 Cursor AI. 제품 관련 로컬 검증 완료, **전체 게이트 완전 통과 및 증거 보존 완료로 판정하지 않는다.** 커밋·푸시·배포 없음.

## 반영 및 감리 수정

- 계기판 3열 2행·가로폭 50% 이하, 계정 초성 원 제거, 좌우 공통 반달 핸들, 인터벌 왼쪽·순위 오른쪽. 699×273에서도 순위 목록 최소 한 행을 실제 노출하도록 상단 간격 수정.
- 운동 설정 3개 기본 구성·직접 조절 접기·최근 적용값 복원. 기존 v1 저장값 호환, 라운드·라운드 사이 회복 지원. 같은 설정 적용은 타이머 유지, 변경 적용은 재시작.
- 시작·중간·경유·전환 예고·고저 전환·인터벌 완료·주행 종료 응원을 기존 코칭 위치에 통합. 소리 기본 끔, 모션 감소 대응. 무센서는 자기조절 타이머이며 기존 개발용 속도 조절 유지.
- Supervisor가 runKey 전달 누락, 전환/종료 우선순위, 종료 문구 유지, 새 실행/해제 취소, React StrictMode 정리를 교정하고 실제 React+MapHud 통합 시험 추가.
- Cursor의 경로 카드/미니맵 겹침 assertion 삭제는 되돌렸다. 실제 두 패널의 왼쪽 여백을 48px로 조정하여 반달 터치 영역을 피한 뒤 전체 UI 재검증.

## 검증 결과

실행 폴더: `C:\20.HDev\boxcycle\apps\web`. 명령별 로그는 이 묶음 `evidence/`에 보존.

| 검증 | 결과 | 근거 |
|---|---|---|
| 화면 5개 spec 최종 묶음 | **54 PASS**, 2.0분 | supervisor-ui-final.log |
| 최종 build (tsc 포함) | PASS, exit 0 | supervisor-build-final.log |
| 독립 tsc / 관련 eslint | PASS | supervisor-tsc.log / supervisor-lint.log |
| 실제 React/MapHud StrictMode 통합 | PASS | supervisor-moments-dom-final.log |
| 독립 응원 상태 프로브 | 8 PASS | review-probes.ts 및 실행 결과 |
| selector / 의존 방향 / diff 공백 | 19 PASS / PASS / PASS | Cursor 결과 및 supervisor-dep-final.log, supervisor-diff-check-final.log |
| 최종 전체 quick | **1430 PASS / 4 FAIL**, exit 1 | supervisor-quick-final.log |
| quick 실패 entry-location 개별 재실행 | 1 PASS, loader 포함 명령으로 실행 | supervisor-entry-location-rerun-loader.log |
| quick 실패 watchdog 개별 재실행 | 4 PASS, 자식 프로세스 종료 권한 필요 | supervisor-watchdog-rerun.log |
| 코드 정련 게이트 | **FAIL**: exports 188 > 저장소 기준 186 | supervisor-code-tidy-closeout.log |

quick 실패는 병렬 타이밍 1건과 watchdog 프로세스 권한 3건. 시험/제품 계약을 완화하지 않고 개별 재검증했다. 최초 entry-location 단독 명령은 loader 누락으로 실패했으며 성공 로그와 구분한다. 전체 quick를 0 FAIL로 보고하지 않는다.

정련은 착수 baseline.zip을 같은 knip 설정으로 검사해 **착수 전에도 exports 188 / types 44**임을 확인했다. 이번 작업의 증가 없음. 기존 dirty 코드를 삭제하거나 저장소 기준을 상향하지 않았다. 비교 도구 `compare-baseline-knip.py`와 결과를 보존한다.

화면 실측: 800×360 HUD 약30.0%, 736×360 약32.7%, 699×273 약34.4%, 667×300 약36.0%. 작은 화면 순위 목록 높이 37.44px 이상. 지도/계정/인터벌/순위·계기 셀 겹침 없음.

## 기존 증거 덮어쓰기 — 미해결

Cursor 마지막 UI 시험에서 일부 evidence 환경변수 누락으로 **착수 전부터 dirty였던 기존 PNG 11장**을 덮어썼다. 사전 baseline은 이미지 SHA256만 저장해 원본 바이트 복구 수단이 없었다. 원본 사본을 찾아 1장 복구, **10장 원본 복구 미완료**. HEAD로 덮어쓰면 착수 전 변경도 잃으므로 실행하지 않았다.

7737 PNG 및 추가 .playwright-mcp/릴리스 ZIP에서 동일 해시 사본을 검색했다. 보호 대상 535개 중 현재 525개 일치, 10개 불일치. 정확한 경로는 `evidence/recovery-report.json` 및 `evidence/supervisor-audit.json`. 덮어쓴 현 파일의 별도 보존본과 해시/후속 복구 목록은 `evidence/evidence-preservation-incident.json` 및 `evidence/superseded-captures/`.

다음 담당자는 이 10개를 원본으로 오인하지 말고, 외부 백업/이전 담당자 사본이 확보되면 baseline.json 해시와 비교해 복구한다. 원본을 새로 촬영한 이미지로 대체해 복구 완료로 표시하지 않는다.

## 화면과 확인 방법

실제 제품 React 컴포넌트를 기존 Vite 검수 preview에서 실행해 캡처했다. **지도·수치는 fixture이며 실계정/실주행 전체 흐름 화면은 아니다.** `evidence/final-screen/`에 주행 800×360·699×273, 기본/직접 조절 설정, 완주 결과 PNG가 있다.

기존 5031 서버 재사용. 서버가 종료되었을 때만:

```powershell
cd C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

- 실제 앱: http://localhost:5031/ — 새로고침 → MENU → 주행 설정 → 인터벌 운동 설정 → 주행.
- 제품 컴포넌트 검수: http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=riding&interval&intervalMs=330000
- 설정: 같은 preview에 `?state=settings` → 운동 설정. 결과: `?state=summary&variant=completed`.

최종 UI 재실행은 증거 경로를 모두 지정한다:

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5031'
$env:UI_MOMENTS_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261028-ui-moments\evidence\supervisor-final'
$env:UI_REVALIDATION_EVIDENCE_DIR=$env:UI_MOMENTS_EVIDENCE_DIR
$env:INTERVAL_EVIDENCE_DIR=$env:UI_MOMENTS_EVIDENCE_DIR
$env:INTERVAL_SETTINGS_EVIDENCE_DIR=$env:UI_MOMENTS_EVIDENCE_DIR
$env:MAP_MENU_EVIDENCE_DIR=$env:UI_MOMENTS_EVIDENCE_DIR
$env:ENTRY_CARD_HISTORY_EVIDENCE=$env:UI_MOMENTS_EVIDENCE_DIR
npx playwright test e2e/ride-ui-moments.spec.ts e2e/ride-interval.spec.ts e2e/ride-interval-settings.spec.ts e2e/ui-800x360.spec.ts e2e/map-menu-consolidation.spec.ts --workers=1 --retries=0
```

실폰·실센서・실 Firebase/에뮬레이터 주행 진입·효과음 청취는 미실행. 이번 검증은 오프라인 제품 컴포넌트와 상태 로직 범위다. 음향 청취/실기기 확인 및 기존 캡처 10장 복구가 남았다. Cursor 세션은 모두 종료됐고 기존 서버는 유지했다. 사용자 중단 기준 8%를 후속 작업에도 적용한다.
