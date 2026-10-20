# 감리04 — 800×360 UI 개선 최종 로컬 검수

- 날짜: 2026-10-20
- 담당: Codex Supervisor
- 판정: **LOCAL_VERIFIED / Chief 화면 확인 대기**
- 범위: Cursor 지시04 결과와 800×360 UI 전용 fixture. 운영 배포·커밋·푸시는 하지 않음.

## 확인 결과

| 검증 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | PASS 19/19 |
| `npx tsc -b --pretty false` | PASS |
| `npm run lint` | PASS, 0 errors / 기존 warnings 37 |
| `npm run build` | PASS, 기존 rider export·large chunk 경고만 유지 |
| `git diff --check` | PASS |
| `npx playwright test ui-800x360 --workers=1 --retries=0 --timeout=30000 --global-timeout=120000` | PASS 11/11 |
| `node scripts/check-dev-tools.mjs --check` | PASS, warnings 0 |

## 브라우저 감리

- CSS viewport `800×360`, `667×300`, `844×390`에서 지표·계정·카메라 충돌과 긴 문자열을 확인했다.
- 좌우 핸들은 44px 터치 영역이며, 667×300에서 HUD 계기판·맵 제어·RouteDock과 겹치지 않도록 세로 위치와 좁은 화면 계기판 여백을 조정했다.
- 좌우 안쪽 드래그는 메뉴/맵뷰를 열고, 반대 방향·수직·짧은 드래그·pointercancel·resize는 열지 않는다.
- 탭과 Enter는 같은 패널을 열며, 열린 패널 헤더를 바깥으로 드래그하면 닫힌다. 중앙 SVG 지도 영역의 포인터 이동은 핸들이 가로채지 않는다.
- 결과 시트의 22px 진행 숫자와 보조 설명은 클립되지 않는다.
- 클린 Vite 세션에서 재검증했다. 이전 HMR 세션의 모듈 오류는 세션 종료 후 재현되지 않았다.

## 남은 확인

- 실기기(Android Galaxy), 실제 Mapbox 지도·Firebase 인증·BLE 센서는 이 감리 범위에서 실행하지 않았다.
- Chief가 `C:\20.HDev\boxcycle\apps\web`에서 `npm run dev:localhost` 실행 후 800×360으로 메뉴/맵뷰 핸들, 결과 시트, 667×300 회귀를 직접 확인해야 한다.
- UI 변경은 현재 working tree에만 있으며, 별도 승인 전에는 main2에 커밋·푸시·배포하지 않는다.
