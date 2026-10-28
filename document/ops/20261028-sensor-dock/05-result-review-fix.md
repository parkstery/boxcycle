# 05-result-review-fix — 펼침 접기 캐럿 복원

Cursor. 2026-10-28. [04-task-review-fix](04-task-review-fix.md) 반영. 커밋·푸시·배포 없음. 기존 dirty·1차 PNG 보존.

## 보완 내용

- **접힘**: 흰/녹 점멸 LED 펼침 버튼 유지(`.route-dock__led-toggle`).
- **펼침**: 기존 `RouteOverviewFoldToggle` `kind="route"` 28×28 접기 캐럿(`.route-dock__fold`). 센서 상태 LED 토글 없음. 패널 안 센서 알약 유지.
- 키보드 Enter/Space 뒤 포커스는 방금 생긴 접기/펼치기 버튼으로 유지(body로 떨어지지 않음).
- `sensor-dock.spec.ts`: 펼침 LED 0 · 접기버튼 1 · 알약 1, 접힘 LED 1. 4개 가로 크기. 캡처는 `evidence/cursor/review-fix/`만(기존 PNG 미덮어씀).

제품: `RouteDock.tsx/css`, `RouteOverviewFoldToggle.tsx`(`buttonRef` 추가, 미니맵 호출 불변). 시험 셀렉터만 펼침 캐럿을 `.route-dock__fold`로 맞춤.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. http://127.0.0.1:5031/ HTTP 200 재사용. workers=1 retries=0.

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint src/components/route-dock/RouteDock.tsx src/components/route-dock/RouteOverviewFoldToggle.tsx` | PASS (출력 없음) |
| `node scripts/ride-verify/verify-selectors.mjs` | 19/19 PASS |
| `node --test scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts` | 13/13 PASS |
| `RTW_DEV_PORT=5031 npx playwright test e2e/sensor-dock.spec.ts` | **9/9 PASS** |
| `npm run build` / dep-direction / code-tidy / `git diff --check` | 이번 보완에서 **미실행** (1차 02에서 수행, 시간 한도) |
| `e2e/ui-800x360.spec.ts` 광범위 | **미실행** (지시) |
| 전체 `test:quick` | **미실행** (지시) |
| Firebase 실주행 | **미실행** |

고정30(계정/카메라 간격)은 1차 전체 ui-800x360에서 FAIL였고 이번 범위 밖·미재실행. 고정14는 1차 28px 접힘 이후 관련 subset에서 PASS, 이번 미재실행.

## 증거 (신규만)

`document/ops/20261028-sensor-dock/evidence/cursor/review-fix/`

- `idle-led-800x360.png` — 접힘 LED만
- `idle-expanded-fold-800x360.png` — 펼침 기존 접기 도안 + 알약, LED 없음
- `idle-led-connected-800x360.png` — 실제 연결 녹색 LED
- `riding-expanded-fold-800x360.png` / `736x300` / `699x273` / `667x300`

1차 `evidence/cursor/*.png` 및 `led-28px/*.png`는 그대로.

## 한계

- build/dep/tidy/diff 이번 패스 미재실행.
- ui-800x360 고정12는 셀렉터를 `.route-dock__fold`로 고쳤으나 화면시험 미재실행.
- LIVE spec(`sensor-chip-6a` 펼침 caret, `touch-targets-44`) 셀렉터만 수정, 실행 안 함.
- 실폰/실센서 없음.

## 확인 순서

```
cd C:\20.HDev\boxcycle\apps\web
# 기존 서버 재사용. 없으면: npm run dev:localhost -- --port 5031
```

1. http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=idle — LED만, 탭하면 기존 경로 접기 캐럿+센서 알약, LED 사라짐.
2. `?state=ready` — 펼침 캐럿·알약. `?state=riding` — LED만, 펼치면 캐럿+알약.
3. 중앙 주행바에 센서 칩 없음.

커밋·푸시·배포 없음. 5031 유지.
