# 결과05 — 위치 선택 hook·안내

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 구현 결과 |
| 최초 작성 | 2026-10-17 |
| 상태 | DONE — 이 단계만. App·지도 연결 전 |
| 독자 | AI |
| 연결 문서 | [지시05](02-task-05.md) |
| 브랜치 | `main2` @ `1f226f1` |

지시05의 신규 위치 파일만 추가했다. `App.tsx`, `MapView`, `AppIntroScreen`, `entry-contract.mjs` 는 읽거나 수정하지 않았다. 기존 dirty 는 그대로 두었고 commit/push/deploy/server/browser/subagent 는 하지 않았다. 제품 디버그 스위치와 `dev-tools.json` 등록은 없다(`*.test.*` 는 등록 제외).

## 추가한 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/lib/geo/entryLocation.ts` | 권한 조회·현재 위치·generation 가드. 브라우저 `navigator` 연결 |
| `apps/web/src/hooks/useEntryLocation.ts` | `useEntryLocation(enabled)` → `{ phase, permission, target, notice, chooseRome, chooseCurrent }` |
| `apps/web/src/components/auth/EntryLocationDialog.tsx` | 선택 대화상자. `ready`/`idle` 은 `null` |
| `apps/web/src/components/auth/EntryLocationDialog.css` | 44px 버튼, 카드 스크롤, 하단 출처 여백 |
| `apps/web/scripts/identity/entry-location.test.ts` | 권한·실패·늦은 콜백·watchdog·대화상자 |

`MAP_FALLBACK_CENTER` / `MAP_FALLBACK_ZOOM` 은 `lib/map/mapBootCenter` 에서 hook 이 가져온다. 콜로세움 목적지는 그 복사본이라 상수를 바꾸지 않는다. 좌표 저장·로그·전송·`watchPosition` 은 넣지 않았다.

## 동작

- `enabled === false` 및 cleanup 은 지리 API를 부르지 않고 타이머와 generation 을 무효화한다.
- 권한 조회 watchdog 은 1500ms. 미지원·예외·미응답은 `unknown` + `choice`.
- `granted` 만 `getCurrentPosition` 1회(timeout 8000ms, `maximumAge: 0`, 자체 8초 watchdog).
- `prompt`/`unknown` 은 「내 위치에서 시작」에서만 요청한다. `denied` 는 재요청하지 않는다.
- 지리 API 없음, 실패, 거절, timeout, 범위 밖 좌표는 콜로세움 `ready` 와 짧은 한국어 `notice`.
- 콜로세움 선택은 진행 중 요청을 즉시 취소한다. 늦은 콜백은 목적지를 바꾸지 않는다.
- 완료된 `target` 객체 참조는 같은 세션에서 유지된다.
- 대화상자 제목·`aria-label` 은 「어디에서 시작할까요?」. `notice` 는 그리지 않는다.

## 시험

작업 폴더: `C:\20.HDev\boxcycle\apps\web`

```text
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts
```

exit 0. pass 18, fail 0, duration 709ms.

```text
npx eslint src/hooks/useEntryLocation.ts src/lib/geo/entryLocation.ts src/components/auth/EntryLocationDialog.tsx scripts/identity/entry-location.test.ts
```

exit 0. 출력 없음.

검증한 경우: granted 즉시 1회, prompt/unknown 의 명시 요청, denied 재요청 없음, 지리 API 미지원, 조회 실패, 위치 실패·브라우저 timeout·거절·invalid, 조회 1500ms watchdog 이후의 늦은 granted, 위치 8초 watchdog 이후의 늦은 성공, 콜로세움 취소, `enabled false` 와 세션 재시작, 두 세션의 오래된 요청, 대화상자 문구·버튼, CSS 의 44px·`overflow: auto`·하단 `3.25rem`.

## 하지 않은 것

- `npm run build`, Playwright, 브라우저, 개발 서버. App 이 hook 을 아직 쓰지 않으므로 빌드는 다음 단계.
- 폰 667×300 실측. 스크롤과 출처 여백은 CSS 계약으로만 확인했다.
- hook 을 DOM에 마운트하지 않았다. 이 저장소에 jsdom 이 없고, 비동기 동작은 hook 이 부르는 `createEntryLocationSession` 으로 검증했다. hook 은 `enabled` 가드 다음에만 `readBrowserEntryLocationEnv()` 를 호출한다.

## 다음 단계에 남은 연결

App 이 `useEntryLocation` 의 `target`/`notice` 를 읽고, `EntryLocationDialog` 에 `phase`·`permission`·`chooseRome`·`chooseCurrent` 를 넘기면 된다. 지도 fly 와 인증 흐름은 이 단계 범위 밖이다.
