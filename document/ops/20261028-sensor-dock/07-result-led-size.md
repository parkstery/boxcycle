# 07-result-led-size — 접힌 LED 8px→24px

Cursor. 2026-10-28. [06-task-led-size](06-task-led-size.md) 반영. 커밋·푸시·배포 없음. 기존 dirty·기존 증거 보존.

## 변경

제품 수정은 CSS 2줄만.

`apps/web/src/components/route-dock/RouteDock.css` `.route-dock__led`

```
-  width: 8px;
-  height: 8px;
+  width: 24px;
+  height: 24px;
```

유지(이번 세션 미수정):

- `.route-dock__led-toggle` 28×28 터치
- 펼친 패널 `.hud-cadence__led` 7px
- 위치·색·점멸·접기 버튼·TSX

HEAD 대비 `RouteDock.css` 전체 diff는 기존 센서 통합 dirty를 포함한다. 이번 세션이 추가한 제품 변경은 위 2줄뿐이다. `RouteDock.tsx` / `RouteOverviewFoldToggle.tsx`는 기존 dirty 그대로.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | 결과 |
|---|---|
| `Invoke-WebRequest http://127.0.0.1:5031/` | HTTP 200, len=730 |
| CSS 대상 블록 재읽기 | `.route-dock__led` 24×24, 토글 28×28, 알약 LED 7×7 |
| sensor-dock 시험 / DOM 24px 실측 | **미실행** (Codex 감리) |
| tsc / lint / build / dep / tidy / `test:quick` / 전수탐색 | **미실행** (지시) |
| 실폰 / 실센서 | **미실행** |

## 확인 순서

```
cd C:\20.HDev\boxcycle\apps\web
# 기존 서버 재사용. 없으면: npm run dev:localhost -- --port 5031
```

1. http://127.0.0.1:5031/ 새로고침
2. 접힌 RouteDock LED가 이전 8px의 3배(24px)로 보이는지
3. 탭하면 기존 접기 캐럿 + 7px 센서 알약(LED 토글 없음)

커밋·푸시·배포 없음. 5031 유지.

## Codex 독립 감리
Cursor실행정상종료. 착수CSS사본대비width/height8→24두줄만변경확인. 4가로크기×idle/riding8상태DOM24×24·패널내7×7·클릭펼침PASS(evidence/led-size-dom.json). 기존sensor-dock9/9PASS(27.1초), 새증거evidence/led-size-review. CSS만변경으로타입/빌드미재실행. 실폰/실센서미실행. 커밋푸시배포없음.
