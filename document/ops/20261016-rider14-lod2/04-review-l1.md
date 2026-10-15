# 감리 L1 (+ L2 간이) — LOD2

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 대상 | [03-result-l1.md](03-result-l1.md) (Cursor) |
| 판정 | **APPROVED (브랜치 커밋)** — 운영 배포는 Chief 육안 후 |

- 소스: LOD0 `ready` 뒤 LOD2 백그라운드 로드(generation 검사·실패 시 LOD0 유지), `shouldUseRiderLod2 = lod2Ready && !animatePose`, 줌 < 19 에서 리그 숨김·정적 메시 표시·컬러 키트. 리그·흔들림·LOD0/s5 자산 무변경. 계약 문자열 유지.
- 재실행: `test:rider-preserve` 42 + 6 통과, 빌드 통과, `dist` 에 `rider-lod2.glb` 포함.
- **간이 성능(Supervisor, dev 5070 벤치, 3명 차분)**: 줌 22·19 = 14 콜 / 29,604 tri, **줌 17·15 = 1 콜 / 5,648 tri**, lod2State ready. (Cursor 전체 벤치는 생략 — Chief 시간 단축 지시)
- **줌 19 경계**: 18.9(LOD2) ↔ 19.1(LOD0) 나란히 `apps/web/scripts/rider-preserve/.out/lod2/pair-z19-boundary.png` — 크기·색(주황/청록/슬레이트)·위치 연속, 튐 없음. 히스테리시스 불필요로 판단.
- 메모: 포트 5060 은 Chrome 차단 포트(`ERR_UNSAFE_PORT`) — 이후 5070 사용.
- 미리보기 `lod2`: https://boxcycle-dc2df--lod2-l6mdti1n.web.app (만료 2026-10-23) — Chief 확인은 나중(지시).
