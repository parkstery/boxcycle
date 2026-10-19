# 결과08 — 위치 차단 시에도 두 시작 위치 선택

2026-10-17. Developer OpenCode GLM-5.3(등록 ID `opencode/glm-5.3-flash-free`, OpenCode CLI 세션 — 지시08의 Chief 도구 지정 우선). Supervisor Codex. subagent·commit·push·deploy 미사용. 한국어 보고.

## 시작 상태

| 항목 | 값 |
|---|---|
| branch | `main2` |
| HEAD | `c7982765d411145e323baa446b5deac015df5123` (docs(ops): 첫 진입 위치 선택을 운영 호스팅에 배포했다고 적는다) |
| tracked dirty | `apps/web/scripts/identity/entry-location.test.ts` · `apps/web/src/lib/geo/entryLocation.ts` · `document/ops/20261017-entry-location/README.md` · `document/ops/PROGRESS.md` · `document/ops/README.md` |
| untracked dirty | `apps/web/scripts/map/entry-location-camera.test.mjs` · `02-task-07.md` · `02-task-08.md` · `03-result-07.md` · `04-review-07.md` |

기존 tracked/untracked dirty 전부 보존했다. 지시07의 dirty 제품 수정(지연 승인 교정) 그대로 위에 지시08 수정을 얹었고, ops 문서 dirty도 만지지 않았다. 지시07의 카메라 시험(`entry-location-camera.test.mjs`, untracked)은 소스를 바꾸지 않고 회귀 시험군에 그대로 포함해 통과를 확인했다.

## 확정 동작과 변경

요구: 위치 차단(choice/denied)에도 활성 버튼 두 개 — **내 위치 근처에서 시작**, **앱 기본 위치에서 시작**(기본 위치는 기존 콜로세움). 질문 제목 「어디에서 시작할까요?」 유지. 차단 설명은 브라우저 설정에서 허용한 뒤 내 위치 근처 버튼으로 다시 시도할 수 있다고 간결히 안내.

- `src/components/auth/EntryLocationDialog.tsx` — 차단(choice/denied)에서도 두 버튼이 모두 렌더된다(기존에는 현재 위치 버튼을 숨겼다). 라벨을 지시 문구대로 변경: `내 위치 근처에서 시작` · `앱 기본 위치에서 시작`. 차단 설명 문구를 갱신: "위치 공유가 차단되어 있습니다. 브라우저 설정에서 위치를 허용한 뒤 「내 위치 근처에서 시작」을 다시 시도할 수 있습니다." ready 안내는 기존처럼 App notice 가 담당한다.
- `src/lib/geo/entryLocation.ts` —
  - `chooseCurrent`: denied에서도 허용. 클릭 한 번당 위치 요청 한 번. 브라우저 설정에서 허용한 뒤 같은 버튼을 누르면 ready 가 된다. 권한 우회(permissions 재조회로 자동 granted 확정)·자동 반복 요청 없음.
  - `startLocate`의 denied 클릭 시작은 지시07과 동일하게 권한 선택 시간에 자체 8초 watchdog 을 걸지 않는다(unknown 방식 — watchdog 은 기승인 granted 요청에만 존재).
  - 위치 요청이 denied 오류로 끝나면 이전처럼 ready(콜로세움)로 확정하지 않고 **choice/denied/target null, notice null** 로 돌아와 같은 두 버튼을 유지한다. `retire(gen)` 로 generation 을 끊어 거절 뒤 늦은 성공 콜백도 차단한다(시험에서 확인). generation·타이머 정리·대기 중 중복 클릭 방지(locateGen 가드 + locating 중 두 번째 클릭 무시) 유지.
  - 거절이 더 이상 ready 로 가지 않으므로 `ENTRY_LOCATION_NOTICE.denied` 문구(“거절되어 콜로세움에서 시작합니다”)는 더 이상 사실이 아닌 설명이 되어 상수에서 제거했다. 콜로세움 확정은 명시 앱 기본 위치 버튼으로만 일어난다.
  - 기승인 정상·prompt/unknown 지연 승인·실패/timeout/invalid·미지원의 기존 동작 수정 없음.
- `scripts/identity/entry-location.test.ts` — denied 회귀를 새 요구에 맞춰 갱신(아래 검증 참고). 상수문구·라벨도 대화상자와 동기화. 지시07이 추가한 지연 승인 시험은 보존한 채, denied 경로를 그 루프에 합쳐 “denied 클릭 시 8초를 넘겨 기다려도 승인 응답을 살려 둔다”를 검증한다.
- `e2e/rideEntryHelpers.ts` — 공용 e2e helper 의 콜로세움 클릭 버튼 이름을 `앱 기본 위치에서 시작` 으로 반영. 진입 표면 판별(`readEntrySurface`)의 dialog 이름 「어디에서 시작할까요?」와 게스트 흐름은 불변이므로 `ride-entry.spec.ts` 는 helper 만 쓰고 소스 수정 없음.
- `scripts/ride-verify/entry-contract.mjs` — 위치 선택 단계를 `location-choice`로 ENTRY_STEPS **맨 앞에** 추가: 대화상자 role·제목, 두 버튼 라벨, 차단 설명, 클릭 연결 앵커 + App.tsx 연결(`phase`/`permission`/`onChooseRome`/`onChooseCurrent`) `also` 앵커. 셀렉터 계약은 e2e helper 와 같은 이름을 본다.

제품 식별자(`chooseRome` 등) rename· 저장/전송·별도 IP API·App 로직·지도 카메라 변경 없음. App.tsx는 소스 수정 없이 계약 앵커만 검사했다.

새 디버그 도구·스크립트를 만들지 않았으므로 `dev-tools.json` 등록 사항 없음.

## 검증 — 명령 · exit · 결과

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 브라우저·서버 시작 금지(지시 4)를 지켜 기존 컴포넌트 렌더·동작 시험으로만 확인했다.

| 명령 | exit | 결과 |
|---|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 19단계 전부 유효 — 새 `location-choice` 단계 포함 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` | 0 | PASS 29 / FAIL 0 (이전 27 → +2) |
| `npx.cmd eslint src/components/auth/EntryLocationDialog.tsx src/lib/geo/entryLocation.ts scripts/identity/entry-location.test.ts e2e/rideEntryHelpers.ts scripts/ride-verify/entry-contract.mjs` | 0 | 오류·경고 없음 |
| `npm.cmd run build` | 0 | tsc·Vite PASS — 큰 청크 3,698.89 kB 및 SADDLE/PELVIS 경고는 이전 빌드와 동일한 기존 경고(이번 변경 무관) |
| `git diff --check` | 0 | PASS |

denied 회귀 시험이 지시의 (1)~(5) 항목을 각각 커버한다:

1. **차단 상태 양 버튼 표시/콜백** — “대화상자는 idle·ready 에서 비우고 …”: denied html 에 두 라벨·primary 모두 존재, `buttonsOf` 로 두 버튼 수집해 콜백 호출까지 검증.
2. **denied→명시 내 위치→다시 denied에도 선택 유지** — “denied 차단 화면은 choice 유지이고 클릭 한 번당 위치를 요청한다”: 요청 1회→거절→choice/denied/target null 복귀→늦은 성공 무시→재클릭 시 또 1 요청(사용자 클릭당 1회).
3. **허용 후 재시도→한국 좌표** — “denied 허용 뒤 같은 버튼 재시도는 한국 좌표로 ready 를 유지한다”: 거절 재시도 후 choice 유지→같은 버튼 1클릭→ready, target `126.978, 37.5665`.
4. **명시 기본 위치 확정** — “denied 에서 명시 앱 기본 위치 확정은 콜로세움 ready 를 유지한다”: 콜로세움 ready 후 추가 요청 없음, 재선택해 target 동일.
5. **대기중 취소 회귀** — 기존 “콜로세움 선택은 진행 중 조회·위치를 취소하고 늦은 콜백을 무시한다” 유지 통과. 또한 “권한 선택을 8초 넘게 기다려도 …” 를 prompt/unknown/**denied** 세 권한으로 확장해 지시07의 자체 타이머 미적용(unknown 방식 시작)도 회귀 고정했다.

거절 시험은 실제 거절 오류가 나오기 전 권한 조회 상태뿐 아니라 위치 요청 오류 콜백(`denied`, code 1)까지 포함하도록 두 갈래로 분리해 두었다.

## 한계

- **실기기·실제 브라우저 권한 창 미실행** — 지시 4로 서버·브라우저를 시작하지 않았다. 승인 후 재시도 시나리오는 fake env 시험 수준의 확인일 뿐, 실제 브라우저에서 거절 설정 해제→재클릭→성공 흐름을 검증한 것이 아니다. 스마트폰(HTTPS 운영 또는 승인된 HTTPS 미리보기 반영 후) 검증이 남아 있다.
- **범위 밖 미반영(보고만)** — `scripts/perf/run-real-gpu.mjs` 가 옛 라벨 「콜로세움에서 시작」을 클릭한다(2행). 소유 목록 밖이라 건드리지 않았다. 라벨을 바꾼 뒤 이 perf 스크립트를 돌리면 클릭이 실종되어 실패한다 — 후속 반영 필요. `document/ops/README.md` 등 ops 색인·기존 기록은 지시에 따라 수정하지 않았고, ops 문서의 dirty(Supervisor 기록)도 그대로 두었다.
- 운영 호스팅에는 배포하지 않았으므로 운영에는 이전 코드가 계속 서비스된다. 거절 문구의 ready notice 는 이후 배포판에서 사라지고 대화상자 본문 설명으로 옮겨 간다.

## Chief 확인 — 실행 경로와 명령

이번 단계는 서버·브라우저 시작 금지(지시 4)라 접속 주소가 없다. 컴포넌트·계약 시험으로 확인하는 순서:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node scripts/ride-verify/verify-selectors.mjs
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs
npm.cmd run build
```

확인 순서: ① 셀렉터 계약 19단계 PASS(맨 앞 `location-choice`) → ② 진입 지리 시험 29통과(차단 상태 denied 재시도·거절 뒤에도 선택 유지·콜로세움 명시 확정) → ③ 빌드 경고는 기존 경고만 있고 오류는 없는지 → ④ 실기기 거절/허용/허용 후 재시도 세 흐름 기기 검증은 운영 반영 후 별도 지시로 수행한다.
