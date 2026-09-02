# 거리·방향 자동 Route — 3G 병합·푸시 및 Token 온보딩 기본값 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 검수 통과분 병합·푸시 + Token 온보딩 기본값 확정** |
| 최초 작성 | 2026-09-02 |
| 상태 | **완료 — main2 병합·푸시 (2026-09-02)** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-MERGE-3G` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 현재 HEAD | `8e9a7d1` (origin 과 동일) + 미커밋 변경 |
| 선행 | [3F-C-R1](260902-거리방향-자동Route-실패없는-도달제안-3F-C-R1-작업지시서.md) — 사용자 화면 검수 **PASS** |

## 1. 현황 (확인된 사실)

| 항목 | 값 |
|---|---|
| `origin/feat/distance-auto-route-ui-unification` | `8e9a7d1` — 로컬 HEAD 와 **동일**(이미 push 됨) |
| `origin/main2` | HEAD 에 **완전히 포함됨**. 로컬 `main2` 는 HEAD 의 조상 |
| main2 로 올라갈 commit 수 | **26** (`2b0bfec` ~ `8e9a7d1`) |
| 미커밋 변경 | 11개 파일 + 미추적 `apps/web/.env.emulator` |

병합은 fast-forward 가 가능하지만 **`--no-ff` 로 병합한다.** 기존 이력(`f99f636`, `e25961f`)이 기능 경계를 merge commit 으로 남기고 있으므로 규칙을 유지한다.

## 2. 미커밋 변경 — 3개 commit 으로 분리

| # | commit 메시지 | 파일 |
|---|---|---|
| 1 | `chore(dev): add emulator dev mode on port 5002` | `apps/web/.env.example` · `apps/web/.env.emulator`(신규) · `apps/web/package.json` · `package.json` · `apps/web/vite.config.ts` |
| 2 | `feat(route): finish 3F-C-R1 reach-offer wiring` | `apps/web/src/components/map/MapView.tsx` · `apps/web/src/hooks/useDistanceAutoRoute.ts` · `apps/web/src/hooks/useRoutePlanning.ts` · `apps/web/src/lib/distanceAutoRouteErrors.ts` · `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts` |
| 3 | `feat(token): grant 10 to guests and 15 to signed-in users` | `functions/src/routeTokenCore.ts` · `document/config-routeTokenEconomy.seed.json` |

`apps/web/.env.emulator` 는 비밀값이 없고(`VITE_USE_EMULATOR` · `VITE_FUNCTIONS_EMULATOR_HOST` 뿐) `--mode emulator` 동작에 필요하므로 **커밋한다.** gitignore 대상이 아님을 확인했다.

## 3. 푸시 전 필수 수정 3건 — 이 중 하나라도 남기면 push 하지 않는다

### 3.1 [차단] `test:route-token` 이 반드시 깨진다

`apps/web/scripts/route-token/route-token-contract.mjs` 가 **Guest 온보딩 잔액 3 을 하드코딩**한다.

```text
106  let balance = await ensureOnboarding(guest.idToken);
107  assert.equal(balance, 3, "onboarding balance");
110  assert.equal(balanceRetry, 3, "onboarding retry balance");
112  assert.equal(inspect.balance, 3);
120  assert.equal(json.result.routeTokenBalance, 3 - i, `route ${i} balance`);
177  assert.equal(inspect.balance, 3, "provider failure net balance");
194  assert.equal(afterRetry.balance, 3, "retry must not add spend after refund");
```

`guestOnboardingGrant = 10` 이 되면 전부 실패한다.

**수정 방식(중요 — 기대값만 10 으로 바꾸지 말 것):** harness 가 Emulator Firestore 의 `config/routeTokenEconomy` 문서를 **시험 전용 값으로 직접 seed** 하고, 그 seed 값을 기대치로 사용하도록 바꾼다.

- seed 예: `{ generateCostBase: 1, onboardingGrant: 3, guestOnboardingGrant: 3, ... }`
- 기대치는 상수 하드코딩이 아니라 seed 한 값에서 파생한다.
- 이렇게 하면 ① 시험이 제품 기본값 변경에 흔들리지 않고 ② 소진 루프가 3회로 유지돼 harness 가 느려지지 않으며 ③ **§3.2 의 config 문서 우선 경로를 시험이 실제로 통과**하게 된다.
- 로그인 사용자 경로도 함께 덮도록 비익명 계정 1건의 온보딩 지급이 `onboardingGrant` 를 따르는지 assert 를 추가한다.

### 3.2 [차단] 운영 Firestore `config/routeTokenEconomy` 문서가 코드 기본값을 덮어쓴다

`loadRouteTokenEconomy()` 는 `config/routeTokenEconomy` 문서를 먼저 읽고, **문서에 있는 필드는 문서 값을 쓴다.** 코드 기본값은 필드가 없을 때만 적용된다.

운영에 이 문서가 이미 `onboardingGrant: 3` 으로 존재하면 배포 후 결과는 다음과 같다.

| 사용자 | 실제 지급 | 이유 |
|---|---:|---|
| 로그인 | **3** | 문서의 `onboardingGrant: 3` 이 이김 |
| Guest | **10** | `guestOnboardingGrant` 필드가 문서에 없어 코드 기본값 적용 |

즉 **게스트가 로그인 사용자보다 많이 받는 역전**이 발생한다. 코드만 배포하면 이 변경은 의도대로 동작하지 않는다.

**조치:**

1. 운영 Firestore 에 `config/routeTokenEconomy` 문서가 존재하는지 확인하고 결과를 보고한다.
2. 존재하면 `document/config-routeTokenEconomy.seed.json` 내용과 일치하도록 갱신한다(`onboardingGrant: 15`, `guestOnboardingGrant: 10`).
3. 문서가 없으면 그대로 두고 "코드 기본값 적용" 사실을 보고에 남긴다.
4. 이 확인·갱신은 **push 와 별개**다. push 는 진행하되, 배포 전 반드시 처리한다.

**확인 결과(2026-09-02):** 프로젝트 `boxcycle-dc2df` 운영 Firestore — `config/routeTokenEconomy` 문서 **없음**(`exists: false`). 코드 기본값(Guest 10 · 로그인 15) 적용. 갱신 불필요.

### 3.3 [수정] `mergeUserAuthMeta` 실패 시 Guest 가 15 를 받는다

`routeTokenEnsureOnboarding.ts:43` 에서 `mergeUserAuthMeta(uid).catch(() => {})` 로 실패를 삼킨다. 실패하면 `users/{uid}.isAnonymous` 가 기록되지 않고, `readUserTokenState` 의 `data.isAnonymous === true` 가 `false` 가 되어 **Guest 에게 로그인 금액 15 가 지급**된다. 온보딩은 멱등 1회이므로 **일시적 실패가 영구 과지급**으로 굳는다.

**수정:** `mergeUserAuthMeta(uid)` 의 반환값 `{ isAnonymous }` 를 받아 `ensureRouteTokenOnboarding(uid, isAnonymousHint)` 로 명시 전달한다. 호출이 실패하면 **보수적으로 Guest(익명)로 간주**한다. 문서 필드가 있으면 문서 값을 우선하고, 없을 때만 hint 를 쓴다. 이 분기에 단위 시험을 추가한다.

## 4. 기존 사용자 소급 지급 없음 (사실 고지)

`ensureRouteTokenOnboarding` 은 `routeTokenOnboardingGranted === true` 인 사용자에게 재지급하지 않는다. 따라서 **이미 3개를 받은 기존 Guest·로그인 사용자는 그대로 3개**다.

- 소급 지급은 이번 범위에 **포함하지 않는다.** 필요하면 별도 결정·별도 CLI 로 처리한다.
- 따라서 검증은 반드시 **새 Guest 세션**(새 익명 UID)과 **새 로그인 계정**으로 한다. 기존 세션으로 확인하면 3개가 보이며, 이는 회귀가 아니다.

## 5. 실행 순서

```text
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle

# (1) §3.1 harness seed 방식 수정, §3.3 isAnonymous hint 수정
# (2) §2 의 3개 commit 으로 분리 커밋

npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:distance-auto-route-replay
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git status --short          # clean 이어야 한다

# (3) 기능 브랜치 push
git push origin feat/distance-auto-route-ui-unification

# (4) main2 병합 — --no-ff
git switch main2
git pull --ff-only origin main2
git merge --no-ff feat/distance-auto-route-ui-unification \
  -m "merge: 거리·방향 자동 Route 실패 없는 도달 제안(3F-C-R1)과 Token 온보딩 기본값을 main2에 병합한다"

# (5) 병합 후 재검증 — 병합 결과 tree 에서 다시 돌린다
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build

# (6) push
git push origin main2
git switch feat/distance-auto-route-ui-unification
```

- `main` 에는 병합하지 않는다. 개발 base 는 `main2` 다.
- 기존 commit 을 amend·reset·rebase 하지 않는다.
- deploy 는 이번 범위가 아니다. §3.2 의 config 문서 처리가 끝난 뒤 별도 지시한다.
- worktree `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` 는 **삭제하지 않는다.** 3F-D 후속 작업에서 계속 쓴다.

## 6. 문서 갱신 (같은 push 에 포함)

1. **결정 로그** [260707-RTW-결정-로그.md](../../260707-RTW-결정-로그.md) 최상단에 2줄 append:
   - `[Route]` `[Product]` — 자동 Route 는 클릭 지점에서 끝나는 경로를 만들고, 불가능하면 실패 대신 방향 도로 위 목표거리 지점을 `offered` 로 제시한다. 직선 비율 도넛은 도로거리와 단조 관계조차 없어 폐기했다. 근거: 사용자 6클릭 실측(성공 1/6 → 6/6).
   - `[Economy]` — Route Token 온보딩 지급을 Guest 10 · 로그인 15 로 확정(기존 3). 기존 사용자 소급 지급 없음.
2. **상태보드** [260707-RTW-기능-인벤토리-상태보드.md](../../260707-RTW-기능-인벤토리-상태보드.md) — 거리·방향 자동 Route 항목의 상태 기호를 코드와 대조해 갱신한다. 해당 행이 없으면 새로 추가한다.
3. **[260518-Route-Token-경제-설계.md](../../260518-Route-Token-경제-설계.md)** — 온보딩 지급 수치를 3 → Guest 10 / 로그인 15 로 갱신하고, `config/routeTokenEconomy` 문서가 코드 기본값보다 **우선**한다는 사실을 명시한다(§3.2 가 이 문서에 없어서 놓친 함정이다).
4. **[3F-C-R1 작업지시서](260902-거리방향-자동Route-실패없는-도달제안-3F-C-R1-작업지시서.md)** 상태를 `사용자 검수 PASS · 3G 로 병합` 으로 갱신하고, [document/README.md](../../README.md) 색인 행도 함께 갱신한다.

### 6.5 [주의] `document/ops/route-relay/` 는 아직 어느 브랜치에도 커밋되지 않았다

route-relay 지시서 13개는 `C:\20.HDev\boxcycle` 의 **미추적(untracked) 파일**로만 존재하며, 개발팀장 worktree(`boxcycle-distance-auto-route-ui-circle`)에는 **디렉터리 자체가 없다.** README 색인 행이 이 파일들을 가리키므로 지금 상태로 push 하면 **깨진 링크**가 된다.

조치: `C:\20.HDev\boxcycle\document\ops\route-relay\` 와 `C:\20.HDev\boxcycle\document\README.md` 를 **정본으로 삼아** worktree 의 같은 경로로 복사한 뒤, §6 의 다른 문서 갱신과 함께 커밋한다.

```text
cp -r "C:/20.HDev/boxcycle/document/ops/route-relay" \
      "C:/20.HDev/boxcycle-distance-auto-route-ui-circle/document/ops/"
cp    "C:/20.HDev/boxcycle/document/README.md" \
      "C:/20.HDev/boxcycle-distance-auto-route-ui-circle/document/README.md"
```

복사 후 README 색인의 route-relay·ride-relay 링크가 실제 파일을 가리키는지 확인하고 보고한다. 지시서 본문은 감리가 관리하므로 **내용을 수정하지 않는다** — §6 이 지정한 상태 표기 갱신만 반영한다.

## 7. 보고 (Review 에서 멈추고 제출)

- §3.1 harness 수정 방식과 seed 값
- §3.2 운영 `config/routeTokenEconomy` 문서 존재 여부와 처리 결과
- §3.3 수정 diff 와 추가한 단위 시험
- 새 Guest / 새 로그인 계정으로 확인한 **실제 지급 잔액 10 / 15** 화면 증거
- 5개 시험 명령의 통과 로그(병합 전·후 각 1회)
- 최종 `git log --oneline -6 main2` 와 `git status --short`

push 전에 사용자 확인을 받는다. PR·deploy 는 하지 않는다.
