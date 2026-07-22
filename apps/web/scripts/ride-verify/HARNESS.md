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
| `entry-contract.mjs` | 진입 6단계 셀렉터 계약(앵커 정규식 + 셀렉터 문자열) | 불필요 |
| `verify-selectors.mjs` | 계약 앵커가 소스에 실재하는지 정적 검증(exit 0/1) | 불필요 |
| `../../e2e/ride-entry.spec.ts` | Playwright 진입 시퀀스(게스트→코스→주행 시작→running) | **필요** |

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
cd apps/web && RIDE_VERIFY_LIVE=1 npm run test:e2e -- ride-entry
```
`RIDE_VERIFY_LIVE=1` 없으면 **skip**(기본). Playwright config 의 webServer 가 `dev:localhost`(포트 5000)를
자동 기동한다. 진입 6단계를 클릭하고 마지막에 `주행 지표` 그룹 + `주행 종료` 버튼으로 running 을 확정한다.

## Firebase 전제 (중요 — 아직 미배선)

진입 spec 은 실제 Firebase 에 붙는다:
- 게스트 진입 = 실제 `signInAnonymously`(`src/hooks/useAppAuth.ts`)
- 코스 로드 = 실제 Firestore(`ensureBasicCoursesSeeded`·`fetchCourseRoutePayload`)

**에뮬레이터 배선이 없다** — 루트 `firebase.json` 에 emulators 블록 없고, 코드에 `connectAuthEmulator`/
`connectFirestoreEmulator` 미사용. `RIDE_VERIFY_LIVE=1` 로 켜려면 아래 중 하나가 선행돼야 한다:
- (a) 테스트용 Firebase 프로젝트 + 익명 인증 허용, 또는
- (b) 에뮬레이터 신규 배선(firebase.json + connect* 배선), 또는
- (c) Playwright route mock 으로 `firebase/auth`·`firestore` 네트워크 가로채기.

`VITE_ALLOW_UNAUTH_MAP=1` 은 인증 카드만 완화할 뿐 `handleStartRide` 가 `!user` 면 return 하므로
주행 시작은 여전히 실제 익명 로그인이 필요하다(우회 불가).

## 미구현 (하네스 확장 TODO)

- **Firebase 배선**: 위 (a)/(b)/(c) 중 하나. 이게 되기 전엔 진입 spec 은 계약(1번)만큼의 회귀 방어력이 없다.
- **peer 동행 진입**: 현재 spec 은 단독 주행만. 2인 진입(peer-sync 하네스와 연계)은 미구현.
- **주행 종료·저장 검증**: running 확정까지만. 종료→요약→영속화(`useRideEndAndPersistence`)는 범위 밖.
