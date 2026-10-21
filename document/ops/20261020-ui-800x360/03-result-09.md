# 결과09 — 두 방식 탭·명시 경로 생성

2026-10-21. DeepSeek v4.1 Flash(opencode)는 조사만(diff 0) 후 Supervisor 중단([03-handoff-09.md](03-handoff-09.md)). Cursor Composer2.5가 동일 지시09를 이어받아 구현·검증. GLM 지시10 파일은 미수정. git/배포 없음.

## 구현

- 지점 팝업 경로 생성: disclosure 캐럿 제거, `출발·도착` / `거리·방향` 탭(`role=tab`, `aria-selected`, `aria-controls`, 좌우/Home/End 키). 항상 한 패널만 표시.
- 출발 전에도 탭 노출. 거리 탭은 출발 미설정 안내 문구. 탭 전환은 `pauseDistancePickForTabSwitch`로 bridge disarm·원만 정리(원격 탐색·토큰·핀·목표거리·수단·기존 경로 유지).
- 출발·도착 라벨 한글화. 경유지는 `+경유지`와 채워진 슬롯만(`경유1`…), 최대 3·기존 `onSelectPoint` 콜백 유지.
- 이동수단은 `onSetRouteProfileOnly`만. 출발·도착 준비 시 `경로 생성` 버튼이 `onRouteProfile` 호출(토큰·pending 기존 처리). 거리·방향은 지도 방향 탭 안내 문구 유지.
- 주소 한 줄 말줄임, 좌표·고도는 `자세히` details. profile·경로 생성은 탭 아래 공통 행.

## 변경 파일

- `apps/web/src/components/map/mapPopupElements.ts`
- `apps/web/src/components/map/MapView.css`
- `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts` (지시09 회귀·`metaDetails` 계약 갱신)

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`

| 명령 | 결과 |
|---|---|
| `npm run test:distance-auto-route` | 142/142 PASS, exit 0 |
| `npx tsc --noEmit` | exit 0 |

- Playwright·실지도 e2e: 지시 범위 밖(장기 e2e 금지). 수동 확인은 지도 탭 → 지점 팝업 → 탭 전환·경유지·경로 생성 버튼.
- eslint: `mapPopupElements.ts`·contract test는 오류 없음. `MapView.css`는 스타일 파일로 eslint 대상 아님.

## 잔여·연결

- 지시10(RouteDock/주행바)과 DOM 겹침은 별도 writer 범위. 팝업 dock 동작은 기존 MapView 계약 유지.
- Chief 실기기에서 탭 터치·740×300 밀도는 미측정(ops 캡처 없음).
