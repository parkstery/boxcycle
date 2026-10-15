# 감리 P1 — rider14 자산 스테이징

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-15 · Supervisor (Claude) |
| 대상 | [03-result-p1.md](03-result-p1.md) |
| 판정 | **APPROVED — G1 통과** |

## 독립 재확인 (Supervisor 직접 `sha256sum`)

| 파일 | SHA-256 | 기대값 대조 |
|---|---|---|
| `candidates/20261015-212136-df8de090/rider.glb` | `df8de090…e5d4fe54d` | = 계획 §1 LOD0 meshopt |
| `candidates/20261015-212136-df8de090/guide-weights.json` | `136895c8…ee840dca` | = s5 가이드 |
| `candidates/20261015-212136-df8de090/candidate.json` | `9ed9ab5c…3b79cd` | 내용 = 지시 형식(schemaVersion 2, nickname/profile rider14) |
| s5 `candidates/20260921-041426-cd81398e/rider.glb` | `1108aa3e…6b1ffb` | 불변 |
| 원본 `source\roadcyclist_s6_wheelfix_merged.glb` | `aeefb4d2…a1d33b9e`* | 불변 |

\* 전체 값 `aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70`.

- 스크립트 `stage-rider14.mjs`: 해시 선검증 → 기존 폴더 거부 → `copyFileSync` → 사후 해시, 불일치 시 **자기가 만든 대상 폴더만** 삭제. 재export·후처리 없음.
- 실패 경로 2건(덮어쓰기 거부, 없는 원본) 결과 인정.

**rider14 candidateId 확정: `20261015-212136-df8de090`** — P2a 의 `PRESERVED_RIDER_MODELS.rider14.candidateId` 에 쓴다.
