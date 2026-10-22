# P1 공통 규칙 — 모든 지시(01~04)에 적용

담당: opencode(GLM-5.3-Flash / MiniMax M3.1 Flash). 감리: Claude. 실행 폴더: `C:\20.HDev\boxcycle`.

## 할 일

지시별 목록 파일(`02-task-NN-list.md`)에 적힌 항목만 처리한다.

- **DELETE** — 그 선언(함수·상수·타입·인터페이스)을 붙어 있는 JSDoc 주석과 함께 통째로 지운다. 배럴(`index.ts`)의 DELETE 는 재수출 목록에서 그 이름만 뺀다.
- **UNEXPORT** — 선언 앞의 `export` 키워드만 지운다. 본문은 건드리지 않는다. `export { A, B }` 목록 형태면 그 이름만 목록에서 뺀다.
- 위 작업 때문에 **같은 파일 안에서** 새로 안 쓰이게 된 import·private 함수·상수는 지운다(tsc·lint 가 알려 준다). 다른 파일은 고치지 않는다.

## 금지

- 목록에 없는 파일·이름 수정. 로직·값·이름 변경. 포맷 일괄 정리.
- 시험 파일(`*.test.*`·`e2e/`)·`dep-layers*.json`·`eslint.config.js`·`knip.config.mjs`·baseline 파일 수정.
- git commit·push·stash·checkout·restore·clean·worktree. (커밋은 감리가 한다)
- 다른 지시의 대상 파일 수정 — 다른 agent 가 같은 작업 트리에서 동시에 일한다.

## 막히면

이름을 지우자 **다른 파일**에서 타입 오류가 나면, 그 항목은 되돌리고 결과 파일의 「건너뜀」에 이유와 함께 적는다. 억지로 고치지 않는다.

## 스스로 검사 (apps/web 폴더)

```
npx tsc -b --noEmit
npx eslint <고친 파일들>
```

오류 0 이어야 한다. 경고는 늘지 않아야 한다.

## 보고

`document/ops/20261022-code-tidy/03-result-NN.md` 에 쓴다.

- 처리한 항목 수(DELETE·UNEXPORT 각각), 고친 파일 목록
- 건너뛴 항목과 이유
- tsc·eslint 결과 마지막 몇 줄 그대로

> 새 디버그 코드·주소 스위치·스크립트를 만들면 `apps/web/dev-tools.json` 에 등록한다(분류·목적·켜는 법·만료). 운영에서 켜지는 도구 화면은 동적 import 로 분리한다.
