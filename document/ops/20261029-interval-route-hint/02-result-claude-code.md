# 경로 거리 부족 안내 — 결과

2026-11-16 · 구현·검증 모두 Claude Code 직접(수퍼바이저 세션). 지시 [01-task](01-task.md). MiniMax 워커는 Chief 지시로 지금 쓰지 않는다. 구현자와 검증자가 같으므로 독립 감리는 없다 — 대신 일부러 틀린 구현으로 시험이 죽는지 확인했다.

## 무엇이 바뀌었나

- 인터벌이 켜진 채 경로가 정해지거나, 경로가 있는 채 인터벌을 켜거나 설정을 적용했을 때 경로가 짧으면 대기 화면에 「경로가 짧아요」 창이 한 번 뜬다. 버튼은 「확인」 하나, 주행 시작 경고(고정48)와 같은 흰 창.
- 최소 거리는 시속 25 km 기준 0.1 km 올림(15분 6.3 · 10분 4.2 · 30분 12.5). 판정은 화면에 보이는 숫자로 한다(6.3 km 경로는 짧지 않다).
- 주행 시작 경고(「운동시간이 더 길어요」)의 판정 속도를 내 평균(없으면 20)에서 25 km/h로 통일. 문구·모양은 그대로, 「예상 속도 25.0 km/h 기준」으로 보인다.
- 같은 (경로 + 인터벌 설정) 조합은 한 번만. 인터벌 설정 창이 열려 있는 동안은 미뤘다가 닫히면 띄운다. 간편 인터벌이 만든 경로에는 띄우지 않는다. 주행·일시정지 중에는 띄우지 않는다.

## 바뀐 파일 (`apps/web`)

| 파일 | 내용 |
|---|---|
| `src/lib/route/intervalRouteDistance.ts` | `intervalMinRouteKm`·`resolveIntervalRouteShortfall`·`intervalRouteHintRouteKey` 추가 |
| `src/hooks/useIntervalRouteHint.ts` (신규) | 렌더 중 키 비교로 「바뀜」 감지(effect 없음), 조합별 1회, 간편 경로 제외 |
| `src/components/ride/IntervalRouteHint.tsx` (신규) | 안내창. `IntervalRouteConfirm.css` 재사용, 새 색·크기 없음 |
| `src/App.tsx` | 훅·안내창 연결, 시작 경고를 같은 판정 함수로(3748 → 3773줄, 한도 3807) |
| `scripts/interval-route-hint/interval-route-distance.test.ts` (신규) | 단위 13건 |
| `scripts/interval-route-hint/interval-route-hint-runtime.html/.tsx` (신규) | 화면 시험용 화면 |
| `e2e/interval-route-hint.spec.ts` (신규) | (a)~(d) 4건 |

`distanceAutoRouteEta.ts` 의 `isRouteShorterThanInterval` 은 지우지 않았다(기존 단위 시험이 쓴다). 제품 코드에서는 더 쓰지 않는다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

| 명령 | 결과 |
|---|---|
| `node --experimental-strip-types --test scripts/interval-route-hint/interval-route-distance.test.ts` | 13/13 통과 |
| `npx playwright test interval-route-hint --workers=1 --retries=0` | 4/4 통과 |
| `npx playwright test interval-dock-confirm ride-interval-settings ride-interval.spec distance-route-continuation quick-interval-ride --workers=1 --retries=0` | 39/39 통과(증거는 임시 폴더, 기존 증거 변화 없음). 기존 spec 수정 없음 |
| `npx tsc -b --noEmit` | 0 |
| 바뀐 파일 eslint | 오류 0(App.tsx 경고 7건은 기존) |
| `node scripts/ride-verify/verify-selectors.mjs` | 21단계 유효 |
| `npm run build` | 통과 |
| 루트 `npm run check:dep` · `node scripts/check-code-tidy.mjs --check` · `node scripts/check-dev-tools.mjs --check` | 통과(exports 186 그대로) |
| `npm run test:quick` | 1558 통과 / 0 실패 |

일부러 틀린 구현(모두 원복):

| 바꾼 것 | 결과 |
|---|---|
| 기준 속도 25 → 20 | 단위 5건 실패 |
| 올림 → 반올림 | 단위 1건 실패 |
| 화면 숫자 대신 올림 전 값으로 판정 | 단위 2건 실패 |
| 간편 경로 제외 조건 삭제 | 화면 시험 (c) 실패 |

「25 를 직접 적은 곳」 확인: 안내창·훅에는 25 가 없고(단위 시험이 검사), `INTERVAL_ROUTE_BASIS_KMH = 25` 한 곳뿐이다.

## 캡처 (`document/ops/20261029-interval-route-hint/evidence/`)

`a-route-after-interval-800x360.png` · `b-interval-after-route-800x360.png` · `c-long-route-no-hint-800x360.png` · `d-start-warning-25kmh-800x360.png`

## 한계·미실행

- 화면 시험은 지도 없는 시험용 화면에서 실제 훅·안내창·인터벌 운동 창을 붙여 돌렸다. 실제 App 안에서의 동작(경로 탐색 → 안내)은 자동 시험이 없고, App 연결은 소스 계약 시험과 타입 검사로만 지킨다. **Chief 사이트 확인이 필요하다.**
- 실폰·운영 Firebase 미실행.
- 경유지를 하나씩 더하며 경로를 늘리는 동안에는 경로가 바뀔 때마다(짧은 동안) 안내가 다시 뜬다 — 지시대로이지만 번거로우면 「경로 창이 닫힌 뒤 한 번」으로 바꿀 수 있다(Chief 판단).
- 이어 달리기 경로는 남은 거리로 판정한다(시작 경고와 같음).

## 확인 순서

`C:\20.HDev\boxcycle` 에서 `npm run dev` → 주소는 터미널에 나온 것, 이미 열려 있으면 새로고침. 주의: `npm run dev` 는 운영 Firebase 를 쓴다.

1. INT → 15분 프리셋 「설정 적용」 → 지도에서 4 km 안팎 경로 → 「경로가 짧아요 … 최소 6.3 km」 → 확인
2. 경로를 지우고 인터벌을 끈 뒤, 짧은 경로를 먼저 잡고 INT 에서 켜기 → 창을 닫으면 「이 인터벌 설정(15:00)에는 6.3 km 이상…」
3. 그대로 ▶ → 「운동시간이 더 길어요 … 예상 속도 25.0 km/h 기준」
4. 간편 인터벌 주행으로 만든 경로에는 안내가 안 뜬다

## 2026-11-22 정리

Chief가 현재 구현의 커밋을 지시했다. 기존 동작을 유지하며 표고 조회·지도 성능 변경은 포함하지 않는다. 실제 App 흐름·실폰 검증 한계는 위와 같다.

재검증(Codex): 거리 계산 13/13·거리 안내 화면 4/4·센서 화면 10/10·진입 계약 21/21·tsc 통과. 첫 E2E는 기존 에뮬레이터 포트 점유로 시작 실패, hub의 로컬 서비스 목록 확인 후 기존 에뮬레이터를 사용해 14/14 통과했다. 새 증거는 `tmp/uncommitted-cleanup-20261122/`에 저장해 기존 증거를 덮어쓰지 않았다. 실폰·실센서·실제 App 진입 E2E는 이번에 실행하지 않았다.
