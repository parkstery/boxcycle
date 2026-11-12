# 앱 건강 점검·리팩터링 지시서

작성 2026-11-10. 실행자 **Fable 5.2**. 대상 `C:\20.HDev\boxcycle` (Spinatlas·리포 boxcycle, 개발 base `main2`).
이 문서는 실행자에게 **그대로 전달하는 지시서**다. 세 단계(측정 → 감사 → 승인 후 실행)를 순서대로 하며, **1·2단계에서는 코드를 한 줄도 바꾸지 않는다.**

## 0. 먼저 읽을 것 (순서대로)

1. `AGENTS.md` — 작업 규칙·금지
2. `document/ops/HANDOFF.md` — 지금 상태·남은 일·알려진 실패
3. `document/reference/product/260714-RTW-Ontology.md` — UI·문서·식별자 용어
4. `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` — 손대면 안 되는 화면
5. `document/reference/operations/261027-RTW-에이전트-상세-작업-규칙.md`
6. `document/reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md` §3~§7 — 게이트 명령·환경 사실
7. `document/ops/20261022-code-tidy/01-plan.md` — 이전 정련 작업의 등급·우선순위 선례

읽은 뒤 결과 파일을 만들고 첫 줄에 `STARTED <시각> <모델·도구>`를 쓴다. 파일을 고칠 때마다 `DONE <파일> / NEXT <다음 파일·명령>` 한 줄을 남긴다. 한도·오류로 멈춰도 마지막 줄이 재개 지점이 된다.

## 1. 절대 규칙

- **1·2단계는 읽기 전용.** 산출물 문서만 만든다. `git status` 출력을 결과에 붙인다.
- 리팩터링은 **승인된 항목만, 한 번에 1건**. 승인 전 코드 수정 금지.
- **게이트를 약화시키지 않는다.** 아래는 전부 금지다: `apps/web/code-tidy.baseline.json` 숫자 올리기, eslint 규칙 끄기, `any`·`@ts-ignore` 추가, 시험 skip·삭제·timeout 늘리기, e2e retry 증가, dep-layers 예외 추가, 래칫 `--allow-increase`. 게이트가 막으면 코드를 고친다.
- **동작 변경과 구조 변경을 한 항목에 섞지 않는다.** 구조 변경은 동작 불변(behavior-preserving)이어야 한다.
- 금지: git commit/push/배포/`worktree`/`restore`/`clean`/`stash`/브랜치 전환, `functions/`·`firestore.rules`·`dep-layers.json`·Firestore 저장 형식 변경, 기존 식별자·Firestore 경로 일괄 rename, 디자인 고정 목록의 화면 변경, 의존성 업그레이드·패키지 교체, `.out/`·`cdbox.bat`·다른 에이전트의 미커밋 변경 건드리기, 포트 3000·3001 종료.
- HANDOFF·고정 목록·PROGRESS·묶음 README는 Supervisor 소유다. 수정하지 말고 "제안"으로 남긴다.
- 모델·도구 차이로 명령이 없으면 동등한 명령으로 대체하고, 무엇을 썼는지 결과에 적는다.

## 2. 단계

### A단계 — 기준선 측정 (코드 변경 0)

`C:\20.HDev\boxcycle`에서 실행하고 **숫자를 그대로** 적는다. 실패하면 실패한 그대로 적는다(고치지 않는다).

```powershell
cd C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src
npm run test:quick
npm run build
cd C:\20.HDev\boxcycle
node scripts/check-code-tidy.mjs --report
node scripts/check-dep-direction.mjs --check
node scripts/check-document-system.mjs
node scripts/check-firebase-accessors.mjs
cd C:\20.HDev\boxcycle\functions
npm test
```

- e2e는 비싸므로 **지금 돌리지 않는다.** HANDOFF·최근 ops 문서의 실패 목록을 「알려진 실패」로 옮기고 출처(파일:줄)를 밝힌다.
- 게이트가 `spawnSync ... EPERM`으로 죽으면 코드 문제가 아니라 실행 샌드박스가 자식 프로세스의 파이프 출력을 막은 것이다. 일반 셸에서 다시 돌리고 **두 결과를 구분해** 적는다.
- `apps/web/code-tidy.baseline.json`(기준선)과 현재 값이 다르면 차이를 적는다. 예: 기준선 App 3657줄 → 현재 3555줄.

### B단계 — 감사 (읽기 전용)

아래 10개 영역을 영역별로 훑고, 모든 발견에 `file:line` 근거와 재현·검증 명령을 붙인다. 영역이 크면 `01-audit.part-1.md`처럼 나눠 쓴다(한 번에 다 하다 한도로 죽지 않게).

| # | 영역 | 볼 것 | 측정 근거 |
|---|---|---|---|
| 1 | 타입 안전 | `any`·`as unknown as`·`@ts-ignore`·non-null 남용, 단언으로 숨긴 계약 | grep + tsc |
| 2 | 시험 안전망 | 시험 없는 위험 모듈(주행 저장·동기화·경로·지역·권한), 느리고 불안정한 시험 | `scripts/test-quick.mjs`, HANDOFF |
| 3 | 경계·의존 | dep-layers 위반·순환, `repo` 계층 침범, 컴포넌트의 firebase 직접 접근 | `check-dep-direction`, D1~D7 |
| 4 | 큰 파일·결합 | 1,200줄 초과, 500줄 넘는 컴포넌트·훅, 다중 책임, prop drilling | `check-code-tidy` largeFiles |
| 5 | 중복·죽은 코드 | 안 쓰는 export·타입·파일, 복붙 블록, 죽은 CSS·asset, 중복 상수 | knip·jscpd 결과 |
| 6 | 성능·번들 | 초기 번들, lazy 경계, 낭비 렌더·effect, 지도 레이어 재생성, GLB·asset 크기 | build 출력, perf-lab |
| 7 | 비용(서버) | 주행당 Firestore 읽기·쓰기, RTDB 주기, 구독 범위, 캐시 | HANDOFF·cost-squeeze 문서 |
| 8 | 안전·데이터 | Rules 누락, 인증 게이트, 계정 삭제·게스트 정리 등록, 에러 격리, 재연결 | rules 시험, `firestore.rules` |
| 9 | 운영·관측 | 에러 바운더리, 로그 수준, 실패 알림, 재현 스크립트 유무 | grep |
| 10 | 문서·일관성 | Ontology 위반 식별자, 끊긴 링크, HANDOFF·PROGRESS 지연, 고정 목록과 화면 불일치 | `check-document-system` |

발견이 없는 영역도 「없음 + 어디를 어떻게 찾았는지」를 적는다. **「없다」고 쓰기 전에 어디를 찾았는지 먼저 쓴다.**

### C단계 — 분류·우선순위 (표 제출 → 승인 대기)

모든 발견을 3축으로 채점한다.

**위험 등급 R** — 지금 고치지 않으면 생기는 손해

| 등급 | 정의 | 예 |
|---|---|---|
| R0 치명 | 데이터 손상·유출·비용 폭주·법적 문제. 조건이 맞으면 운영에서 터진다 | Rules 구멍, 삭제 경로 누락, 무한 쓰기 |
| R1 높음 | 핵심 흐름 중단 또는 잦은 회귀. 시험이 없어 조용히 깨질 수 있다 | 주행 저장·동기화·경로 계산 |
| R2 중간 | 유지비용·혼동·느린 수정. 당장은 동작한다 | 1,500줄 컴포넌트, 중복 3벌 |
| R3 낮음 | 미관·문서·네이밍 | 죽은 CSS, 오래된 주석 |

**개선 효과 E** — 실측 가능하게

| 등급 | 기준(하나라도) |
|---|---|
| E1 큼 | 번들 −10% 이상, 주행당 쓰기 −20% 이상, 400줄 이상 삭제, 위험 모듈 시험 0→있음, 중복 블록 5개 이상 제거 |
| E2 중 | 100~400줄, 큰 파일 1개 분할, 지연 로딩 1개, 시험 10개 이상 추가 |
| E3 작음 | 그 밖의 정리 |

**비용 C**

| 등급 | 기준 |
|---|---|
| C1 낮음 | 파일 1~3개, 계약 불변, 기존 시험으로 검증됨 |
| C2 중간 | 파일 4~10개 또는 새 시험 필요 |
| C3 높음 | 공용 인터페이스·저장 형식·Rules·Functions 변경, 또는 10개 초과 |

**점수와 순서**

- 점수 `R×E÷C`, 소수 둘째 자리. R0=4, R1=3, R2=2, R3=1 · E1=3, E2=2, E3=1 · C1=1, C2=2, C3=3.
- 정렬: 점수 내림차순 → R 높은 것 → diff 작은 것.
- **예외**: R0는 점수와 무관하게 최우선. 단 R0는 Chief 승인 항목으로 따로 표시한다.
- **선행 조건**: R1 이상인데 그 영역 시험이 없으면, 리팩터링보다 「특성화 시험 추가」를 별도 항목으로 먼저 올린다.
- 계약 변경(C3)은 실행 목록에서 빼고 「Chief 결정 필요」 표로 분리한다.

### D단계 — 승인 후 실행 (1건씩)

1. 그 항목의 현재 동작을 고정하는 시험이 있는지 확인. 없으면 시험부터(별도 항목이면 먼저 끝낸다).
2. 구조 변경(동작 불변). 크기 한도: **diff 400줄 이하·파일 10개 이하**. 넘으면 쪼갠다.
3. 게이트: `npx tsc -b --noEmit` · 바뀐 파일 eslint(오류 0, 경고는 기준선 이하) · `npm run test:quick` · `node scripts/check-code-tidy.mjs --check` · `node scripts/check-dep-direction.mjs --check` · `npm run build`. 서버를 건드렸으면 `functions`에서 `npm test`.
4. **사보타주**: 새·바뀐 시험이 실제로 잡는지 확인하려고 코드를 일부러 망가뜨린다(예: 상수 하나 뒤집기). FAIL 하는지 보고 **원복**한다. 원복 후 PASS를 다시 확인한다.
5. 결과 파일에 `항목 ID / 전·후 수치 / 게이트 요약 / 사보타주 결과 / 되돌리는 방법`을 적고 다음 항목으로.

같은 항목에서 3번 시도해도 게이트가 좋아지지 않으면 멈추고 「실패 + 원인 + 남은 선택지」를 적는다. 같은 증상으로 5분 진전이 없으면 접근을 바꾼다.

## 3. 산출물

`document/ops/20261110-health-audit/` 폴더에 만든다.

- `01-baseline.md` — A단계 숫자 표(측정 시각·명령·값·기준선 비교)
- `01-audit.md` — 요약(총평 3줄, 등급별 개수, 즉시 처리 Top 5) + 발견 표
- `01-audit.json` — 아래 스키마(기계로 정렬·집계)
- `02-<항목ID>-result.md` — D단계 항목별 결과

발견 표 열:
`ID | 영역 | 제목 | 근거(file:line) | 증상·위험 | R | E | C | 점수 | 필요한 검증 | Chief 결정(예/아니오) | 추정(예/아니오)`

```json
{
  "measuredAt": "2026-11-10T21:30:00+09:00",
  "baseline": {
    "tscErrors": 0, "eslintErrors": 0, "eslintWarnings": 0,
    "testQuick": { "pass": 0, "fail": 0 }, "functions": { "pass": 0, "fail": 0 },
    "knip": { "files": 0, "exports": 0, "types": 0, "duplicates": 0 },
    "duplicatedLines": 0, "largeFiles": {}, "buildAssets": {}
  },
  "items": [
    {
      "id": "H-001", "area": "tests", "title": "...",
      "evidence": ["apps/web/src/x.ts:42"], "symptom": "...",
      "risk": "R1", "impact": "E2", "cost": "C2", "score": 3.0,
      "verify": ["npm run test:quick"], "requiresChief": false, "estimated": false
    }
  ]
}
```

## 4. 보고 형식

- 결론부터: 앱이 지금 건강한지 한 문단, 가장 위험한 3개, 바로 할 일 3개.
- 요약 표는 10줄 이내, 전체 표는 파일 링크.
- 실행 폴더 절대 경로, 복사 가능한 명령, 새로고침·확인 순서.
- 통과·실패·**미실행(이유)** 을 구분한다.
- 모든 주장에 근거. 추정이면 「추정」이라고 쓴다.

## 5. 완료 조건

1. A단계 숫자가 실제 실행 결과와 일치한다.
2. 모든 발견에 `file:line`과 검증 방법이 있다.
3. R0·R1 항목이 전부 나열되고, 시험 없는 영역은 「특성화 시험」 항목이 별도로 있다.
4. 승인 전 코드 변경 0 — `git status` 출력을 붙인다.
5. D단계 항목마다 전·후 수치·게이트·사보타주·원복 방법이 있다.

## 부록 A. 이 리포가 이미 쓰는 건강 지표

- `apps/web/code-tidy.baseline.json` — knip(안 쓰는 export 186 등)·중복 18줄·큰 파일 4개(App 3657, MapView.tsx 3404, MapView.css 1686, MapHud.css 1447). `--check`로 늘면 pre-push가 막는다.
- `scripts/check-dep-direction.mjs` — 도메인 의존 방향 위반 0이 목표. 위반 눈금은 갚을 빚이다.
- `npx tsc -b --noEmit` — `-p .`는 빈 검사다. 반드시 `-b`.
- HANDOFF 11-06 기록: test:quick 1522/0, functions 282/0. **직접 돌린 값으로 대체한다.**
- 알려진 e2e 실패는 HANDOFF에 목록으로 있다. 이번 작업에서 늘리지도 줄이지도 않는다.

## 부록 B. 하지 말아야 할 「리팩터링」

- 파일 이름만 바꾸는 대량 rename, 폴더 이동만 하는 정리 — 리뷰 비용만 늘어난다.
- prettier·줄바꿈 일괄 적용 — diff가 오염된다.
- 추상화 도입(공용 훅·래퍼)으로 줄 수를 늘리는 정리. **줄 수와 이해 비용이 줄어야 개선이다.**
- 시험을 통과시키려고 시험을 고치는 것(시험이 틀렸다는 증거가 있을 때만, 근거와 함께).
