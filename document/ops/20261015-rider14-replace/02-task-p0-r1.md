# 재지시 P0-R1 — 벤치 실행기 오류 수정 후 측정 완료

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 원 지시 | [02-task-p0.md](02-task-p0.md) — 범위·금지 사항은 그대로 유효 |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p0.md` |

## 감리 결과 (P0 1차)

- 벤치 페이지 `rider-perf-bench.html/.ts`: **합격**. 그대로 둔다.
- 기존 시험 기준선(tsc 0, 계약 5/5, 키트 3/3, eslint 0)·s5 해시 확인: 기록 인정.
- **불합격 1**: `rider-perf-bench.run.mjs` 145행 `savePartial()` 호출 시 `ReferenceError: Cannot access 'savePartial' before initialization`. `buildResult`·`savePartial` 이 `for (const z of ZOOMS)` 와 `return buildResult()` **뒤에** `const` 로 선언돼 있다. 이 오류를 GPU 실패로 오인해 SwiftShader 로 재시도했다(실제 GPU 경로는 정상: 줌 22 에서 3명 773 / 0명 134 / 1명 347 콜).
- **불합격 2**: 측정을 백그라운드로 띄운 채 세션을 끝내 `03-result-p0.md` 가 없다.

## 할 일

1. `runOnce` 안에서 `buildResult`·`savePartial` 선언을 **측정 루프보다 앞으로** 옮긴다. 다른 로직은 바꾸지 않는다.
2. 재시도 규칙 보완: SwiftShader 재시도는 **WebGL 컨텍스트 생성 실패·`CONTEXT_LOST`·흰 화면** 일 때만 한다. 그 밖의 예외는 바로 실패로 끝낸다.
3. 기존 `.out/rider14/p0/` 의 `z22.png`·`z19.png` 는 지우고 처음부터 다시 잰다(같은 조건으로 4개 줌 모두).
4. **측정을 포그라운드로 실행하고 끝날 때까지 기다린다**(타임아웃 넉넉히, 최대 25분). 백그라운드 실행·중간 종료 금지.
5. dev 서버: 5040 포트에 이미 떠 있는 vite 를 그대로 쓰고, 측정이 끝나면 **5040 의 vite 와 그 부모 npx 프로세스만** 종료한다(다른 포트의 vite — 5000 등 — 는 건드리지 않는다).
6. `03-result-p0.md` 를 원 지시서 형식대로 쓰고 종료한다.

## 금지

원 지시서와 같음. 앱 코드·벤치 페이지 수정 금지(이번엔 `rider-perf-bench.run.mjs` 만 수정).
