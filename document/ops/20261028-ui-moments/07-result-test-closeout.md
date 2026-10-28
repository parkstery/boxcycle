# 07-result-test-closeout

Cursor. 2026-10-28. `06-task-test-closeout.md`. 소유 UI·관련 시험만. hooks/lib/App.tsx/MapHud.tsx 미수정. 커밋·푸시·배포 없음. 기존 dirty·535 증거 보존.

## 명령

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. `$env:RTW_DEV_PORT='5031'` (HTTP 200 재사용).

```
npx playwright test e2e/ride-ui-moments.spec.ts e2e/ride-interval.spec.ts e2e/ride-interval-settings.spec.ts e2e/ui-800x360.spec.ts e2e/map-menu-consolidation.spec.ts --workers=1 --retries=0
```

로그: `evidence/final-cursor/playwright.log`.

실패 항목만 수정 후 해당 시험 재실행. 로그 `evidence/final-cursor/playwright-rerun.log`, `playwright-rerun-final.log`.

소유 eslint: `LeaderboardGlance.tsx` · `EdgePanelHandle.tsx` · `RideIntervalSettingsSheet.tsx` · 위 e2e 5파일 — 오류 0.

`tsc` / `build` / `test:quick` 전체는 지시대로 미실행(Supervisor).

## 통과 · 실패 · 미실행

| 묶음 | 최초 | 최종 |
|---|---|---|
| ride-ui-moments 6 | 6 PASS | z-index 후 6/6 PASS |
| ride-interval 6 | 6 PASS | 재실행 없음(실패 없음) |
| ride-interval-settings 16 | 16 PASS(접기·0초·20:10 2라운드 포함) | 재실행 없음 |
| map-menu-consolidation 3 | 800 PASS, 667/699 FAIL | 3/3 PASS |
| ui-800x360 23 | 18 PASS / 5 FAIL | 실패 5건 재실행 PASS |
| 지정 5스펙 합 54 | **47 PASS / 7 FAIL** | 실패 7건 전부 PASS. 54 일괄 재실행은 하지 않음 |

미실행: 실폰·실센서·TTS/효과음 청취, tsc/build/quick 전체.

## 실패 초기 → 최종

1. **configure 0초 → 10:54** — helper가 라운드 채운 뒤 준비/마무리를 다시 채워 0이 유지되게 하고 값 단언. 0초 건너뜀 시험 PASS.
2. **story-detail 11px** — Chief 최소 10px에 맞춰 `>=10`. PASS.
3. **20px 띠 클릭이 반달 탭을 염** — 띠 무클릭은 y=40, 반달 클릭/드래그는 고정14. PASS.
4. **맵 뷰 시트 `state=map`** — 시트 제거와 충돌. 패널 목록에서 `map`만 뺌(센서·설정·경로·결과·계정 유지). PASS.
5. **시작 버튼 44 vs 펄스 45.8** — 레이아웃 44를 transform scale로 나눔. PASS.
6. **3D 뷰 클릭을 오른쪽 순위 탭이 가로챔** — 탭 z-index 6→4(MapHud 5·빈 영역 none 아래). 667/699 PASS.
7. **고정14 hitOk/겹침** — 펼친 3경유 도크를 탭 위에 올리지 않음. 계기·우상단·주행제어 비겹침·hitOk·클릭/드래그 유지. 경로카드/미니맵은 같은 왼쪽 가장자리라 시각 rect만으로 실패 → hitOk로 클릭 가능 확인. PASS.

## 변경 파일

- `apps/web/src/components/leaderboard/LeaderboardGlance.tsx` · `.css` — 미사용 Chip/RankChipIcon/칩 CSS 삭제, Panel 보존
- `apps/web/src/components/ride/RideIntervalSettingsSheet.tsx` · `.css` — 펼친 직접설정 footer `접기`(초안 유지, 터치 44px, footer sticky)
- `apps/web/src/components/ui/EdgePanelHandle.css` — 반달 탭 z-index 4
- `apps/web/e2e/ride-interval-settings.spec.ts` · `ride-ui-moments.spec.ts` · `ui-800x360.spec.ts`

## 캡처

`document/ops/20261028-ui-moments/evidence/final-cursor/`

주행 HUD 4크기 `riding-{800x360,736x360,699x273,667x300}.png`. 설정 `interval-settings-custom-800x360.png`, `settings-*`, `ride-settings-*`. 메뉴 `account-800x360.png`, `camera-*.png`.

## 남은 위험

실기기·실센서 없음. 지정 54를 수정 후 한 번에 다시 돌리지는 않음. 주행 중 왼쪽 탭과 경로카드/미니맵은 같은 가장자리를 씀(클릭은 hitOk). MapHud.tsx·hooks·lib는 Supervisor 작업 중이라 이 결과 이후 연결이 바뀔 수 있음. 5031 재사용, 3000 미변경.
