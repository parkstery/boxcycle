# read 절감 1차 — 시험 격리·도로망 초기 중복 조회

2026-11-19, Codex 직접 구현·검증. Chief 「대책 우선 순위 높은 것부터 진행」에 따라 1번과 2번의 좁은 첫 단계를 적용했다. 상태 **LOCAL_VERIFIED / 미커밋·미배포**. 운영 데이터 쓰기·삭제·Rules/Functions 배포 없음. 기존 다른 작업 변경 보존.

## 변경과 범위

### 1. Playwright 운영 Firebase 연결 차단

- `apps/web/e2eIsolation.ts`: config 로드 때 Auth 9099·Firestore 8080·RTDB 9000의 loopback host를 모두 검사한다. 누락·원격 주소·SDK 배선과 다른 포트면 **spec import 전 중단**한다. Functions host가 주어졌으면 5001 loopback인지도 확인한다.
- 브라우저에는 emulator=true·가짜 API key·로컬 DB/Functions URL을 명시 주입한다. 셸의 VITE_*나 운영 `.env`가 이를 덮지 못한다. 프로젝트는 emulators:exec의 GCLOUD_PROJECT를 따르며, 기존 seed 호환을 위해 일반 래퍼의 `boxcycle-dc2df` 프로젝트명은 유지한다. 이름이 같아도 실제 서비스 목적지는 loopback이다. demo 하네스는 기존 demo 프로젝트를 그대로 사용한다.
- globalSetup은 필수 로컬 포트의 가용성을 확인하고, 내려가 있으면 브라우저 실행 전 중단한다. 서비스별 HTTP 기능 진단은 아니며 연결 실패 시 운영 폴백을 하지 않는 것이 목적이다.
- `playwright.config.ts`: Vite를 항상 별도 emulator/harness 모드로 실행한다. 기본 5002, 기존 개발 서버 재사용 금지. RTW_DEV_PORT 사용자 지정과 demo 하네스의 5010은 유지한다.
- `vite.config.ts`: **시험 서버에서만** CSP connect-src를 적용한다. 로컬 HTTP/WS·Mapbox·Open-Meteo만 허용하므로 운영 Firestore/Auth/Storage/Functions/Cloud Run·양 지역 RTDB의 HTTP/WS가 차단된다. 일반 개발 서버·제품 빌드에는 적용하지 않는다.
- `package.json`: 기본 test:e2e·UI·smoke·stub-guard도 기존 에뮬레이터 래퍼로 실행한다. 일반 시험은 600초 watchdog을 유지하며 UI 모드는 기존 인터랙티브 용도다.
- 기존 Route Token demo 하네스도 RTDB를 함께 시작하도록 `scripts/route-token/firebase-exec.mjs`를 보완했다. `scripts/emulatorPorts.mjs`의 잔류 포트 검사에 DB를 포함했다. 직접 Playwright를 부르는 모든 래퍼는 Auth/Firestore/RTDB를 실행해야 한다.

이 범위는 **공유 Playwright config를 쓰는 시험**이다. 별도의 Node 스크립트·자체 Vite fixture·수동 자동화 전체를 일괄 격리한 것으로 표현하지 않는다. Functions가 사용하는 다른 외부 서비스까지 격리한 장치도 아니다. 이번 시험은 로컬 Auth/Firestore/RTDB/Functions를 썼으며 지도/경로 외부 호출은 기존 계약이다. 운영 문서 read 절감률은 아직 계측하지 않았다.

### 2. 내 도로망 초기 중복 요청 제거

- `hooks/useConquest.ts`: uid가 생긴 직후 가상의 totalMeters=0으로 전체 조회를 먼저 시작하지 않는다. 해당 uid의 요약이 준비된 뒤 시작한다.
- `lib/conquest/repo/firestoreConquest.ts`: summary callback에 fromCache를 전달하고 metadata 변경도 받는다. 로컬 캐시가 비었다는 응답은 서버에서 요약 문서가 없다고 확인한 응답과 구분한다. 캐시 없음→실제 요약의 초기 중복을 막고, 서버에 summary가 없는 Guest/고아 데이터는 기존처럼 chunks/traces로 복원한다.
- 동일 훅 인스턴스의 **같은 uid·totalMeters로 진행 중인** 두 조회는 Promise를 공유한다. 새 누적 거리에는 새 요청을 만들며, 이전 버전·이전 계정 응답은 적용하지 않는다. 지속 캐시나 성공 결과의 무기한 재사용을 추가하지 않았다.

줄어드는 것은 불필요한 초기 전체 조회 한 세트다. 조사 당시 A 계정 기준 세트당 chunks 69+traces 342=411문서다. **411 read가 매번 추가 청구됐거나 운영 비용이 50% 감소했다고 단정하지 않는다.** SDK 중첩 처리와 청구는 별도다. 이력 갱신 후/재방문 시 전체 조회 한 세트가 드는 문제는 남는다.

요약의 실제 누적 값 변화·새 도로 표시·기존 도로망 전체 표시를 유지했다. 데이터 삭제·조회 limit으로 오래된 도로 숨기기·서버 집계 방식 변경 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | 결과 |
|---|---|
| `npm.cmd run test:e2e -- smoke firebase-isolation ride-entry --workers=1 --retries=0` | **10 PASS / 0 FAIL / 1 SKIP**, Playwright 4.2분·래퍼 310초. SKIP은 ROUTE_TOKEN_UI_LIVE 조건부 전용 시험. Auth/Firestore/RTDB/Functions 로컬 실행·종료 완료 |
| `node scripts/test-quick.mjs` | **1584 PASS / 0 FAIL**, 108초. 후속 캐시 metadata 보강·demo 포트 case 추가 전의 전체 회귀 |
| 아래 최종 focused 명령 | **33 PASS / 0 FAIL**, 실제 React 훅/계정 화면·도로망 로직·최종 cache 보강·emulator config/demo 포트 포함 |
| `node ../../node_modules/typescript/bin/tsc -b --pretty false` | PASS, 최종 metadata 보강 포함 |
| 변경 파일 ESLint | PASS, 오류/경고 0 |
| `node ../../node_modules/vite/bin/vite.js build` | PASS, 최종 metadata 보강 포함. 기존 500KB chunk 경고 |
| `node scripts/ride-verify/verify-selectors.mjs` | **21 PASS** |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS, 미지정/순환/방향 위반 0 |
| 루트 `node scripts/check-dev-tools.mjs --check` | PASS, 기존 temporary 만료 WARN 8 |
| `node ../../node_modules/@playwright/test/cli.js test smoke --list` (emulator env 없음) | **의도된 exit 1**, config 단계의 isolation 오류. 시험 파일/브라우저 실행 전에 차단 |
| 로컬 host env만 설정하고 globalSetup 호출(에뮬레이터 종료 상태) | **예상 거부 확인 PASS**, Emulator unavailable. 원격 호출 없음 |

CSP 시험은 운영 서비스 8개 호스트의 HTTP fetch와 RTDB WebSocket을 실제 브라우저 보안 정책이 거부하는지 확인한다. HTTP 우회 시 원격으로 내보내지 않도록 시험 라우트도 abort하고 유출 카운터 0을 검사한다. 같은 페이지의 로컬 fetch는 성공해야 한다. 기존 게스트→입문→주행 running 시험도 통과했다.

실제 hook 시험은 저장소 경계만 mock하고 React StrictMode·제품 hook을 실행한다. 요약 대기/빈 로컬 캐시 동안 조회 0, 실제 요약 후 cells/traces 각 1회, pending 재연결 공유, 새 거리 변경 시 재조회, 늦은 이전 버전·이전 uid 결과 무시, summary 없는 B의 도로망 복원을 검증한다.

추가 focused 명령의 첫 파일 수집에서는 emulator 전용 Rules 시험까지 잘못 포함해 **25 PASS / 1 FAIL**했다. 실패 원인은 해당 시험의 `emulator only` 선행 조건이며 제품 회귀가 아니다. emulator 파일을 제외한 올바른 명령으로 최종 33/0을 확인했다. `check-dev-tools` 첫 호출도 옵션 누락으로 사용법을 출력했고, `--check` 재실행 결과는 위와 같다.

로그: `apps/web/.out/read-reduction-quick.log`, `read-reduction-build.log`. e2e 기본 HTML/결과는 `playwright-report`·`test-results`(다음 실행에 갱신되는 로컬 산출물). 별도 Route Token 전체 하네스·운영 실주행·운영 billed read 전후 측정은 미실행이다.

## 남은 순서

1. **개인 도로망 변경분 동기화 설계**: totalMeters만으로 캐시의 수정/삭제 유효성을 보장할 수 없다. 서버 변경 버전, uid별 저장, 삭제/수정 표식 또는 정본 재동기화, 캐시 유실/다중 기기 복구를 정한 뒤 영속 캐시를 구현한다. 이번 in-flight 공유를 persistent cache로 오인하지 않는다.
2. **게스트 정리 약 3,300/일 개선**: 기존 guestLifecycle에 lastActivityAtMs/observedAtMs·status·재시도·등록 보호가 있으므로 이를 만료 후보 조회의 근거로 삼을 수 있다. Auth에 없는 고아 데이터는 이 목록만으로 발견할 수 없어 별도 전체 감사/커서 예산이 필요하다. `scanned=13`을 읽기 예산으로 쓰지 않는다. 30일 비활동/최초 발견 유예·최근 활동 재확인·실패 재시도·탈퇴/등록 경합을 보존하는 후보 인덱스/감사 실행 계약을 먼저 고정한다. 현재 일일 정리 정책을 끄거나 삭제/보호 규칙을 변경하지 않았다.
3. 다인 주행은 `10-multi-rider-relay-design.md`의 품질·복구·총비용 비교와 Chief 결정 항목을 이어간다. 개인 재조회 절감과 섞어 RTDB/Firestore 폴백을 바꾸지 않는다.

## 재실행

운영 사이트 접속 없이 아래 순서로 검증한다. 실행 위치를 명시한다.

```powershell
cd C:\20.HDev\boxcycle\apps\web
$conquestReadTests = @(rg --files scripts/conquest | Where-Object { $_ -match '\.test\.(ts|mjs)$' -and $_ -notmatch '\.emulator\.' })
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test @conquestReadTests scripts/e2e/firebase-isolation.test.ts scripts/e2e/dev-port-agreement-contract.test.ts
npm.cmd run test:e2e -- smoke firebase-isolation ride-entry --workers=1 --retries=0
```

앞 명령은 순수/fixture 시험, 뒤 명령은 에뮬레이터와 별도 로컬 앱을 자동 실행·종료한다. 평상시 개발 앱 `http://127.0.0.1:5000`은 그대로 유지한다. **이번 변경은 아직 운영 Hosting에 반영되지 않았다.**
