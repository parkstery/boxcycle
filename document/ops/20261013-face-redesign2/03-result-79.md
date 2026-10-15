# 결과79 — 콜로세움을 약간 오른쪽으로

모델: Auto (Cursor agent router). branch `main2`. HEAD `6a1d5e6c5496`. 커밋·푸시·배포·브라우저·서버·서브에이전트 없음. 지시79 파일은 수정하지 않음. 다른 dirty 파일은 되돌리지 않음.

## 변경

- `apps/web/src/lib/map/mapBootCenter.ts`: `MAP_FALLBACK_CENTER` `[12.4922, 41.8902]` → `[12.4905, 41.8902]`. 카메라만 경도 0.0017° 서쪽 보정이라는 주석 한 줄을 넣었다. 위도·줌 15는 그대로다.
- `apps/web/scripts/map/map-boot-center.test.ts`: 기존 `ROME` 카메라 expected 좌표를 `[12.4905, 41.8902]`로 맞췄다. `MAP_FALLBACK_CENTER` 직접 기대는 그 `ROME` 상수와 비교하므로 같은 값으로 따라간다. 잘못된 지역 입력의 리터럴 `[12.4922, 41.8902]`는 카메라 기대값이 아니라 그대로 두었다.

`git diff --numstat` (HEAD 대비, 이 두 파일): `mapBootCenter.ts` +2/−1, `map-boot-center.test.ts` +1/−1.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/map/map-boot-center.test.ts` | 0 | PASS. 6 tests, pass 6, fail 0 |
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS. 출력 없음 |
| `apps/web`에서 `npx eslint src/lib/map/mapBootCenter.ts scripts/map/map-boot-center.test.ts` | 0 | PASS. 출력 없음 |

## 미실행

- Mapbox 실 projection으로 랜드마크가 오른쪽에 있는지 보는 일은 지시대로 Supervisor 몫이다. 브라우저·서버는 실행하지 않았다.
