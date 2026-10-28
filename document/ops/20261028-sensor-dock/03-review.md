# 최종 독립 감리 — LOCAL_VERIFIED / 미배포

2026-10-28 Supervisor Codex. 구현·보완은 Cursor AI, Codex는 지시서·독립검증·문서만 담당했다. 최초 30분 예상은 Cursor 분석·기존 회귀 대기 및 요구 불일치 보완으로 초과했다. 1차 Cursor session83257를 종료하고 같은 대화 `7e14b525-0cd7-4d8b-b7d0-3b42540b916f`로 session31090 재개·정상 종료 확인.

## 판정

중앙 센서 버튼 제거. 무경로 초기/접힘은 흰색 또는 실제 연결 시 녹색 점멸 LED 하나. 펼치면 기존 28×28 경로 접기 캐럿과 기존 센서 알약. 센서 연결/체험 선택 설정창 연결 보존. 주행 중 펼쳐도 센서 접근 가능. 경로 생성 자동 펼침·삭제 후 접힘·주행 시작 접힘·일시정지 유지·종료 펼침 유지. 키보드 Enter/Space 버튼 교체 후 포커스 유지, 모션감소 시 LED 점멸 중단. 접힘 터치28px는 반달과의 간섭 때문에 선택했고 실제4가로크기 통과.

1차는 펼침에도 LED가 남아 반려, [04 보완지시](04-task-review-fix.md)·[05 Cursor 결과](05-result-review-fix.md)로 기존 캐럿 복원. 최종 699×273 실제컴포넌트 캡처 눈검수 완료(지도/수치는 메모리 fixture).

## 독립 검증 (최종 코드)

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | 결과 |
|---|---|
| `$env:RTW_DEV_PORT='5031'; $env:SENSOR_DOCK_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261028-sensor-dock\evidence\review-final'; npx playwright test sensor-dock.spec.ts --workers=1 --retries=0` | 9 PASS /24.4초. LED·캐럿·알약 개수·연결/체험·설정창·상태전환·키보드·4가로크기 |
| `$env:RTW_DEV_PORT='5031'; $env:UI_REVALIDATION_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261028-sensor-dock\evidence\review-regression'; npx playwright test address-minimap-width.spec.ts route-ride-controls.spec.ts --workers=1 --retries=0` | 11 PASS /35.1초 |
| `node --test scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts scripts/ride-hierarchy/route-dock-riding-contract.test.ts` | 20 PASS |
| `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| `npx tsc -b --noEmit` / `npm run build` | PASS / PASS (기존 큰청크 경고) |
| `npx eslint src/components/route-dock/RouteDock.tsx src/components/route-dock/RouteOverviewFoldToggle.tsx src/components/ride/RideControlBar.tsx src/components/maphud/CadenceHudChip.tsx src/lib/route/sensorChipSlot.ts src/lib/route/routeDockUiPolicy.ts` | PASS |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | FAIL: 기존 exports188>186. 착수 기록과 동일 |
| 대상 `git diff --check` | PASS |

1차9PASS는 최종20개 화면PASS에 중복 산입하지 않았다. Cursor 1차 `ui-800x360`는21/23: 고정14는LED28px교정후관련subset통과, 고정30계정/카메라간격실패는범위밖·최종전체미재실행. 전체quick·Firebase진입e2e·실폰·실센서미실행(관련UI계약과메모리fixture검증범위). 전수회귀통과로보고하지않음.

## 변경 범위·보존

센서배치/policy·RouteDock·RideControlBar 및 필요한App속성제거2개. 공용FoldToggle에선택적buttonRef추가(기존미니맵사용불변). CadenceHudChip은소유위치주석만수정. preview와관련시험/진입helper는LED→패널→센서진입에맞게기대갱신. 인증·센서통신·데이터·주행계산·카메라코드불변.

착수3179개 파일해시 대비 변경목록 `evidence/preservation-review.json`, 누락0·기존PNG/JPG변경0. App은착수ZIP대비센서props2개제거만확인. 기존dirty보존, 커밋·푸시·배포없음. Chief고정45추가(12/29해당표시만최신지시대체).

## 확인

```powershell
cd C:\20.HDev\boxcycle\apps\web
# 현재5031서버재사용. 서버없을때만:
npm run dev:localhost -- --port 5031
```

http://localhost:5031/ 새로고침 → LED탭 → 접기캐럿+센서알약 → 센서알약탭으로기존설정창 → 닫고접기. 경로선택후주행중에도같이확인. 데이터쓰기없는즉시화면확인은 http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=idle 및 `?state=riding`.

최종증거 `C:\20.HDev\boxcycle\document\ops\20261028-sensor-dock\evidence\review-final\` (LED흰/녹·무경로펼침·4가로주행펼침). 다음: Chief실폰/실센서확인·배포는별도지시시진행.
