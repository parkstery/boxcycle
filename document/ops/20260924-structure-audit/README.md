# 프로젝트 구조 감사 — 20260924-structure-audit

> **읽기 전용 조사다. 코드를 한 줄도 바꾸지 않는다.**
> Chief 원안(2026-09-24)을 세 갈래로 나눠 병렬 조사하고, 감리가 최종 보고서로 종합한다.

## 0. 절대 규칙 (모든 조사자 공통)

1. **파일 삭제·이동·이름 변경·코드 수정·package 변경 금지.** `git status` 가 깨끗해야 한다
   (자기 findings 파일 작성만 허용)
2. **기능 변경을 제안하지 않는다.** 이번 목적은 구조 파악이지 기능 개선이 아니다
3. **추측하지 않는다.** 안 쓰이는 것처럼 보여도 **참조를 실제로 조사한 뒤** 판단한다.
   `grep -rn` 으로 import·문자열 참조·동적 참조를 확인하라
4. **삭제 후보와 확실한 삭제 대상을 구분한다.** 근거가 부족하면 `UNKNOWN` 으로 두고 왜 모르는지 적어라
5. `git commit`·`push`·배포 **금지**

## 1. 분류 라벨 (공통)

`ACTIVE` 현재 기능에 사용 · `SUPPORT` 기능 지원 · `LEGACY` 과거 잔재 · `DUPLICATE` 중복 ·
`DEAD` 미사용 확인 · `EXPERIMENTAL` 실험/임시 · `TEST` 테스트 전용 · `CONFIG` 설정 ·
`UNKNOWN` 판단 불가(근거 필수)

## 2. 갈래 (셋이 서로 겹치지 않는다)

| 갈래 | 범위 | 산출 파일 |
|---|---|---|
| **A. 앱 인벤토리** | `apps/web/src` 전체 — 파일 분류표·미사용 export/import·중복 util/hook·거대 컴포넌트·순환 의존·console.log·TODO/FIXME | `A-앱-인벤토리.md` |
| **B. 핵심 기능 영역** | Map · Route · Ride · Trail · Claim · Rider · Firebase · Session · Camera · RouteDock — 각 영역의 진입점·의존·결합·legacy·정비 위험도 | `B-핵심영역.md` |
| **C. 인프라·설정·문서** | `functions/` · `scripts/` · `package.json`·dependency · 빌드/배포 설정 · 환경변수 · e2e/테스트 · `document/` · 개발용 스크립트·임시 파일 | `C-인프라-설정-문서.md` |

## 3. 보고 형식 (각 갈래 공통)

각자 자기 파일에 쓴다. **표를 쓰고 산문을 줄여라.**

```
| File | Classification | Reason | Dependency Risk | Action |
```

- `Reason` 은 **근거**다 — 「안 쓰이는 것 같다」가 아니라 「`grep -rn "X"` 결과 참조 0건, 단 `Y.ts` 의 동적 import 가능성 확인함」
- `Dependency Risk` 는 **낮음/중간/높음** 과 한 줄 근거
- `Action` 은 **삭제 후보 / 검토 필요 / 유지 / 통합 후보** 중 하나

마지막에 **「가장 위험한 것 5가지」** 와 **「가장 쉬운 정비 5가지」** 를 각각 목록으로 남겨라.

## 4. 감리가 할 일

세 파일을 받아 Chief 원안의 보고서 10개 절(구조 요약 · 문제 영역 Critical~Low · 파일 분류표 ·
중복 · legacy · dead 후보 · 구조적 문제 · 목표 구조 · 정비 실행 계획 · 기능 보존 위험)로 종합한다.
최종 보고서는 `document/archive/` 에 둔다.
