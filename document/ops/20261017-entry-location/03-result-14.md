# 결과14 — 비행 2초

2026-10-17 Codex 직접 수정·검증. Chief 지시로 `ENTRY_LOCATION_FLIGHT_MS`를1000→2000ms 변경. 초기도시·비행곡선·목적지·권한동작은 유지. 기존dirty보존·commit/push/deploy 없음. GLM은앞선2회호출제한으로작업불가여서 이번작은수정은직접수행했다.

실행폴더 `C:\20.HDev\boxcycle\apps\web`:

- `node --test scripts/identity/entry-location-dom.test.mjs` exit0. 실제Edge/Mapbox **2008.9ms**, zoom15→**2.0215**→15, 중간202샘플, 최종서울가상좌표 `[126.978,37.5665]` 도착PASS. [측정치](evidence/14-entry-flight-metrics.json). 기존13의1초측정JSON보존. fixture도제품시간상수를직접import하게교정.
- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/entry-location-camera.test.mjs` exit0,6PASS.
- `npx.cmd eslint src/lib/map/mapBootCenter.ts scripts/map/entry-location-camera.test.mjs scripts/identity/entry-location-dom.test.mjs` exit0,오류·경고0.
- `npm.cmd run build` exit0,타입/Vite PASS(기존청크/riderRig경고).
- `git diff --check` exit0.

브라우저카메라는실제엔진에서검사했으나단색스타일·권한/좌표테스트지정이다. 실타일/실기기체감/실권한수동클릭미검증. 토큰없는Mapbox경고는이전과같다.

직접확인: 기존 http://127.0.0.1:5180 새로고침→위치사용/허용→2초비행. 별도실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 → 인트로콜로세움→게스트/로그인→위치허용→상승·이동·하강체감확인. 동작줄이기는즉시이동.
