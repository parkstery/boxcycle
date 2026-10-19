# Task19 결과 — GLM18 감리 재작업(실제 검증 누락·잘못된 offline 기댓값)

- 수행: OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 2026-10-19
- 지시: [02-task-19.md](02-task-19.md) / 이전 결과: [03-result-18.md](03-result-18.md)
- 소유(변경한 파일만): `apps/web/e2e/guest-lifecycle.spec.ts`, `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts`
- 제품 파일·서버·Rules·Supervisor scripts·운영/private 접근 없음. 배포·커밋·푸시 없음.

## 지시 5건 수정 내용

1. **motionNodeAbsent가 무조건 true를 돌렸음** → RTDB REST 응답 JSON을 실제 검사해
   `json === null || json === undefined` 일 때만 부재로 판정한다. 응답을 버리고 true를 내놓는 계약 제거.
2. **offline 시험 기준 버그** → `afterCreated`(Guest 생성 후 snapshot)를 별도 저장하고
   offline 구간·복구 구간 모두 `addedCount(afterCreated, 현재) === 0`(증가 0)을 검사한다.
   생성 전 snapshot(`before`) 대비 전체 계정 1명 유지는 별도 assert로 남긴다. 이전의
   "생성 전 기준으로 0을 기대" 버그(기존 계정 1명이 있어 실패 추이를 풀어 낼 수 없는 구조)를 고쳤다.
3. **8초 soak는 5분 heartbeat 증명이 불가** → 삭제하고:
   - **실제 요청 카운터**: 페이지 `fetch`를 래핑해 `guestActivityHttp` POST만 센다(응답은 원래 fetch 그대로 통과 — SDK·네트워크 모킹 아님).
   - **page.clock**: 종료 유지 상태의 새 탭에서 `clock.install()` → 부팅 → 시작 메뉴 도달 → 부팅 구간 호출 0 poll →
     `fastForward(5분+30초)` 2회로 heartbeat 간격 2칸을 건너뛴다 → 실시간 안정 대기(2s+1.5s) 뒤
     요청 카운터 0 + 서버 기록 `lastActivityAtMs` 불변을 확정한다.
   - **샘플 non-null**: 종료 전 in-use 동안 활동 기록이 남아 있어야 함을 `not.toBeNull()`으로 강제한다.
   - 8초×2 soak 시간 16초 제거 — 종료 3회+새로고침·새 탭 전체를 시험 시간 안에서 수행.
4. **membershipDocPaths URL** → `documents:runQuery` 콜론 연결 함수(`runQueryUrl`)로 분리,
   기존 `docUrl(':runQuery')`(=`documents/:runQuery`) 오표기 제거. 이름 일치 재확인.
   **오류 문구에서 UID 제거**: `read/delete ${path}`, `trails/{trailId}/motion/{uid}` 문구 삭제 —
   fixture·motion 오류문구는 uid를 보간하지 않는다. assertion 비교값에 uid가 노출되던 2곳도 boolean 패턴으로 교체.
5. **guestStartFromMenu pending 확인** → `guestStart`는 poll에서 `pending`(연결 중…/로그인 중…)을 만나면
   gate/account 정착까지 계속 폴링한다(rideEntryHelpers 계약). 클릭 뒤 helper가 pending을 기다리는 것을
   헬퍼 주석으로 명시. 불필요 soak는 3번 항목에서 제거.

## 정적 시험 갱신 (계약 강화)

- `ACTIVITY_SOAK_MS` 부재 assert(8초 soak 금지), `clock.install()`/`fastForward(GUEST_HEARTBEAT_STEP_MS)`/
  `guestActivityHttp`/`guestActivityPosts` 카운터 존재, `lastActivityAtMs)이 문서에 남아 있어야 한다`(non-null 계약).
- runQuery는 `documents:runQuery` 존재 + `docUrl(':runQuery')` 오표기 부재.
- motion 부재는 `json === null || json === undefined` 실검사 존재.
- offline은 `생성 후 snapshot` 기준(`addedCount(afterCreated, await listLocalIds())`) 존재.
- uid 노출 금지: 문구 보간(`motion/${uid} 는`, `` `read ${path} ``) 부재 assert.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`)

```
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --test scripts/identity/guest-lifecycle-e2e-static.test.ts
npx playwright test guest-lifecycle.spec.ts --list
npm run build
npm run lint
npx tsc --ignoreConfig --noEmit --target es2023 --lib es2023,dom --module esnext --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax --skipLibCheck --types node,vite/client e2e/guest-lifecycle.spec.ts
```

| 명령 | exit | 결과 |
|---|---|---|
| 정적 시험 | 0 | 6 tests / 6 pass / 0 fail |
| `playwright --list` | 0 | Total: 4 tests in 1 file |
| `npm run build` (tsc -b + vite build) | 0 | 453 modules, 오류 0 |
| `npm run lint` | 0 | guest-lifecycle 2파일 지적 0 |
| 타깃 tsc (spec) | TS 오류 1건 — 소유 밖 기존 사안(아래) | 소유 2파일 자체 오류 0 |
| 타깃 tsc (정적 시험) | 0 | — |

**실제 e2e(에뮬레이터) 실행은 Supervisor 몫 — 미실행으로 명시.**

## 한계·보고 (실패·약화 숨기지 않음)

- 타깃 tsc가 `e2e/readGuestUid.ts:79` `uid as string` 변환 오류 1건을 보고한다. **소유 밖 공용 헬퍼의 기존 사안**,
  Task18/19에서 이 파일을 만지지 않았다. e2e는 tsc 빌드 범위(`tsconfig.app/node` include: src/vite.config) 밖이라
  repo 게이트에 영향이 없다 — 별도 수정 지시 후보로 Supervisor에 보고.
- clock 가속 설계 한계(spec 헬퍼 주석에도 명시):
  1) 종료 전에 시작된 같은 탭의 옛 interval 이 실시간 타이머로 살아남는 경우는 새 탭 부팅으로 닿지 않는다 —
  그 시나리오의 증명은 watch 정지 단위시험(제품 소유)의 몫이고 여기서는 **종료 뒤 새 접속**만 검증한다(과장 금지).
  2) 설치한 fake clock이 제품·에뮬레이터 SDK 복구 타이머와 충돌해 시작 메뉴에 못 도달하면 이 시험은 실패로
  보고된다(임의 관찰 단축·matcher 약화로 넘기지 않는다 — 지시의 "타이머 가속 충돌 시" 절을 여기 기록해 둔다).
- fastForward 뒤의 POST는 getIdToken→fetch 마이크로태스크로 늦게 도달할 수 있어 실시간 안정 대기(2s+1.5s)를
  기다린 뒤 확정한다. 파이프라인이 이보다 느린 비정상 상황은 카운터 0 관찰이 근사라고 명시해 둔다.
