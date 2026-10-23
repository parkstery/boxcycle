# 다음 수퍼바이저 인수 기록

2026-10-23 22:34 KST · 인계 Codex · **인수 Claude Code 2026-10-23 22:43 KST** (대조 결과는 HANDOFF 「다음 한 걸음」 0번). 사용자 요청에 따른 인계 정리만 수행했다. 제품 추가 수정·커밋·푸시·배포 없음.

## 먼저 읽을 것

1. `C:\20.HDev\boxcycle\AGENTS.md` 및 `document/ops/HANDOFF.md`
2. [전체 계획](README.md), [교대 플레이북](../../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)
3. [묶음1 감리](05-review-batch1.md), [묶음2 감리](10-review-batch2.md), [로그인 복구](11-login-environment-fix.md), [감리 보완](12-result-batch2-supervisor.md)
4. [작업 트리 스냅샷](handoff-worktree-20261023.txt). 실제 git status/diff와 대조하며, 자동 stage 목록으로 사용하지 않는다.

## 완료와 승인 경계

- 브랜치 main2, HEAD 5671a014. 이번 묶음1/2와 로그인 복구는 모두 미커밋·미푸시·미배포.
- 묶음1 MENU/경로 목록, 묶음2 지도 대기/주행/일시정지까지 로컬 구현·감리·캡처 완료. 실행 중인 Cursor/OpenCode 하위 작업 없음. 에뮬레이터도 최종 시험 후 정상 종료.
- **시안 16장 승인과 구현 화면 승인은 다르다.** 현재 구현 화면은 Chief 확인 대기. 마지막 요청은 인계 정리이며, 커밋·푸시·배포 또는 묶음3 착수 승인이 아니다.
- 다음 담당은 비교 화면과 감리 결과부터 확인한다. 피드백이 있으면 같은 묶음의 새 번호 재지시→결과→감리로 보완. 화면 승인 후 해당 작업만 선별 커밋/푸시, 배포는 별도 승인 필요.
- 후속 묶음3은 시안10 주행결과(주인공=새 도로), 11 다음주행. 시작 지시가 오면 다음 미사용 번호 지시서 작성→Cursor 구현→자체 감리→시안/실제 캡처 비교. 본 13번은 인계 기록이며 묶음3 지시서가 아니다.
- 별도 결정 대기: LocalFirstEntryCard 삭제, RideHistoryPanel 연결/삭제. 답 없이 변경하지 않는다. 관련 없는 작업을 멈출 필요는 없다.

## 검증 증거와 주의

- 묶음1 당시: 단위1353·서버169·실앱8 PASS, 화면17 PASS/기존 실패1.
- 묶음2 최종: 화면17+실앱1 **18/18 PASS**, 실제 주행진입 **7/7 PASS**, 로딩 후 캡처 재수집 **1/1 PASS**.
- 기본 단위1347 PASS 후 기존 계약을 복원/확장하여 센서13+새 코칭1 **14/14 별도 PASS**. 중복 합산해서 전체 시험 수로 보고하지 않는다. 다음 전체실행 시 현재 파일을 기준으로 수를 기록한다.
- tsc -b, 변경eslint(오류0/기존경고7), selectors19, tidy, dep-direction --check, doc-system, diff-check PASS. 함수169는 묶음1에서 실행; 묶음2는 functions 변경 없어 재실행 안 함.
- 로그: `evidence/batch2-review-final.log`(18), `batch2-live-final.log`(주행7 PASS+초기 캡처 셀렉터 실패1), `batch2-capture-final.log`(마지막 캡처1 PASS), `batch2-unit.log`. 초기 실패 기록은 지우지 않는다.
- **플레이북의 ui-800x360:84 기존 실패 허용 설명은 현재 작업 트리에서 해소됐다.** 시작버튼44/pause56 시안에 맞춰 동등 조작 검사를 고쳤고 최종17이 모두 통과했다. 새 실패를 옛 허용 실패로 넘기지 않는다.
- 미니맵 엔진·계기판 밀도·하단 시계 여백은 유지하여 시안과 차이가 있다. 가짜 센서 수치·고도·주소를 만들지 않았다. 코칭은 표시만 번역, TTS 정책 미변경.

## 보존할 것과 변경 범위

- 기존 dirty `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json` SHA256 **4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F**. 22:34 재확인. `.out/`, `cdbox.bat`도 기존 비추적. 수정·커밋·삭제 금지.
- 그 외 현재 스냅샷의 제품/시험/프리뷰/ops 변경은 이번 묶음1/2·로그인 복구 작업. 다른 담당의 추가 변경이 생기면 별도 대조. restore/clean/stash/worktree 생성/일괄 stage 금지.
- `apps/web/dep-layers.json` 변경은 신규 camera/coach 표시 파일의 기존 도메인 등재뿐. 허용 엣지·기준선 확대 없음.
- `entry-location-dom.test.mjs` 출력은 과거 ops 증거 대신 `test-results/entry-location-dom`(또는 RTW_ENTRY_LOCATION_EVIDENCE_DIR)으로 보냈다. 이를 되돌리면 기존 증거를 덮어쓴다.
- `vite.config.ts`의 harness 루트 안내는 로그인 서버 혼동 재발 방지다. harness 루트에서 정상 App을 띄우도록 되돌리지 않는다.

## 서버·실행자 상태

22:34 netstat 관측값이며 인수 시 재확인한다. PID로 무조건 종료하지 않는다.

| 포트 | PID | 용도 |
|---|---|---|
| 3000 | 28472 | Chief 다른 프로젝트, 보존 |
| 5000 | 61304 | 정상 앱, 운영 Firebase 연결 |
| 5020 | 33076 | harness 프리뷰, 로그인용 아님 |
| 5021 | 62692 | Chief가 띄운 harness, 보존 |
| 5017/9099 | 미청취 | 최종 시험 에뮬레이터 정상 종료 |

- 정상 URL **http://localhost:5000/**. Guest 복원 및 Google provider 계정선택 화면 도달까지 확인. Chief의 최종 Google 로그인 완료는 관측하지 않았으므로 완료했다고 보고하지 않는다.
- OpenCode DeepSeek/GLM 조사·기계작업 참여 후 공통 무료한도. MiMo도 같은 한도. 한도 회복 시 `opencode models`로 실제 ID 확인, 무료 조사/기계작업 활용. 비용 발생 모델로 임의 전환하지 않는다. UI 판단 구현은 Cursor가 수행했다.
- ego lite 실행돼 있지만 CLI bootstrap은 일반/권한 실행 모두 실패했다. TaskSpace 생성 확인 없음. Playwright로 검증 완료. 새 인수자는 상태가 바뀌었으면 ego를 시도할 수 있으나 동일 실패를 반복 대기하지 않는다.
- Cursor CLI 호출과 금지사항은 플레이북 §3. CLI 로그/설정 접근 또는 Firebase CLI config 읽기가 sandbox EPERM이면 권한 있는 실행이 필요할 수 있다. 무거운 시험/에뮬레이터는 순차·1worker.

## 직접 확인 및 재현

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
# 정상 서버가 없을 때만
$env:RTW_DEV_PORT='5000'
npm run dev -- --host 0.0.0.0 --strictPort
```

http://localhost:5000/ → 사용자 정보 → 회원 등록/로그인 → Google 계정 직접 선택.

프리뷰5020이 살아 있으면 바로 `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready` 를 연다. 시작→pause→resume→end, 센서/경로접기, 카메라6개 및1번 반복 확인. 서버가 없으면 별도 PowerShell:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

시안 비교 전체 경로:
- `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch1.html`
- `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch2.html`

실앱 검증이 새 변경으로 필요할 때만(정상 앱5000에 시험 쓰기 금지):

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5017'
$env:BATCH2_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence'
node scripts/e2e/run-with-deadline.mjs --limit-sec 600 -- node scripts/e2e/run-with-functions-emulator.mjs 'node ../../node_modules/@playwright/test/cli.js test ride-entry ui-800x360 ui-redesign-batch2 --workers=1 --retries=0'
```

전역 playwright는 다른 CLI이므로 위 로컬 CLI 경로를 쓴다. 필요한 권한이 있는 환경에서 실행하며, 5분 진전 없으면 프로세스/서버/포트/로그를 먼저 확인하고 검증 경로를 바꾼다.
