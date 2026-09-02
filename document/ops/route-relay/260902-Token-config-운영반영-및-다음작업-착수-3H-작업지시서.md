# Token config 운영 반영 및 다음 작업 착수 3H 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 3G 잔여 처리 + 다음 작업 착수** |
| 최초 작성 | 2026-09-02 |
| 상태 | **즉시 실행** |
| 작업 ID | `TOKEN-CONFIG-DEPLOY-3H` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/ride-continue-r1` (현재 `30cf14d`, commit 0개) |
| 선행 | [3G](260902-거리방향-자동Route-3G-병합푸시-Token온보딩기본값-작업지시서.md) — **완료** |

## 1. 3G 검수 결과

`main2` = `origin/main2` = `30cf14d`, worktree clean. 병합·푸시 완료를 확인했다.

| 항목 | 판정 | 확인 내용 |
|---|---|---|
| §3.1 harness seed | **PASS** | `harness-test-economy.mjs` 신설, 기대치를 seed 값에서 파생(`economy.onboardingGrant` / `guestOnboardingGrant`). 로그인 경로 assert 추가 |
| §3.3 isAnonymous | **PASS (지시보다 개선)** | `isAnonymousHint` 기본값 `true`(보수적 Guest). ID token 의 `sign_in_provider === "anonymous"` 로 1차 판정해 **추가 호출 없이** 해결하고 `mergeUserAuthMeta` 를 보조로 씀 |
| §2 commit 분리 | **PASS** | `e1f525b` · `9f70a59` · `e6ba4a0` · `eb4f114` · merge `30cf14d` |
| §6 문서 갱신 | **PASS** | 결정 로그 2줄, 상태보드 §3.4 2행, 260518 §222 에 「config 문서 우선」 명시 |
| §6.5 route-relay 복사 | **PASS** | 13개 문서 커밋됨 |
| **§3.2 운영 config 문서** | **미완** | 존재 여부·처리 결과가 어디에도 기록되지 않았다 |

§3.2 는 배포 시점의 차단 항목이므로 push 를 막지는 않았다. 다만 **이 상태로 배포하면 온보딩 지급이 의도대로 동작하지 않는다.**

## 2. 3H-1 — 운영 `config/routeTokenEconomy` 확인·갱신 (배포 전 차단)

`loadRouteTokenEconomy()` 는 Firestore 문서 필드를 코드 기본값보다 **우선**한다. 운영에 이 문서가 구값으로 남아 있으면 배포 후 다음이 된다.

| 사용자 | 문서에 `onboardingGrant: 3` 이 있을 때 |
|---|---:|
| 로그인 | **3** (문서 값이 이김) |
| Guest | **10** (필드 없음 → 코드 기본값) |

게스트가 로그인 사용자보다 많이 받는 역전이다.

**절차**

1. Firebase 콘솔에서 프로젝트 `boxcycle` → Firestore → `config/routeTokenEconomy` 문서 존재 여부를 확인한다.
2. **존재하면** [`document/config-routeTokenEconomy.seed.json`](../../config-routeTokenEconomy.seed.json) 과 일치하도록 갱신한다 — 최소한 `onboardingGrant: 15`, `guestOnboardingGrant: 10` 두 필드.
3. **없으면** 그대로 둔다(코드 기본값이 적용된다).
4. 어느 쪽이든 **문서 화면 캡처**를 증거로 남기고, [3G 지시서](260902-거리방향-자동Route-3G-병합푸시-Token온보딩기본값-작업지시서.md) §3.2 아래에 `확인 결과(2026-09-02): …` 한 줄을 추가한다.

일회성 조회를 위해 새 CLI 를 만들지 않는다. 콘솔 확인으로 충분하다.

**배포는 이 확인이 끝난 뒤 별도 지시로 한다.** 이번 작업에서 deploy 하지 않는다.

## 3. 3H-2 — 다음 작업지시서 전달 (지금 시작이 막혀 있는 원인)

`feat/ride-continue-r1` 브랜치는 만들어졌지만 commit 이 0개다. 원인은 **읽을 지시서가 worktree 에 없기 때문**이다.

[260902-다음 주행·이어 달리기 자동 Route 결합 R1](../ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md) 은 `C:\20.HDev\boxcycle` 의 미추적 파일로만 존재하고, worktree 의 `document/ops/ride-relay/` 에는 260829 하나뿐이다.

```text
cp "C:/20.HDev/boxcycle/document/ops/ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md" \
   "C:/20.HDev/boxcycle-distance-auto-route-ui-circle/document/ops/ride-relay/"
cp "C:/20.HDev/boxcycle/document/README.md" \
   "C:/20.HDev/boxcycle-distance-auto-route-ui-circle/document/README.md"
```

복사 후 README 색인의 `RIDE-CONTINUE-1-R1` 행이 실제 파일을 가리키는지 확인하고, 3H-1 의 §3.2 기록과 함께 **`docs:` commit 1개**로 남긴다.

## 4. 3H-3 — RIDE-CONTINUE-1-R1 단계 A 실행·보고

[R1 지시서](../ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md) §2 의 3건을 **실제로 눌러 보고** 화면 증거와 함께 보고한다. 코드만 읽고 추정하지 않는다.

1. 자동 Route 생성 직후 `Go` 로 주행이 시작되는가. `rideStatus` 가 `running` 이 되는가.
2. 자동 Route 를 「내 경로로 저장」하면 SavedRoute 로 남는가. `profile`·거리·geometry 가 생성값과 일치하는가.
3. 주행을 끝낸 직후 `startLngLat` 은 무엇인가. 결과 시트에서 다음 행동으로 갈 수 있는 경로가 있는가.

**단계 A 는 코드를 바꾸지 않는다. commit 도 없다.** 보고 후 사용자 확인을 받고 단계 B 로 넘어간다.

## 5. commit·push 시점 (이번 작업 이후 적용)

현재 push 할 것은 없다. 3G 까지 전부 원격에 반영돼 있다. 앞으로의 시점은 다음과 같이 고정한다.

| 시점 | commit | push |
|---|---|---|
| 3H-1·3H-2 (문서·config 기록) | `docs:` 1개 | **하지 않음** — 브랜치에만 |
| R1 단계 A (확인 보고) | 없음 | 없음 |
| R1 단계 B-A (진행률 신뢰성) | 1개 | 하지 않음 |
| R1 단계 B-B (Ride anchor·Firestore 필드) | 1개 | **여기서 1차 push** |
| R1 단계 B-C (결과 시트) | 1개 | 하지 않음 |
| R1 단계 C (자동 Route 결합) | 1개 | 하지 않음 |
| 3회 루프 e2e 통과 + 사용자 검수 PASS | — | **`main2` `--no-ff` 병합 후 2차 push** |

**1차 push 를 단계 B-B 에 두는 이유**: 여기서 `rides/{rideId}` 에 `sessionStartLngLat`·`sessionEndLngLat` 필드가 추가된다. 데이터 계약 변경은 되돌리기가 비싸고 에뮬레이터 저장·재조회 검증까지 끝난 상태이므로, 로컬에만 두지 말고 원격에 보존한다.

**push 의 일반 원칙** — 다음 셋 중 ①②는 항상 필수, ③이면 조기 push 한다.

1. 자동 시험 전량 통과(`git status` clean 포함)
2. 사용자 화면 검수 PASS
3. 되돌리기 비싼 변경 포함 — Firestore 스키마·데이터 계약·운영 config

## 6. 금지·경계

- deploy 하지 않는다. 3H-1 확인 결과 보고 후 별도 지시한다.
- `main` 에 병합하지 않는다. 개발 base 는 `main2`.
- 기존 commit 을 amend·reset·rebase 하지 않는다.
- 단계 A 보고 없이 단계 B 로 넘어가지 않는다.
- 지시서 본문은 감리가 관리한다. 복사만 하고 내용을 수정하지 않는다. 상태 표기 갱신은 지시받은 것만.

## 7. 참고 — main repo working tree 정리 필요

`C:\20.HDev\boxcycle` (브랜치 `feat/distance-based-auto-route`) 에 `functions/src/routeTokenCore.ts`·`document/config-routeTokenEconomy.seed.json`·`document/README.md` 미커밋 변경이 남아 있다. 이미 `main2` 에 병합된 내용의 잔재로 보인다. **이번 작업에서 손대지 말고**, 처분 여부는 사용자에게 확인한 뒤 별도로 처리한다.
