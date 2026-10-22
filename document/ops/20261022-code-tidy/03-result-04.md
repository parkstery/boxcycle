# 결과04 — P1 죽은 코드 (감리 대필)

2026-10-22 · 담당 opencode GLM-5.3-Flash · 감리 Claude

- 실행자가 목록을 **전부 처리한 뒤** 결과 파일을 쓰기 직전에 opencode 무료 사용 한도(`Free usage limit reached`)로 끊겼다. 이 파일은 감리가 대신 쓴다.
- 목록 대조(감리 스크립트, 선언·export 잔존 검사): **92/92 처리 완료**.
- **결함 1건(감리 수정):** `lib/map/mapGlobeView.ts` 에서 아직 쓰이는 `import { RIDER_GLB_MODEL_BASE_SCALE }` 까지 지워 tsc 오류(TS2304). 감리가 import 한 줄을 되살렸다. 규칙 「같은 파일에서 새로 안 쓰이게 된 것만 지운다」 위반.
- 검증은 P1 통합 감리([04-review-p1.md](04-review-p1.md)) 참조.
