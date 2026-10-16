# 지시 F1 — 운영용 실측 패널 `?perflab=1`

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 계획 | [01-plan.md](01-plan.md) §2 — **먼저 읽을 것** |
| 작업 위치 | `C:\20.HDev\boxcycle-perf` (브랜치 `feat/rider-perflab`) |
| 결과 파일 | `C:\20.HDev\boxcycle-perf\document\ops\20261016-rider-perf\03-result-f1.md` |

## 참고할 기존 코드

- 운영 쿼리 패널 패턴: `apps/web/src/lib/riderPrototype/riderLightLab.ts`(`?lightlab=1`), `apps/web/src/lib/debug/rideCameraLab.ts`(`?camlab=1`) 와 그 패널을 붙이는 위치(App/MapView).
- 렌더 비용 계측: `apps/web/src/lib/debug/riderRenderCostProbe.ts`(`measureRiderRenderFrame`, `measureRiderPose`, 지금은 DEV 전용).
- 레이어: `apps/web/src/lib/map/riderPreservedLayer.ts`(render 루프, `getDebugState` 의 `lod2State`).

## 만들 것

1. `apps/web/src/lib/debug/perfLab.ts`: `isPerfLabEnabled()` — `?perflab=1`(운영 포함, 페이지 수명 동안 한 번 읽어 캐시). 프레임 간격 기록(자체 rAF 1개, 켜졌을 때만), 롤링 10 s 통계(p50/p95/p99/max ms, >33 ms·>50 ms 비율, fps), 기기 정보 수집(계획 §2 목록; WebGL 정보는 지도 캔버스의 컨텍스트 또는 임시 캔버스에서 1회).
2. `riderRenderCostProbe.ts`: 기존 DEV 동작 그대로 + `isPerfLabEnabled()` 이면 운영에서도 누적. 쿼리 없는 운영에서는 지금처럼 즉시 콜백만(추가 비용 0 — `performance.now()` 호출도 하지 않음).
3. 패널 컴포넌트(기존 lab 패널과 같은 위치·스타일 관례): 1 s 마다 갱신 — fps·p50/p95/max, 라이더 ms/프레임·ms/명·자세 비율, 라이더 수, 줌, LOD2 사용 여부, 기기 요약 한 줄. 버튼 "결과 복사"(전체 JSON — 통계·기기 정보·측정 시각·앱 빌드 해시(`import.meta.env` 에 있는 값 또는 index 스크립트 파일명)) → `navigator.clipboard.writeText`, 실패 시 텍스트 상자에 펼쳐 길게 눌러 복사 가능하게. 작은 화면(가로 폰)에서 주행 UI 를 가리지 않게 접기 버튼.
4. 서버 전송·저장 없음.

## 시험

- `perfLab` 통계 함수: 합성 프레임 간격 배열로 p50/p95/max/비율 정확.
- 쿼리 없으면 `isPerfLabEnabled()` false, 계측 함수가 콜백만 부르고 누적하지 않음.
- 기존 `test:quick`, `test:rider-preserve`, `rider-detail-lod` 계약, 레이어 계약 문자열 유지.

## 검증

PowerShell `apps/web`: `npx tsc --noEmit -p tsconfig.app.json`, 변경 파일 eslint, `npm run test:quick`(이 worktree 는 `functions/lib` 이 없어 route 3건 실패가 환경상 정상 — 그 외 실패 0), `npm run test:rider-preserve`, `npm run build`. dev 서버가 필요하면 포트 **5070**(5060 은 Chrome 차단), 끝나면 종료. 데스크톱 헤드리스로 `?perflab=1` 주행 화면 캡처 1장(패널 보이는지) + "결과 복사" JSON 예시를 결과 파일에 붙인다.

## 금지

리그·흔들림·LOD·코너 로직 변경, 쿼리 없는 운영 동작 변경, 서버 전송, commit · push · 배포, 백그라운드 잔류.
