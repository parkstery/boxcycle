# 02-result-cursor — 1차 구현 (감리 보완 전)

Cursor. 2026-10-28. 커밋·푸시·배포 없음. 기존 dirty·증거 PNG 보존.

이 파일은 **01-task 1차 패스**다. Supervisor 중단 시점에 펼침에도 점멸 LED가 남아 있었고, Codex 독립으로 신규화면 9PASS·tscPASS·selector19PASS를 확인했다. 펼침 접기 캐럿 복원은 [04-task-review-fix](04-task-review-fix.md) → [05-result-review-fix](05-result-review-fix.md).

## 1차에 넣은 것 (01 문면)

- 중앙 `RideControlBar` 센서 칩 제거. idle/setup에서 주행바 자체 숨김.
- 센서 슬롯은 `gate|gate-nickname|summary`만 `none`, 나머지는 `route-dock`.
- 무경로·접힘: RouteDock 자리의 흰/녹 점멸 LED만. 녹색은 `cadenceChipView`의 실제 `connected`만. 체험/수동은 흰색.
- 경로 생기면 자동 펼침, 주행 시작 접힘, riding↔paused 사용자 접힘 유지, 종료 후 경유 남으면 펼침.
- 접힘 터치 28×28(최소 충족). 44px는 667×300 주행에서 왼쪽 반달 `고정14` hitOk를 깨서 쓰지 않음.

1차 해석 오류: 펼침에도 LED를 접기 버튼으로 남겼다. 04가 이것을 불합격으로 명확히 했다.

## 1차 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 http://127.0.0.1:5031/ HTTP 200 재사용.

| 명령 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| `node --test scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts scripts/ride-hierarchy/route-dock-riding-contract.test.ts` | 20 PASS |
| `npx tsc -b --noEmit` | PASS |
| eslint 변경 TS/TSX | 오류 0 / App 기존 경고 7 |
| `npm run build` | PASS (vite ~1.85s, 청크 크기 경고만) |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | FAIL knip exports 186→188. 착수 baseline과 동일, 이번 증가 없음 |
| 대상 `git diff --check` | PASS |
| `RTW_DEV_PORT=5031 npx playwright test e2e/sensor-dock.spec.ts --workers=1 --retries=0` | 9/9 PASS (1차 LED접기 기대) |
| `e2e/address-minimap-width.spec.ts` + `e2e/route-ride-controls.spec.ts` | 11/11 PASS |
| `e2e/ui-800x360.spec.ts` 전체 | 21/23. 고정30 spacing 2.6875<8 FAIL(계정/카메라, 이번 범위 밖). 고정14는 44px LED에서 FAIL → 28px 후 관련 subset 8/8에 포함되어 PASS |
| 전체 `test:quick` | 미실행 (무거운 전수·시간) |
| Firebase 실주행 `ride-entry` / `sensor-chip-6a` / `touch-targets-44` / `ride-summary-compact` | 미실행 (LIVE·증거 경로 보호) |

## 1차 증거

기존 PNG 덮어쓰지 않음. 1차 캡처:

- `document/ops/20261028-sensor-dock/evidence/cursor/*.png` (첫 캡처, 펼침 LED)
- `document/ops/20261028-sensor-dock/evidence/cursor/led-28px/*.png` (28px 접힘 재캡처)

## 1차가 남긴 것

- 펼침 LED는 04 요구와 불일치 → 05에서 `RouteOverviewFoldToggle`로 교체.
- `App.tsx`·`preview.tsx`·`ui-800x360.spec.ts`는 착수 전부터 다른 작업 dirty. 이번 결선만 센서 관련.
- 커밋·푸시·배포 없음. 5031 유지.

확인: `cd C:\20.HDev\boxcycle\apps\web` → http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=idle
