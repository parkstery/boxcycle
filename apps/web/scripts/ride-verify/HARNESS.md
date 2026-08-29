# ride-verify 하네스 — 도구 사용법 (HOW)

이 폴더(`apps/web/scripts/ride-verify/`)는 실주행 진입 시퀀스(게스트→경로 로드→주행 시작)를
검증하는 하네스다. **언제·왜 쓰는가**는 [`.claude/skills/ride-verify/SKILL.md`](../../../../.claude/skills/ride-verify/SKILL.md)를 보라 —
이 문서는 **어떻게 쓰는가**만.

두 층으로 나뉜다:
1. **셀렉터 계약 검증**(`verify-selectors.mjs`) — Firebase·앱 불필요. 항상 도는 커밋 전 게이트.
2. **진입 e2e spec**(`../../e2e/ride-entry.spec.ts`) — 실제 클릭 시퀀스. **Firebase 준비 시에만** 실행.

## 파일

| 파일 | 역할 | Firebase |
|---|---|:---:|
| `entry-contract.mjs` | 진입·다음 주행 셀렉터 계약(앵커 정규식 + 셀렉터 문자열) | 불필요 |
| `verify-selectors.mjs` | 계약 앵커가 소스에 실재하는지 정적 검증(exit 0/1) | 불필요 |
| `../../e2e/ride-entry.spec.ts` | Playwright 진입 시퀀스(게스트→코스→주행 시작→running) | **필요** |
| `../../e2e/ride-continuation.spec.ts` | 종료→재진입→재개(다음 주행 카드·진행률 단조·끝점 연결·legacy) | **필요** |

## 1. 셀렉터 계약 검증 `verify-selectors.mjs`

```bash
cd apps/web && node scripts/ride-verify/verify-selectors.mjs
```
`entry-contract.mjs` 의 각 단계 앵커(예: `aria-label="주행 시작"`)가 해당 소스 파일에 있는지 grep.
하나라도 없으면 exit 1 — **UI 변경으로 셀렉터가 사라졌음을 e2e 돌리기 전에(=Firebase 없이) 잡는다.**
tsc·lint 처럼 커밋 전 게이트로 쓴다.

셀렉터를 바꿀 땐 `entry-contract.mjs` 와 `e2e/ride-entry.spec.ts` **둘 다** 고친다(같은 계약을 공유).

## 2. 진입 e2e `ride-entry.spec.ts`

```bash
cd apps/web && npm run test:e2e:ride
```
이 스크립트가 **에뮬레이터를 자동 기동**하고(`firebase emulators:exec`) 그 안에서 spec 을 돌린다.
직접 `RIDE_VERIFY_LIVE=1 playwright test ride-entry` 로 켜지 마라 — 그러면 실 Firebase 에 붙는다.

동작 원리: `emulators:exec` 가 자식 프로세스에 `FIRESTORE_EMULATOR_HOST` 등을 주입한다.
`playwright.config.ts` 가 그 env 존재를 감지(`underEmulator`)해 ① `RIDE_VERIFY_LIVE=1` 로 skip 해제,
② webServer(vite)에 `VITE_USE_EMULATOR=1` 주입 → 앱이 `connect*Emulator` 로 에뮬레이터에 붙는다.
`RIDE_VERIFY_LIVE=1` 없으면 spec 은 **skip**(기본).

## Firebase 에뮬레이터 배선 (2026-07-22 완료 — 경로 (b))

진입 spec 은 실제 Firebase API 를 쓴다(게스트 = `signInAnonymously`, 코스 = Firestore). 이를 로컬
에뮬레이터로 결정적·무비용·오프라인으로 돌리도록 배선했다:

- `firebase.json` `emulators` 블록: auth 9099 · firestore 8080 · database 9000.
- `src/lib/firebase.ts`: `getFirebaseFirestore()` 싱글턴 신설(흩어진 `getFirestore(getFirebaseApp())`
  64곳 통합) + `VITE_USE_EMULATOR=1` 일 때 `connectAuthEmulator`/`connectFirestoreEmulator`/
  `connectDatabaseEmulator` 배선. **신규 Firestore 접근은 반드시 `getFirebaseFirestore()` 를 쓴다.**
- 전제: 로컬에 Java(JDK 11+)·firebase-tools 필요(둘 다 설치 확인됨). `.firebaserc` = `boxcycle-dc2df`.

입문 코스 모달은 로컬 상수(`BASIC_COURSES` → `getBasicSharedHubSummaries()`)로 채워지므로
빈 에뮬레이터 DB 에서도 목록이 뜬다. `routePublications` seed 는 rules 상 리뷰어 전용이라 게스트가
막히지만(`.catch` 로 무시), 진입 시퀀스 자체엔 지장 없다(presence/동행에만 영향).

## 해결됨 — spec 4단계 red 근본 원인 (2026-07-22)

증상: 게스트 인증·MENU·입문 탭까지 통과하나 4단계 `주행 시작` 미출현. **red 는 3겹이었다:**
1. Firebase 배선 부재 → 에뮬레이터 배선(위).
2. 입문 경로 빈 배열(`BASIC_SHARED_HUB_IDS`) → Basic 1/2/3 활성화.
3. **spec 셀렉터 결함** — 3단계가 `modal.getByRole('button').first()` 로 첫 텍스트 버튼을 집었는데,
   모달 헤더 **'닫기' 버튼이 DOM 상 코스 리스트보다 앞**이라 닫기를 클릭 → 모달만 닫히고 코스 미로드
   → `hasRoute=false` → stage 가 `ready-to-start` 로 안 감 → Go 버튼 미출현. (지난 스냅샷의 "모달 없고
   MENU 에 머묾"이 정확히 이것.) → 코스 항목만 겨냥하도록 `modal.locator('button.oc-modal__item').first()` 로 수정.

**현재 `npm run test:e2e:ride` = 1 passed(green).** 6단계 진입 시퀀스 전체가 에뮬레이터에서 결정적으로 검증된다.
교훈: 이 red 를 배선/인증 회귀로 의심하지 마라 — 코스 로드가 안 되면 stage 전환이 막힌다. stage 는
`useRideUiStage` 가 `hasRoute(=routeGeometry && distance>0)` 로 파생하므로, 4단계 red 는 대개 3단계 클릭이
실제 코스 아이템을 못 눌렀다는 신호다.

## 3. 다음 주행·이어 달리기 e2e `ride-continuation.spec.ts` (2026-08-29 추가)

```bash
cd apps/web && npm run test:e2e:ride-continuation
```
`ride-entry` 와 같은 방식으로 에뮬레이터를 자동 기동한다. 다른 dev 서버가 5000 을 잡고 있으면
`RTW_DEV_PORT=5001 npm run test:e2e:ride-continuation`.

`ride-entry` 가 **running 확정까지**라면 이 spec 은 **종료 이후**를 본다:

| 케이스 | 무엇을 고정하나 |
|---|---|
| C1 | 미완주 SavedRoute 20% 종료 → 결과 시트(전체 진행) → reload → 「다음 주행」 카드 → 재개 → 누적 진행률 상승 |
| C2 | 로드 후 서버가 43% 로 올라간 뒤 31% 를 보내도 **43% 가 남는다**(transaction max) |
| C3 | 완주 후 「끝점에서 새 경로」 — 이전 SavedRoute geometry 불변 |
| C4 | ad-hoc(입문 코스) 주행은 저장하지 않아도 다음 출발점이 남는다 |
| C5 | 좌표 필드가 없는 legacy Ride 는 기록만 보이고 CTA·Null Island 이동이 없다 |

**시험 데이터는 에뮬레이터 REST(`Authorization: Bearer owner`)로 심는다** — 앱에 시험 전용
훅을 만들지 않기 위해서다. 게스트 uid 는 Firebase v9 가 **IndexedDB**(`firebaseLocalStorageDb`)에
저장하므로 localStorage 만 뒤지면 못 찾는다.

주의 — **HUD 「거리」 셀은 주행 전과 주행 중의 의미가 다르다**. 주행 전에는 경로 전체 거리 한 값,
주행 중에는 「오늘 / 전체」다. `/` 유무로 구분하지 않으면 주행이 시작되기도 전에 목표 거리에
도달한 것으로 오판해 곧바로 종료를 눌러 버린다(실제로 겪은 red).

또한 결과 시트는 **로컬 record 로 낙관 표시**되므로 Firestore 반영은 그보다 늦다 — 서버 값을
단언하거나 reload 하기 전에는 `expect.poll` 로 서버 문서를 기다린다.

## 미구현 (하네스 확장 TODO)

- **peer 동행 진입**: 현재 spec 은 단독 주행만. 2인 진입(peer-sync 하네스와 연계)은 미구현.
