# 지시 T2 — 측정·조절 패널을 운영 기본 번들에서 분리 (동적 import)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-17 · Supervisor (Claude) |
| 대상 | Developer — **Cursor Agent** (Muse 한도 초과로 교대) |
| 작업 위치 | `C:\20.HDev\boxcycle-devtools` (브랜치 `chore/dev-byproducts`, main2 와 같음) |
| 결과 파일 | `document/ops/20261017-dev-byproducts/03-result-t2.md` |
| 근거 | [02-rules §4](02-rules.md) · Chief "운영 사이트에서 뺀다" + "camlab·lightlab 등은 아직 쓴다" |

## 목표

운영 사이트 기본 청크(`dist/assets/index-*.js`, 지금 3,731 kB 단일)에서 **perflab·camlab·lightlab 의 화면과 무거운 계측 코드**를 빼고, 주소 스위치(`?perflab=1`, `?camlab=1`, `?lightlab=1`)가 있을 때만 별도 청크로 불러온다. **기능은 그대로** — 스위치를 붙이면 지금과 똑같이 동작해야 한다. 스위치가 없으면 그 청크를 내려받지 않는다.

## 현재 구조 (조사됨)

- `App.tsx` 107–109 가 `RiderLightLabPanel`·`RideCameraLabPanel`·`PerfLabPanel` 을 정적 import, 2839–2845 에서 렌더(각 패널 안에서 스위치 확인).
- perflab 계측: `lib/debug/perfLab.ts`(스위치·프레임 시계), `frameBreakdownProbe.ts`(788줄, `map._render` 감싸기·LoAF·GPU 쿼리), `riderJitterProbe.ts`, `riderRenderCostProbe.ts`. 제품 코드 쪽 호출처: `MapView.tsx`(frameBreakdown·jitter), `lib/map/riderPreservedLayer.ts`(renderCost·perfLab).
- camlab: `rideCameraFollow.ts` 가 `getRideCameraLabOverride`(`lib/debug/rideCameraLab.ts`)로 값을 읽는다 — 카메라 추종이 쓰는 **작은 getter 는 기본 청크에 남아도 된다**. 패널 UI 만 분리.
- lightlab: 패널이 `riderLightRig.setRiderLightLabState` 호출. 패널 UI 만 분리.

## 설계 요구

1. 세 패널은 `React.lazy` + `Suspense(fallback=null)`, 스위치가 켜졌을 때만 렌더. 스위치 판정 함수는 가벼운 모듈에 남긴다.
2. perflab 계측은 **얇은 창구(facade)** 를 기본 청크에 두고(호출 시 아무 일도 안 하는 함수들 + 스위치 판정), `?perflab=1` 일 때 계측 모듈을 동적 import 해서 창구에 실제 구현을 연결한다. 제품 경로(`MapView`·`riderPreservedLayer`)는 창구만 import 한다. 매 프레임 호출의 꺼진 상태 비용은 함수 호출 1회 수준이어야 한다.
3. 계측이 늦게 연결되어도(동적 import 완료 전 프레임) 오류 없이 무시. 스위치가 없을 때는 import 자체를 시작하지 않는다.
4. 기존 시험(`scripts/perf-lab.test.ts`, `frame-breakdown.test.ts`, `rider-jitter.test.ts`, `scripts/map/*`, `scripts/rider-preserve/*`)은 계측 모듈을 직접 import 해도 된다 — 시험을 약하게 바꾸지 말 것. 바꿔야 하면 이유를 결과에 적는다.
5. 새 lib 파일은 `apps/web/dep-layers.json` 에 등록.
6. 스위치 이름·패널 동작·결과 JSON 형식·perflab 패널 위치/끌기 무변경.

## 검증

1. PowerShell `apps/web`: `npx tsc -b` 0, 변경 파일 eslint 오류 0, 루트 `node scripts/check-dep-direction.mjs --check` 도메인 PASS, `npm run test:quick`(worktree 환경 실패 5건 = `functions/lib` 3 + Mapbox 토큰 2 외 0), `npm run test:rider-preserve`, `npm run build` 0.
2. **번들 확인**: 빌드 후 기본 청크에 `결과 복사`, `성능 펼치기`, `프레임(ms)`, camlab·lightlab 패널 고유 문구가 **없고**, 별도 청크에 있음을 `rg` 로 보인다. 기본 청크 크기 전(3,731.24 kB)·후, 새 청크 목록과 크기.
3. **동작 확인(헤드리스 1회)**: worktree 에는 `.env`(Mapbox 토큰)가 없다 — `C:\20.HDev\boxcycle\apps\web\.env` 를 **읽기만 해서** worktree `apps/web/.env` 로 복사해 쓰고, 끝나면 그 복사본을 지운다(커밋 금지). `npm run build` 후 `npx vite preview --port 5070 --strictPort`, Playwright 브라우저 1개로
   - 쿼리 없음: 패널 없음, perflab·camlab·lightlab 청크 네트워크 요청 0
   - `?perflab=1`: 패널 보임, 펼친 뒤 fps·라이더·분해 줄이 채워짐(주행 없이 지도 화면에서 숫자가 `—` 가 아니게 되는 항목 기록)
   - `?camlab=1`, `?lightlab=1`: 각 패널 보임
   - 서버·브라우저 종료 확인.

## 금지

스위치 이름 변경, 계측 수치 계산 변경, 패널 기능 축소, 다른 제품 동작 변경, commit · push · 배포, `.env` 커밋, 백그라운드 잔류.

## 결과 파일

설계(창구 구조), 변경 파일, 번들 비교(크기·문자열 위치), 동작 확인 결과, 시험 결과, 미해결.
