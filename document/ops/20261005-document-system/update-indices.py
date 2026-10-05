"""Apply the approved index/lifecycle wording after migrate-documents.py."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
DOC = ROOT / 'document'
def read(p):
    return p.read_text(encoding='utf8')
def write(p, text):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf8', newline='\n')

write(DOC / 'README.md', '''# RTW 문서 입구

| 항목 | 내용 |
|---|---|
| 문서 유형 | 메타 — 현재 기준·작업·기록의 색인 |
| 최초 작성 | 2026-05-23 |
| 독자 | chief · AI |
| 상태 | SoT — 2026-10-05 수명별 체계 정리 |
| 연결 문서 | [문서 운영 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md#8-문서-운영--수명별-체계-2026-10-05) |

**목표와 기능별 진도는 [상태보드](260707-RTW-기능-인벤토리-상태보드.md)에서 확인한다.** Chief가 계속 직접 활용하는 핵심 문서다. 다음 목표·결정 대기 요약은 [현황판](260928-RTW-현황판.md), 에이전트 실행 상황은 [ops 상태판](ops/PROGRESS.md)이다.

## 자주 보는 문서

| 확인할 것 | 문서 | 유지 방식 |
|---|---|---|
| 목표·전 기능 진도·다음 액션 | [상태보드](260707-RTW-기능-인벤토리-상태보드.md) | 기존 파일·한눈 지도·기능표 유지. 코드 대조 후 상태 갱신 |
| 지금 위치·다음 목표·Chief 결정 대기 | [현황판](260928-RTW-현황판.md) | 짧은 요약, 상세는 상태보드·정본 링크 |
| 왜 그렇게 결정했나 | [결정 로그](260707-RTW-결정-로그.md) | 결정 한 줄, 최신이 위 |
| 에이전트 진행·대기·막힘 | [ops 상태판](ops/PROGRESS.md) · [작업 입구](ops/README.md) | 종료 작업은 목록에서 제외 |
| 출시 전 복원할 값 | [출시 전 확인사항](출시%20전%20확인사항.md) | 반복 점검하는 현재 목록 |
| 문서 생성·종료·이동 절차 | [문서 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) | 수명과 보관 위치의 단일 기준 |

## 현재 기준과 검토 중인 문서

`reference/`는 주제별 탐색 공간이다. **위치만으로 채택된 기준이 되지는 않는다.** 검토 중인 경제 설계와 부록은 아래 상태를 확인한다. 상태보드의 구현 기호와 문서의 채택 상태도 서로 다르다.

### 제품·용어·정책 — reference/product

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [마스터 비전](reference/product/260511-RTW-마스터-비전-및-종합계획.md) | 정체성·제품 원칙·로드맵 | SoT |
| [Ontology](reference/product/260714-RTW-Ontology.md) | 개념·용어·금지어 | 채택·SoT |
| [Trail·Trailhead 상세](reference/product/260517-제품-용어-Trailhead-Trail.md) | 도메인 동작·매핑. 용어 정의는 Ontology | 채택·범위 축소 |
| [tier·진입 정책](reference/product/260519-사용자-tier-및-진입-정책.md) | identity·tier·진입의 기준. 구현 진도는 상태보드 | SoT·부분 구현 |
| [tier quota](reference/product/260519-tier-quota-정책.md) | 생성·저장 한도 | 채택(1차)·tier 정책 부록 |
| [tier subscription](reference/product/260519-tier-subscription-정책.md) | Stripe 구독 | 채택(1차)·tier 정책 부록 |
| [Route Token 경제](reference/product/260518-Route-Token-경제-설계.md) | 経済 루프·소비처·저장 한도와의 관계 | 검토 중·미결 있음, 한시 무제한 |
| [퍼블릭 경로 자동등록](reference/product/260717-퍼블릭-경로-자동등록-정책.md) | 등록·자동 심사 조건 | SoT |
| [UI 공간밀도 원칙](reference/product/260924-RTW-UI-공간밀도-원칙.md) | 화면 공간 규칙 D1~D7 | SoT |

### 현재 설계 — reference/architecture

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [Conquest 설계](reference/architecture/260703-Conquest-정복-레이어-설계.md) | Ride = Claim 메커닉·데이터·단계별 구상 | SoT·미구현 단계 구분 |
| [World Activity Presence](reference/architecture/260523-World-Activity-Presence-설계.md) | 월드 맵 activity·presence 경계 | SoT |
| [lib 도메인 경계](reference/architecture/260925-RTW-lib-도메인-경계와-의존-방향.md) | 모듈 책임·허용 의존 | SoT |

### 반복 절차·개발 운영 — reference/operations

| 문서 | 역할 | 문서 상태 |
|---|---|---|
| [Firebase 비용 체크리스트](reference/operations/260523-Firebase-비용-운영-체크리스트.md) | 반복 비용 관측·대응 절차 | 검토됨·운영 문서 |
| [개발 워크플로](reference/operations/260719-개발-워크플로-브랜치-커밋-게이트.md) | 브랜치·커밋·검증 게이트 | SoT |
| [Skill·Harness 아키텍처](reference/operations/260722-Skill-Harness-아키텍처.md) | 규율·도구·실행코드 3계층 | SoT |
| [구조 게이트 운용](reference/operations/260926-RTW-구조-게이트-운용-지침.md) | 구조 도구·게이트 규율 | SoT |

## 작업과 기록

| 수명 | 위치 | 입구 |
|---|---|---|
| 진행·대기 계획, 지시·결과·검수 | `ops/YYYYMMDD-주제/` | [진행·대기 작업](ops/README.md) |
| 미착수 경쟁 판정 계획 | `ops/20260927-peer-competition/` | [계획 입구](ops/20260927-peer-competition/README.md), 현재 구현 기준과 구분 |
| 종료 묶음·최종 보고·대체된 기준 | `archive/` | [완료 기록 색인](archive/README.md). 경로 의존으로 제자리 보관한 종료 묶음도 여기서 찾는다 |

새 보고서는 `archive/reports/`, 대체 정본은 `archive/superseded/`, 종료 묶음은 `archive/ops/`에 보관한다. 기존 archive 최상위 기록은 경로를 유지한다. 매 작업마다 별도 보고서를 추가하지 않고, 일반 작업은 묶음의 최종 결과로 충분하다.

## 정책 시드 — 경로 유지

| 파일 | 용도 |
|---|---|
| [config-tierQuotas.seed.json](config-tierQuotas.seed.json) | tier 한도 시드 |
| [config-subscription.seed.json](config-subscription.seed.json) | 구독 시드 |
| [config-routeTokenEconomy.seed.json](config-routeTokenEconomy.seed.json) | Route Token 시드 |

시드는 문서 본문이 아닌 운영 입력이다. 폴더 미관을 이유로 이동하지 않는다.

## 정리 검증

`node scripts/check-document-system.mjs`는 현재 문서 링크·reference 색인 누락·종료 작업의 PROGRESS 잔류를 확인한다. `--all`은 과거 기록까지 검사하며 기존 오류도 실패로 보고한다. anchor·동적 경로·코드블록 예시는 검사 대상이 아니다.

[2026-10-05 정리 결과](archive/reports/261005-RTW-문서체계-정리-완료보고.md) · [실제 이동 목록·검수](ops/20261005-document-system/README.md)
'''.replace('経済', '경제'))

# Keep the established handoff protocol; replace only lifecycle and bundle index.
p = DOC / 'ops/README.md'
t = read(p)
t = t.replace('완료 보고서는 [문서 지침 §8](../260509-BOXCYCLE-문서-생성-및-수정-지침.md)에 따라 `document/archive/`에 작성한다.',
              '일반 작업은 묶음의 최종 결과만 남긴다. 별도 완료 보고서가 필요한 작업은 [문서 지침 §8](../260509-BOXCYCLE-문서-생성-및-수정-지침.md)에 따라 `document/archive/reports/`에 한 편 작성한다.')
t = t.replace('끝나면 이 표의 상태를 **종료**로 바꾸고, 결과 보고서는 `archive/` 에 둔다.',
              '종료가 확정되면 현재 표와 PROGRESS에서 빼고 [종료 색인](../archive/README.md)에 결과와 위치를 남긴다. APPROVED는 CLOSED와 다르다.')
head = t.split('## 묶음 현황')[0]
rows = [line for line in t.splitlines() if line.startswith('| [') and ('**APPROVED**' in line or '**AWAITING_CHIEF**' in line or '**대기**' in line)]
write(p, head + '''## 진행·대기 묶음 (2026-10-05)

| 폴더 | 상태 | 무엇 | 결과·입구 | 이동 |
|---|---|---|---|---|
| [20261005-document-system](20261005-document-system/README.md) | **IN_PROGRESS** | 문서 체계 정리·상태보드 입구 유지 | [01 지시](20261005-document-system/01-task-document-system.md) | 검수 후 판단 |
''' + '\n'.join(rows) + '''
| [20260927-peer-competition](20260927-peer-competition/README.md) | **대기** · PLANNING | 경쟁 판정 분리·느낌 보정의 기존 미착수 계획 | [계획](20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md) | 재개 시 새 지시 |

종료 작업과 옛 relay 이력은 [완료 기록 색인](../archive/README.md)에 있다. 코드·시험·스킬이 경로를 사용하는 종료 묶음은 제자리에 보존하지만 현재 작업으로 표시하지 않는다.
''')
p = DOC / 'ops/PROGRESS.md'
t = read(p)
t = '\n'.join(line for line in t.splitlines() if not (line.startswith('| [') and 'CLOSED' in line))
t = t.replace('종료된 묶음과 이동 가능 여부는 [ops 색인](README.md)에 보존한다.',
              '종료된 묶음과 이동 가능 여부는 [완료 기록 색인](../archive/README.md)에 보존한다.')
t = t.replace('제품 전체 방향은', '목표·기능별 진도는 [상태보드](../260707-RTW-기능-인벤토리-상태보드.md), 제품 전체 방향은')
t = t.replace('| [Foreground read spike]', '| [문서 체계 정리](20261005-document-system/README.md) | IN_PROGRESS | Codex | Codex (Cursor CLI 실행 오류 후 직접 수행) | 문서 정리 요청으로 범위 승인 | 링크 이동 비교 0회귀 | 없음 | 최종 링크·diff 검수 |\n| [Foreground read spike]', 1)
t = t.replace('\n종료된 묶음', '\n| [동행 경쟁 판정 계획](20260927-peer-competition/README.md) | PLANNING (기존 미착수) | 미지정 | 미지정 | 재개 시 범위 결정 | 기존 09-27 계획, 최신 표시 보고 분리 | 활성 지시 없음 | 재개 시 새 지시 |\n\n종료된 묶음', 1)
write(p, t + '\n')

p = DOC / '260707-RTW-기능-인벤토리-상태보드.md'
t = read(p).replace('| 최초 작성 |', '| 독자 | **chief · AI** — 목표와 기능별 진도를 직접 점검하는 핵심 문서 |\n| 최초 작성 |', 1)
t = t.replace('> **중간 점검', '> **목표·진도 점검의 첫 입구입니다.** 한눈 지도와 기능표를 계속 유지합니다. 다음 목표·결정 대기는 [현황판](260928-RTW-현황판.md), 에이전트 실행 상황은 [ops 상태판](ops/PROGRESS.md)에서 확인합니다.\n\n> **중간 점검', 1)
t = t.replace('Claude에게 "인벤토리 갱신해"', 'AI에게 "인벤토리 갱신해"')
write(p, t)
p = DOC / '260928-RTW-현황판.md'
t = read(p).replace('> 이 한 장만 읽으면 된다. 더 궁금한 것은 문서를 열지 말고 AI 에게 질문한다 — 「토큰 정책 왜 이렇게 됐지?」.',
                    '> 목표·기능별 진도는 [상태보드](260707-RTW-기능-인벤토리-상태보드.md)를 계속 직접 확인한다. 이 현황판은 다음 목표·결정 대기 요약이다. 에이전트 실행 상황은 [ops 상태판](ops/PROGRESS.md)에서 확인한다. 내용 기준일은 위 메타의 마지막 갱신일이다.')
t = t.replace('| ① 이 현황판 | chief | 한 장 |', '| ① 점검 입구 | chief | [상태보드](260707-RTW-기능-인벤토리-상태보드.md)로 목표·진도, 이 현황판으로 요약 |')
write(p, t)

p = DOC / '260509-BOXCYCLE-문서-생성-및-수정-지침.md'
t = read(p).replace('| 상태 | **검토됨** |', '| 상태 | **SoT** — 문서 수명·보관·정리의 기준 (2026-10-05 개정) |', 1)
t = t.replace('루트 `README.md`, `document/README.md`(네 덩어리 **색인**)만 예외로 둔다.',
              '각 폴더의 `README.md`, ops의 `PROGRESS.md`, 묶음 안의 `00-brief.md`·`01-task-*.md` 등 순번 handoff 파일은 날짜 접두어 예외다. 날짜는 묶음 이름·메타에 남긴다.')
t = t.replace('파일명·폴더는 바꾸지 않고, [document/README.md](README.md)에 **product / architecture / execution / record** 별 링크 목록을 둔다.',
              '[document/README.md](README.md)에 현재 기준을 **product / architecture / operations**로 색인한다. 실행·기록은 ops/archive 입구로 연결한다. 보관 위치는 §8을 따른다.')
t = t.replace('문서 수가 늘면 `document/product/` 등 하위 폴더를 둘 수 있다.',
              '현재 기준은 `document/reference/product/`·`architecture/`·`operations/`로 분류한다(§8).')
t = t.replace('**상태**는 PM이 코드를 읽지 않고도', '문서 상태(채택·검토 중·대체됨)와 구현 진도는 별개다. **상태**는 PM이 코드를 읽지 않고도')
start = t.index('## 8. 문서 운영')
end = t.index('## 9. 개정 이력')
t = t[:start] + '''## 8. 문서 운영 — 수명별 체계 (2026-10-05)

이 절이 §2~§6보다 우선한다. 문서 종류는 설명에 쓰고, 보관은 **현재 기준 / 진행·대기 / 과거 기록**으로 판단한다.

### 8.1 입구와 역할

| 역할 | 문서·위치 | 유지 방식 |
|---|---|---|
| Chief 목표·진도 점검 | [상태보드](260707-RTW-기능-인벤토리-상태보드.md) | 가장 자주 보는 핵심 문서. 기존 경로·한눈 지도·전체 기능표 유지 |
| 다음 목표·결정 대기 요약 | [현황판](260928-RTW-현황판.md) | 약 80줄. 상세는 상태보드·정본 링크 |
| 현재 기준·검토 중인 정책 | `reference/product/`·`architecture/`·`operations/` | 주제마다 정본 하나. 초안은 상태를 명시, 위치만으로 채택하지 않음 |
| 상태·결정 | 상태보드·결정 로그 | 상태와 결정 요약. 경위·측정·교훈은 근거 링크 |
| 진행·대기 작업 | `ops/YYYYMMDD-주제/` | 계획·지시·결과·검수. 현재 작업은 ops README·PROGRESS |
| 과거 기록 | `archive/reports/`·`archive/ops/`·`archive/superseded/` | 당시 증거 보존. [종료 색인](archive/README.md)에서 찾음 |

Chief는 상태보드와 현황판을 직접 활용한다. AI에게 질문하는 것은 선택 사항이다. PROGRESS는 작업 담당·단계·막힘을 보여주며 제품 상태보드를 대체하지 않는다.

### 8.2 문서 종류의 수명

- 설계 초안·실행계획은 ops 작업 묶음에 둔다. 채택된 지속 계약은 기존 정본에 반영하거나 reference로 승격하고 결정 로그에 근거를 남긴다. 구현되지 않은 제품 로드맵을 완료로 표시하지 않는다.
- 반복 비용 관측·배포·운영 체크리스트는 현재 절차(reference), 특정 작업의 완료 체크리스트는 ops 기록이다.
- 최종 보고서는 필요한 작업에 한 편만 `archive/reports/`에 작성한다. 일반 작업은 묶음의 최종 결과로 충분하다. 지시·결과·검수는 서로 분리해 보존하며 같은 내용을 보고서 여러 편에 복제하지 않는다.
- 대체 정본은 후속 기준·이유를 상단에 표시하고 `archive/superseded/`에 보관한다. 나이가 많다는 이유로 삭제하지 않는다.
- 기존 archive 최상위의 계획·보고·스냅샷·증거는 경로를 유지한다. 신규 자료에 새 체계를 적용하며 전량 이동을 요구하지 않는다.
- 출시 전 확인사항·메타 입구와 운영 시드 JSON은 기존 최상위 경로를 유지한다. 시드는 실행 입력이므로 문서 분류와 함께 이동하지 않는다.

### 8.3 요약과 상태보드 유지

- 정본 상단에 짧은 요약과 채택/검토 중/대체됨 상태를 둔다. 메타에는 독자·최초 작성·연결 문서를 적는다.
- 상태보드는 현재 상태 약 150자·다음 액션 약 60자로 유지한다. 목표·구상도 남기고, 기능 완료·폐기 기호는 코드·결정 근거를 확인한 뒤 갱신한다. 문서 이동만으로 기능 상태나 코드 대조 날짜를 바꾸지 않는다.
- 결정 로그는 결정 약 100자·이유 약 80자 한 행, 최신이 위다. 상세 경위는 링크한다.
- 현황판과 상태보드는 같은 상세 내용을 반복하지 않는다. 요약과 진도가 어긋나면 근거를 대조해 맞춘다.

### 8.4 작업 묶음 종료 절차

1. 기존 [ops 프로토콜](ops/README.md)의 지시 → 결과 → 검수를 따른다. APPROVED는 검수 통과이며 CLOSED와 다르다. 최종 승인·잔여 조건을 확인하고 종료를 기록한다.
2. 지속할 동작·계약을 정본에 반영하고, 주요 결정은 결정 로그, 구현 진도는 상태보드에 반영한다. 중간 기록 전체를 정본에 복사하지 않는다.
3. 결과·검수·시험 증거는 묶음에 보존한다. 필요하면 최종 보고 한 편을 연결한다.
4. 코드·스킬·명령·시험이 기존 경로를 사용하는지 `rg`로 확인한다(`apps`·`functions`·`scripts`·`.agents`·`.claude`·`.cursor`·루트 운영 문서 포함). 의존이 없을 때만 묶음 전체를 archive/ops로 이동하고 상대 링크를 갱신한다.
5. 경로 의존이 있으면 **제자리 보관**하고 종료 색인에 실제 참조·이유를 적는다. 현재 ops README·PROGRESS에서는 종료 항목을 제거한다. 대기·APPROVED·승인 대기 작업은 유지한다.
6. 새 시험 fixture와 반복 실행 출력은 ops 영구 경로에 결합하지 않는다. 기존 의존 분리는 별도 작업으로 입력·출력 계약과 검증을 정해 수행한다. 문서 정리를 이유로 시험 동작을 바꾸지 않는다.

### 8.5 갱신·검증

- 새 reference 문서를 만들거나 승격할 때 document README와 상단 메타를 함께 갱신한다. 새 ops 묶음은 ops README·PROGRESS에 등재하며 개별 순번 파일은 묶음 README가 색인한다. 종료 기록은 archive README에 등재한다.
- 「인벤토리 갱신해」는 코드와 대조해 상태보드를 갱신한다. 「현황판 갱신해」는 코드·결정 로그·상태보드와 대조해 목표·요약을 갱신한다. 이동 작업은 내용 검증일을 갱신하지 않는다.
- 이동 전 source/target 목록과 기존 링크 오류를 기록한다. 상대 링크뿐 아니라 AGENTS·CLAUDE·스킬·명령·소스의 문서 경로 문자열도 함께 갱신한다.
- `node scripts/check-document-system.mjs`: 현재 로컬 링크·reference 색인·종료 PROGRESS 잔류 검사. `--all`: 과거 기록 포함. `--baseline <JSON> --moves <JSON>`: 이동 전 오류와 새 오류 구분. baseline은 오류를 성공으로 바꾸지 않는다. URL·anchor·동적 경로·코드 예시는 제외하며 코드의 fixture 의존 확인은 별도 rg 검사다.
- 여러 에이전트가 동시에 편집 중이면 공용 색인을 통째로 덮어쓰지 않는다. 구조 정리는 별도 브랜치에서, 현재 변경과 담당을 확인한 뒤 수행한다. 다른 작업 변경은 커밋·push에 섞지 않는다.

---

''' + t[end:]
t += '\n| 2026-10-05 | 상태보드를 Chief의 핵심 입구로 유지. 수명별 보관·reference 분류·작업 종료 절차·새 보고서 위치·링크 검사와 날짜 예외 정리 |\n'
write(p, t)

# Fix known current links, without inventing a missing historic handoff.
p = DOC / '260707-RTW-결정-로그.md'
t = read(p).replace('../apps/web/src/lib/bleAutoReconnect.ts', '../apps/web/src/lib/sensor/bleAutoReconnect.ts')
t = t.replace('[Claude 인수인계](260812-AI-오케스트레이션-Claude-인수인계.md)', 'Claude 인수인계(원본 없음; 당시 파일명 `260812-AI-오케스트레이션-Claude-인수인계.md`)')
row = '| 2026-10-05 | `[Docs]` | 상태보드를 Chief의 목표·진도 입구로 유지하고 reference 주제 분류·ops 현재/종료 분리·수명별 보관을 적용한다 | Chief의 문서 정리 요청·상태보드 지속 활용 요구. 제품 의미·기능 상태는 보존 | [정리 작업](ops/20261005-document-system/README.md) · [문서 지침 §8](260509-BOXCYCLE-문서-생성-및-수정-지침.md#8-문서-운영--수명별-체계-2026-10-05) |\n'
needle = '|---|---|---|---|---|\n'
t = t.replace(needle, needle + row, 1)
write(p, t)
p = DOC / 'reference/architecture/260703-Conquest-정복-레이어-설계.md'
write(p, read(p).replace('apps/web/src/lib/firestoreSavedRoutes.ts', 'apps/web/src/lib/route/repo/firestoreSavedRoutes.ts'))

# Keep root routing synchronized with the user's preferred first entry.
for name in ['AGENTS.md', 'CLAUDE.md']:
    p = ROOT / name
    t = read(p).replace('| 지금 어디까지 왔나·다음 목표·chief 결정 대기 |', '| 다음 목표·chief 결정 대기 요약 |')
    t = t.replace('| 어디까지 구현됐나·전체 그림 |', '| 목표·기능별 진도·전체 그림 — Chief 핵심 입구 |')
    t = t.replace('새 문서는 `YYMMDD-` 접두어 + [document/README.md](document/README.md) 색인 등재. 보고서·완료된 체크리스트는 태어날 때부터 `document/archive/`에 작성.',
                  '현재 기준은 `document/reference/`에 `YYMMDD-` 접두어로 작성하고 [문서 색인](document/README.md)에 등재. 작업 문서는 ops 묶음에, 새 최종 보고서는 `document/archive/reports/`에 보관. 날짜 예외·종료 절차는 문서 지침 §8을 따른다.')
    write(p, t)
