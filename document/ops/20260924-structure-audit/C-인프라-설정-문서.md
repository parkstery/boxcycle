# C — 인프라·설정·문서 구조 감사 (2026-09-24)

> 조사 범위: `apps/web/src` 를 제외한 전부. HEAD `3b97160`.
> 읽기 전용. `git status` 는 본 조사 중 변경 없음(미추적 `0`, 본 산출 폴더만).

## 1. `functions/` (src 106 파일)

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `functions/src/index.ts` | ACTIVE | 배포 진입점. 2개 onRequest + 24개 re-export | 높음 — 전 CF 진입점 | 유지 |
| `functions/src/index.harness.ts` | SUPPORT | 내부 참조 0건이나 `apps/web/scripts/route-token/functions-mirror.mjs`·`run-route-token-harness.mjs`·`production-surface.test.mjs` 가 문자열로 참조 | 중간 — route-token 하네스 전용 | 유지 |
| `functions/src/courseActivityAggregateCore.ts` | LEGACY | 2줄 `export * from "./routeActivityAggregateCore.js"` + `@deprecated Phase 6`. 코드·package·firebase.json 참조 0건 | 낮음 | 삭제 후보 |
| `functions/src/courseActivityHeatReconcile.ts` | LEGACY | 동일(2줄 alias). 참조 0건 | 낮음 | 삭제 후보 |
| `functions/src/courseActivityOnRideCreated.ts` | LEGACY | 동일(2줄 alias). 참조 0건 | 낮음 | 삭제 후보 |
| `functions/src/courseActivityOnLiveCourseRideWritten.ts` | LEGACY | 4줄 alias. **코드 참조 0건인데 루트 `package.json` 의 `deploy:course-activity-functions`·`deploy:publication-presence` 가 이 함수명을 배포 대상으로 지정** — 그러나 `index.ts` 가 export 하지 않으므로 배포 대상에 존재하지 않음 | **높음** — 배포 스크립트가 실제로는 아무 함수도 갱신하지 않는다 | 검토 필요 |
| `functions/src/courseActivityScheduledReconcile.ts` | LEGACY | 위와 동일 | **높음** | 검토 필요 |
| `functions/src/cliInspectLivePresence.ts` | DEAD | 코드 참조 0건 + `functions/package.json`·루트 `package.json` 에 대응 npm 스크립트 없음 (다른 25개 cli*는 전부 `admin:*` 스크립트 존재) | 낮음 | 삭제 후보 |
| `functions/src/cliInspectRoutePublications.ts` | DEAD | 동일 | 낮음 | 삭제 후보 |
| `functions/src/cliInspectSavedRouteFingerprints.ts` | DEAD | 동일 | 낮음 | 삭제 후보 |
| `functions/src/cliInspectTrailMembers.ts` | DEAD | 동일 | 낮음 | 삭제 후보 |
| `functions/src/cli*.ts` (나머지 26개) | SUPPORT | 각각 `functions/package.json` 의 `admin:*` 1건이 대응. 일회성 마이그레이션·백필·감사 | 중간 — 대부분 완료된 마이그레이션(`cliMigrateRoomsToTrails`·`cliPhase7TerminologyPurge`·`cliPurgeConquestV1` 등) | 검토 필요 (`archive/` 분리 후보) |
| `functions/src/*Core.ts` (30여 개) | ACTIVE/SUPPORT | 전부 1건 이상 참조. `initAdminForCli.ts` 28건으로 최다 | 높음 | 유지 |
| `functions/src/distanceAutoRouteCore.test.ts` | TEST | `functions/package.json` `test` 가 `node --test lib/distanceAutoRouteCore.test.js` 로 실행. **functions 전체에서 유일한 단위 테스트** | 낮음 | 유지 |
| `functions/tsconfig.json` | CONFIG | `noUnusedLocals`·`noUnusedParameters` 켜짐. eslint 설정 없음(pre-commit 훅이 명시적으로 건너뜀) | 낮음 | 검토 필요 |

**중복 로직** — `courseActivity*` 5개 alias 가 `routeActivity*` 실체를 가리키는 Phase 6 호환 레이어. 전부 2~4줄. 코드 참조 0, package.json 참조만 남아 **「죽은 alias 가 배포 스크립트만 붙잡고 있는」 구조**.

**cli 난립** — `functions/src` 106 파일 중 **30개(28%)가 `cli*` 일회성 도구**. `functions/package.json` 에 `admin:*` 28개, 루트에 그중 13개만 재노출 → 두 곳 드리프트.

## 2. `scripts/` (루트)

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `scripts/ops-relay/await-next.mjs` | ACTIVE | 스킬 문서 등 19건 참조 | 중간 — 릴레이 핵심 | 유지 |
| `scripts/ops-relay/check-amend.mjs` | ACTIVE | 6건 참조 | 낮음 | 유지 |
| `scripts/ops-relay/poll-next.mjs` | SUPPORT | 5건 참조(대부분 자기 문서). `await-next` 와 기능 중첩 | 낮음 | 통합 후보 |
| `scripts/ops-relay/watch-status.mjs` | SUPPORT | 2건 참조 — Chief 상황판용, 실사용 흔적 희박 | 낮음 | 검토 필요 |
| `scripts/gen-basic-intro-routes.mjs` | SUPPORT | 현행 트리 참조 0건. 생성물(`basicIntroHubSeeds`)은 커밋됨 — 재생성기 | 중간 — 좌표의 유일한 출처라고 문서가 선언 | 유지 (재생성 전용) |

## 3. `package.json` ×3

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| 루트 `package.json` | CONFIG | dependencies·devDependencies **전무**. `firebase-tools` 를 선언 없이 호출(전역 설치 전제) | **높음** — 새 클론에서 배포 불가·버전 고정 없음 | 검토 필요 |
| 루트 `deploy:course-activity-functions` | LEGACY/깨짐 | 존재하지 않는 함수명 2개 지정 (§1) | **높음** | 검토 필요 |
| 루트 `deploy:publication-presence` | LEGACY/깨짐 | 동일 함수명 2개 + hosting/rules 를 한 스크립트에 묶음 | **높음** | 검토 필요 |
| 루트 `scripts.test` | DEAD | `echo "Error: no test specified" && exit 1` | 낮음 | 검토 필요 |
| 루트 `admin:*` (13개) | DUPLICATE | `functions/package.json` 28개 중 13개만 프록시. 정본 불명 | 중간 | 통합 후보 |
| `apps/web` `scripts` | CONFIG | **62개**. `test:e2e:*` 37 + `test:*` 12. `test:next-ride` 한 줄에 스펙 29개 나열 | 중간 | 검토 필요 |
| `apps/web` `devDependencies.three` | **오분류** | `preservedRiderLayer.ts`·`preservedRiderRig.ts` 가 `from "three"` → `MapView.tsx`·`RiderLightLabPanel.tsx` 가 사용하는 **프로덕션 경로** | **높음** — `npm ci --omit=dev` 빌드 붕괴 | 검토 필요 (dependencies 이동) |
| `apps/web` `devDependencies.playwright` | ACTIVE | `@playwright/test` 와 별개로 bare `from "playwright"` 를 스크립트 10+ 파일이 사용 | 낮음 | 유지 |
| `apps/web` deps (firebase·mapbox-gl·mapillary-js·react·react-dom) | ACTIVE | 각각 871·64·30·다수 참조 | — | 유지 |
| `apps/web` devDeps (@eslint/js·globals·eslint-plugin-react-hooks·react-refresh·typescript-eslint) | ACTIVE | `eslint.config.js` 에서 전부 import | 낮음 | 유지 |
| `apps/web` `@types/web-bluetooth` | ACTIVE | `useBleCrankRpm.ts`·`bleAutoReconnect.ts` | 낮음 | 유지 |
| `apps/web` `@types/node` | UNKNOWN | 타입 전용. `*.mjs`·`playwright.config.ts` 가 필요로 함이 거의 확실하나 grep 증명 불가 | 낮음 | 유지 |
| `functions` deps (firebase-admin·firebase-functions·stripe) | ACTIVE | stripe → `subscriptionCore/Http`·`stripeWebhookHttp` 4파일 | 높음 | 유지 |
| `functions` `@types/express` | ACTIVE | `import type { Request, Response }` 5+ 파일 | 낮음 | 유지 |
| **TypeScript 버전 불일치** | CONFIG | `apps/web` `~6.0.2` vs `functions` `~5.9.3` | 중간 — 두 워크스페이스가 다른 컴파일러 | 검토 필요 |

**미사용 dependency: 0건.** 리스크는 「미사용」이 아니라 **`three` 의 dev/prod 오분류**와 **`firebase-tools` 미선언**이다.

## 4. 빌드·배포 설정

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `firebase.json` | CONFIG | hosting·firestore·database·functions·emulators. 캐시 헤더 2단 | 높음 | 유지 |
| `firebase.harness.json` | CONFIG/DUPLICATE | `firebase.json` 과 rules·indexes·database·emulators 포트가 **글자 그대로 중복**. 다른 건 functions source 경로뿐 | **높음** — 한쪽만 바뀌면 하네스가 조용히 어긋난다 | 통합 후보 |
| `firestore.rules` (512줄) | ACTIVE | 24개 컬렉션 match. `rooms`·`worldActivity`·`pioneerChunks`·`livePresence` 는 마이그레이션 완료 컬렉션 — 규칙만 잔존 가능 | 중간 | 검토 필요 |
| `firestore.indexes.json` | CONFIG | 복합 인덱스 22개. 마지막 수정 2026-06-21 — 3개월간 신규 쿼리 대비 미갱신 | 중간 | 검토 필요 |
| `database.rules.json` | ACTIVE | `trails/$trailId/motion/$uid` 하나. peer-sync 패킷 스키마(`p,d,v,ph,t`)를 `.validate` 에 하드코딩 | **높음** — `peerMotion` 필드 변경 시 동시 수정 필요, 코드와 연결 고리 없음 | 검토 필요 |
| `apps/web/vite.config.ts` | ACTIVE | `optimizeDeps.entries: ["index.html"]`. 포트 5000/5002 분기 | 중간 | 유지 |
| `apps/web/tsconfig*.json` ×3 | CONFIG | 표준 vite 3분할 | 낮음 | 유지 |
| `apps/web/playwright.config.ts` | CONFIG | `.env`/`.env.emulator` 토큰 재주입, `FIRESTORE_EMULATOR_HOST` 로 `RIDE_VERIFY_LIVE=1` 자동 설정. 포트 5000/5002 가 `vite.config.ts` 와 **각각 따로 계산됨** | **높음** | 통합 후보 |
| `githooks/pre-commit` | SUPPORT | 스테이징 JS/TS eslint. **`functions/` 는 설정 없어 영구 스킵** | 중간 — functions 106 파일 lint 무방비 | 검토 필요 |
| `githooks/pre-push` | SUPPORT | `tsc --noEmit` 양쪽. `core.hooksPath` 수동 활성화 전제 | 중간 | 유지 |
| `.firebaserc` | CONFIG | `boxcycle-dc2df`. 같은 ID 가 `apps/web/package.json`(30+회)·e2e 3개·스크립트 2개에 하드코딩 | 중간 | 통합 후보 |
| `asia-northeast3` 리전 | DUPLICATE | `functions/src` 19파일 + `app/env.ts`·`functionsEmulatorUrl.ts`·`vite-env.d.ts` + `.env.harness` — 총 36곳 | 중간 | 검토 필요 |

## 5. 환경변수 (`apps/web/.env*` — 키 이름·용도만)

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `apps/web/.env` | CONFIG(비추적) | Firebase 6키 + `VITE_MAPBOX_ACCESS_TOKEN` + `VITE_FIREBASE_DATABASE_URL` + `VITE_MAP_DEBUG_SKIP_LOD` + `VITE_RIDER_PROTOTYPE` | 높음 — 로컬에만 존재 | 유지 |
| `apps/web/.env.local` | CONFIG(비추적) | `VITE_MAPILLARY_CLIENT_TOKEN`·`VITE_SHOW_ACTIVITY_LOD_DEBUG`·`VITE_RIDER_PROTOTYPE` | 중간 — **`VITE_RIDER_PROTOTYPE` 가 `.env` 와 중복 정의**되어 `.env.local` 이 조용히 이긴다 | 검토 필요 |
| `apps/web/.env.emulator` | CONFIG | `VITE_USE_EMULATOR`·`VITE_FUNCTIONS_EMULATOR_HOST` + Firebase 6키(중복) + fake Mapbox 토큰 | **높음** — Firebase 6키가 3곳 중복 | 통합 후보 |
| `apps/web/.env.harness` | CONFIG | `VITE_USE_EMULATOR`·`VITE_FUNCTIONS_EMULATOR_HOST`·`VITE_FUNCTIONS_REGION` + Firebase 6키(또 중복) | 높음 | 통합 후보 |
| `apps/web/.env.example` | CONFIG | 19키 문서화 — 실제 4개 env 의 합집합 + 4개 추가 | 낮음 | 유지 (example 이 SoT, 좋음) |

> 값은 하나도 기록하지 않았다.

## 6. 테스트

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `apps/web/e2e/` 48파일 (스펙 45 + 헬퍼 3) | TEST | 헬퍼 `mapbox-stub.ts`(10)·`open-meteo-stub.ts`(43)·`readGuestUid.ts`(14) 활발 | — | 유지 |
| `route-dock-riding-content.spec.ts` | TEST/깨짐 의심 | 09-19 고정. `RouteDock.tsx/.css` 가 09-24 `cbfb0bf` 에서 변경 | **높음** | 검토 필요 |
| `ride-hierarchy-narrow.spec.ts` | TEST/깨짐 의심 | 09-19 고정. `MapHud.tsx`·`App.tsx` 09-24 변경(QC1 4단·lightlab) | **높음** | 검토 필요 |
| `menu-declutter-a.spec.ts` | TEST/깨짐 의심 | 09-19 고정. `App.tsx` 에 `RiderLightLabPanel` 추가 | 높음 | 검토 필요 |
| `ride-summary-compact.spec.ts` | TEST/깨짐 의심 | 09-19 고정, 표고 프로필 UI 가 09-24 에 3회 변경 | **높음** | 검토 필요 |
| `h1-hud-companion.spec.ts` | TEST/방치 | 09-19 고정 + npm 스크립트 없음 + `H1_LIVE=1` 별도 게이트 | 중간 | 검토 필요 |
| `autoroute-fitbounds-5a`·`autoroute-overlap-5a-measure`·`camera-angle-real`·`camera-angle-real-p85`·`conquest-lod-shots`·`open-meteo-stub-guard`·`route-token-ui-force-fail`·`route-token-ui-smoke`·`s42-read`·`smoke` | TEST/방치 | 37개 `test:e2e:*` 어디에도 없음 — 전체 실행으로만 걸린다 | 중간 — 전체 실행은 `globalTimeout 560s`·`workers:1` 로 비현실적 | 검토 필요 |
| `test.skip(!LIVE)` 27개 스펙 | TEST | 에뮬레이터 없이는 전부 skip. CI 없음 | **높음** — 「녹색」이 곧 「안 돌았다」일 수 있다 | 검토 필요 |
| `apps/web/scripts/**/*.test.ts(.mjs)` 57개 | TEST | `test:next-ride`(29 스펙) 등 계약 테스트. `--experimental-strip-types` 의존 | 중간 | 유지 |
| `functions` 테스트 | TEST | `distanceAutoRouteCore.test.ts` **단 1개** / 106 파일 | **높음** | 검토 필요 |

## 7. 문서 (`document/` — .md 359개)

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `document/README.md` | ACTIVE | 살아있는 문서 색인, 91개 항목 | 높음 | 유지 |
| `document/260919-RTW-라이더-GLB-교체-작업계획.md` | UNKNOWN | 톱레벨인데 **README 색인에 없음**. 자매 문서 2개는 색인됨 | 낮음 | 검토 필요 |
| `document/출시 전 확인사항.md` | 불일치 | README 가 `출시%20전%20확인사항.md` 로 **URL 인코딩된 채** 링크 → 파일 해석 실패. `YYMMDD-` 규칙 위반(유일) | 낮음 | 검토 필요 |
| `document/archive/` 73개 | LEGACY(의도적) | README §4 규칙대로 운영 | 낮음 | 유지 |
| `document/ops/` 261개 .md, 13개 릴레이 폴더 | SUPPORT | README 보유 5개. `cyclefit-relay`·`giant-relay`·`map-relay`·`ride-relay`·`rider-replace`·`route-relay`·`sensor-relay`·`sync-relay` 8개는 README·색인 모두 없음 | 중간 — 완료 릴레이가 ops 에 적체 | 검토 필요 |
| `document/config-*.seed.json` 3개 | CONFIG | `routeTokenEconomy`·`subscription`·`tierQuotas` seed. 런타임 Firestore `config/*` 와 **수동 동기화** — 코드가 읽지 않음 | **높음** — 조용한 드리프트 | 검토 필요 |
| 루트 `README.md`·`AGENTS.md`·`CLAUDE.md`·`260810-BOXCYCLE_ADVISOR_PROTOCOL.md` | ACTIVE | 역할 경계가 문서로 명시되어 있지 않음 | 중간 | 검토 필요 |

## 8. 임시·실험 산출물

| File | Classification | Reason | Dependency Risk | Action |
|---|---|---|---|---|
| `./0` (0바이트, 루트) | DEAD | 2026-09-20 생성, 빈 파일. `.gitignore` 에 없어 `git status` 에 노출 → 실수 커밋 위험 | 낮음 | 삭제 후보 |
| `./debug.log` (769B) | DEAD | 2026-09-04 이후 방치 | 낮음 | 삭제 후보 |
| `./firestore-debug.log` (172KB) | DEAD | 에뮬레이터 부산물 | 낮음 | 삭제 후보 |
| `tmp/rider-shape-preserving/` (**207MB**) | EXPERIMENTAL/잔재 | **실제 git worktree** (브랜치 `codex/rider-shape-preserving` @ `d386b78`). `tmp/` ignore 되지만 worktree 메타가 `.git/worktrees` 에 등록됨 | 중간 — `rm -rf` 시 메타 고아화, `git worktree remove` 필요 | 검토 필요 |
| `apps/web/scripts/rider-cycle-fit/.out/` (**263MB**) | EXPERIMENTAL | 후보 GLB·스냅샷. ignore 됨. 내부에 저장소 전체 스냅샷까지 포함 | 낮음 | 삭제 후보 (용량) |
| `apps/web/.out/` (13MB) | EXPERIMENTAL | e2e 캡처. ignore 됨 | 낮음 | 삭제 후보 |
| `blender/rider-cycle-fit/` (276KB, **추적됨**) | SUPPORT | Blender 파이썬 20+ 스크립트. rider-cycle-fit 스킬이 참조 | 중간 | 유지 |
| `.playwright-mcp/` | EXPERIMENTAL | MCP 브라우저 부산물. **`.gitignore` 에 없음** | 낮음 | 검토 필요 (ignore 추가) |
| `.firebase/hosting.*.cache` | SUPPORT | 배포 캐시, ignore 됨 | 낮음 | 유지 |
| `apps/web/scripts/build-rider-candidate.mjs` | UNKNOWN | `package.json` 참조 0건. 자매 `generate-rider-prototype-glb.mjs` 는 `gen:rider-glb` 로 노출 | 낮음 | 검토 필요 |
| `apps/web/scripts/{ride-verify,rider-preview,rider-cycle-fit,rider-preserve,hud-companion,basic-routes-verify}/` | SUPPORT | `package.json` 미참조이나 `.claude/skills/*/SKILL.md` 가 직접 호출 지시 | 중간 — 정적 grep 으로 안 잡힌다 | 유지 |

---

## 가장 위험한 것 5

1. **`deploy:course-activity-functions`·`deploy:publication-presence` 가 존재하지 않는 함수를 배포한다.** `index.ts` 는 `routeActivity*` 만 export 하는데 스크립트는 `courseActivity*` 지정 → 운영 반영이 조용히 누락.
2. **`three` 가 devDependencies 인데 프로덕션 렌더 경로의 런타임 의존이다.** dev 의존 제외 설치에서 빌드가 깨진다.
3. **`firebase.harness.json` 이 `firebase.json` 의 포트·rules 를 통째로 복제한다.** 한쪽만 고치면 하네스가 다른 세계를 본다.
4. **`database.rules.json` 의 `.validate` 가 peer-sync 패킷 스키마(`p,d,v,ph,t`)를 하드코딩한다.** 코드-규칙 간 연결 고리(테스트·타입)가 없다.
5. **09-24 UI 변경 후 09-19 에 멈춘 e2e 4건 + npm 스크립트 미등록 12건 + 기본 skip 27건.** 실질 커버리지는 「돌려본 5개」뿐이며 functions 단위 테스트는 1개다.

## 가장 쉬운 정비 5

1. **루트 `./0`·`debug.log`·`firestore-debug.log` 삭제** — 전부 0참조 부산물.
2. **`courseActivity{AggregateCore,HeatReconcile,OnRideCreated}.ts` 3개 삭제** — 각 2줄 `@deprecated` alias, 참조 0건. (나머지 2개는 위험 1번과 함께)
3. **`document/README.md` 의 `출시%20…` 링크 수정 + `260919-…작업계획.md` 색인 등재** — 문서 불일치 전량이 이 2줄.
4. **`.gitignore` 에 `.playwright-mcp/` 추가.**
5. **`apps/web/.out/` + `rider-cycle-fit/.out/` 정리 (276MB)** — 재생성 가능. `tmp/rider-shape-preserving`(207MB)는 `git worktree remove` 필요하므로 별건.
