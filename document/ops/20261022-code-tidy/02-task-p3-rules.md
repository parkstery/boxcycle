# P3 공통 규칙 — 반복 코드 통합 (지시05~08)

감리 Claude. 실행 폴더 `C:\20.HDev\boxcycle`. 줄 번호는 P1 이전 측정값이라 조금 밀려 있을 수 있다 — 내용으로 찾는다.
원자료: [evidence/00-jscpd-baseline.json](evidence/00-jscpd-baseline.json)

## 할 일

지시에 적힌 반복 쌍마다 겹치는 부분을 함수·컴포넌트·상수 하나로 뽑고, 양쪽이 그것을 쓰게 한다.

## 지켜야 할 것

1. **동작 불변.** 같은 입력에 같은 결과·같은 호출 순서·같은 타이머·같은 로그 문자열. 「김에 고치기」 금지.
2. **바깥 계약 불변.** 지금 `export` 된 이름·인자·반환 타입과 시험용 훅(`__set…ForTests` 등)은 이름과 동작을 그대로 둔다. 안쪽 구현만 공통 함수로 바꾼다.
3. **새 파일은 쓰는 쪽 도메인 안에.** 두 도메인이 함께 쓰면 `apps/web/dep-layers.json` 에서 이미 허용된 방향(예: `peerMotion → trail`)의 아래쪽 도메인에 둔다. 새 파일은 `dep-layers.json` 의 파일 배정 목록에 **추가만** 한다. 도메인 사이 허용 방향(엣지)은 고치지 않는다.
4. 시험 파일·`eslint.config.js`·`knip.config.mjs`·baseline 파일 수정 금지. 시험이 깨지면 시험이 아니라 코드를 고친다.
5. 합칠 수 없는 쌍(두 쪽이 일부러 다르게 갈 이유가 있음)은 억지로 합치지 말고 보고에 이유를 적는다.
6. git commit·push·stash·checkout·restore·clean·worktree 금지. 커밋은 감리가 한다.
7. 지시에 적힌 파일만 고친다. 다른 agent 가 같은 트리에서 동시에 일한다.

## 스스로 검사 (apps/web 폴더)

```
npx tsc -b --noEmit
npx eslint <고친 파일>
node ../../scripts/check-dep-direction.mjs --check
npm run test:quick
```

## 보고

`03-result-NN.md` — 합친 쌍별로 공통부 위치·줄 수 증감, 합치지 않은 쌍과 이유, 위 검사 결과 마지막 몇 줄.

> 새 디버그 코드·주소 스위치·스크립트를 만들면 `apps/web/dev-tools.json` 에 등록한다(분류·목적·켜는 법·만료). 운영에서 켜지는 도구 화면은 동적 import 로 분리한다.
