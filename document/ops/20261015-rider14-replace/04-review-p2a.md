# 감리 P2a — 모델 프로필 · meshopt · Float32 · 레지스트리

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-15 · Supervisor (Claude) |
| 대상 | [03-result-p2a.md](03-result-p2a.md) |
| 판정 | **APPROVED — 보정 3건은 P2b 에 묶어 처리** |

## 독립 확인

- 소스 diff 전량 검토: 리그 수학(IK·DQS·`RIG` 관절·`FOOT_PITCH_DEG`·크랭크 위상/반경 식) **불변**. s5 그룹 판정 코드는 문자 그대로 이전, `centerOfNamedMeshes` 는 Vector3 → 스칼라 min/max 로만 바뀜(같은 값, fixture 1e-9 대조).
- Supervisor 재실행: rider 시험 14/14, 계약 5/5, `tsc` 0.
- 캡처 `rider14-z22.png`: 세 라이더 정상 자세. 1명당 **14 콜 / 29,604 삼각형** (s5 213 / 53,514).
- `clone.userData` 복사(extras 소실 방지)는 타당한 발견. 공유 참조지만 읽기 전용이라 수용.
- "210 vs 213": 213 은 메시(primitive 단위 Mesh 객체) 수, 210 은 계획 F2 의 노드 기준. 회귀 아님.
- `test:quick` route 실패 3건(functions 미빌드)은 범위 밖. P6 에서 functions 빌드 후 전체 재확인.

## 보정 (P2b 에서 함께)

1. `preservedRiderRig.ts` 의 `import … from "./riderVisualKit.ts"` — `src` 전체에서 유일한 확장자 import. 저장소 관례는 Node 시험에 `--import ./scripts/s42/register-vite-env.mjs` 로더(확장자 해석 + `import.meta.env` 주입)를 쓰는 것. **확장자를 지우고 시험 명령에 로더를 붙인다.**
2. `config.ts` 의 `(import.meta as unknown as {…}).env?.DEV` — 로더가 env 를 주입하므로 **`import.meta.env.DEV` 로 쓴다.** 운영 빌드에서 `riderModel` 쿼리가 무시되는지는 P6 빌드 산출물에서 확인한다.
3. 벤치 패널이 `riderModel=rider14` 에서도 s5 후보 ID 를 표시 → 실제 해석된 모델·candidateId 를 표시.
4. (추가) `package.json` 에 `test:rider-preserve` 스크립트를 만들어 rider 시험 전부를 로더와 함께 한 번에 돌린다.
