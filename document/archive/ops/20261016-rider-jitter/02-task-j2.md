# 지시 J2 — 떨림 수정 (표시 시계)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 근거 | [03-result-j1.md](03-result-j1.md) · [04-review-j1.md](04-review-j1.md) — 먼저 읽을 것 |
| 작업 위치 | `C:\20.HDev\boxcycle-jitter` (브랜치 `fix/rider-jitter`, J1 커밋 위) |
| 결과 파일 | `C:\20.HDev\boxcycle-jitter\document\ops\20261016-rider-jitter\03-result-j2.md` |

## 고칠 것 (J1 수정안 ①②③ 채택)

1. **표시 시계 입력을 rAF 기반 고해상 시각으로**: MapView `tickBody(now)` 가 프레임 시각 `epochMs = performance.timeOrigin + now`(소수 ms)를 한 번 계산해, 표시 시계(`ensureFrameDisplayRenderTimeMs`/`advanceSelfDisplayRenderTimeMs`), `sampleLiveDistM` 캐시 키, 동행 `registry.step` 의 `nowMs` 에 같은 값을 넘긴다. 서버 오프셋·패킷 `srcAtMs` 와 같은 epoch 축이므로 그대로 비교 가능해야 한다(`Date.now()` 와의 차이 ≤ 수 ms 임을 시험으로 고정). 이 값을 받지 못하는 호출(틱 밖)은 기존처럼 `Date.now()`.
2. **재사용 창 제거**: `FRAME_REUSE_MS = 8` 창 대신 "같은 프레임 세대(같은 epochMs 값)일 때만 재사용". 한 프레임 안의 여러 호출이 같은 값을 보도록.
3. **단독 주행 버퍼 전환 금지**: 동행 지연이 0 이고 모드 전환 catch-up 이 아닌데 시계가 한 틱 뒤졌다는 이유만으로 `isDisplayRenderCatchingUp` 이 참이 되어 `virtualDistance` 를 버퍼 보간으로 바꾸지 않게. 실제 catch-up(동행 지연·모드 전환)은 기존 동작 유지.
4. 숨은 탭 경로(`performance.now` 250 ms)는 건드리지 않는다.

## 시험

- `scripts/jitter/raf-beat-replay.mjs` 를 회귀 시험으로 승격(`test:quick` 포함되는 위치·형식): 60/120/144/165 Hz × 버퍼 있음/없음에서 본인·페이서 **절대 역행 0**, 카메라 대비 역행 0(또는 계획된 허용치 이하 — 0 이 아니면 이유와 값을 결과에 적고 Supervisor 판정).
- 기존 동행 시험 전부 통과 — `npm run test:peer-spacing`(pre-push 게이트, 동행 간격·소스 전환), peer 묶음, `test:pacer`. 실패하면 **완화하지 말고** 원인을 보고.
- 시계 시험: `performance.timeOrigin + now` 와 `Date.now()` 차이 작음, 같은 세대 재사용.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, `npm run test:quick`(worktree route 3건은 `functions/lib` 부재 — 환경), `npm run test:peer-spacing`, `npm run test:pacer`, `npm run test:rider-preserve`, `npm run build`. 재생 스크립트 수정 전/후 표를 결과에 나란히.

## 금지

동행 동기화 정책(fanout 간격·버퍼 길이·지연 정책) 변경, 카메라 τ 변경, 렌더·리그 변경, 기존 시험 완화, commit · push · 배포, 백그라운드 잔류.

## 추가 (2026-10-16, 실측 반영 — 이어서 진행)

이전 J2 실행은 시스템 메모리 부족으로 중간에 강제 종료됐다. 작업트리에 남은 미커밋 수정(`MapView.tsx`, `commonDisplayClock.ts`, `useVirtualRideSession.ts`, `raf-beat-replay.mjs`, `raf-beat-replay.test.mjs`, `test-quick.mjs`)을 **먼저 검토해 이어받고** 마무리한다. 브랜치는 main2(a726c3c, `dep-layers.json` 에 `debug/riderJitterProbe.ts` 등록)까지 앞으로 감았다.

Chief PC 실측(운영 `?perflab=1`, GTX 1660, Chrome 155):
- 프레임 간격 p50 20 ms · p95 30 ms · max 40–70 ms (20/30 ms 가 섞임, fps 47–53)
- **역행 0** (본인·페이서 모두)
- **속도 변동계수(speedCv)**: 본인 0.22 / 0.44, 페이서 0.23–0.59 → 이것이 눈에 보이는 "툭툭"
- 8 ms 재사용 창은 이 조건(프레임 20–30 ms)에서 작동하지 않는다 → 원인은 **시계 혼용**(위치는 Date.now 축, 화면은 rAF 축)으로 본다.

따라서 목표를 바꾼다:
- 재생 시험에 **불규칙 프레임 간격**(20/30 ms 무작위 섞임, 그리고 16.7/33.3 ms 섞임) 시나리오를 추가하고, 본인·페이서의 **speedCv ≤ 0.05**(속도 일정 주행) 와 역행 0 을 단언한다. 수정 전 값(재현)과 수정 후 값을 표로.
- speedCv 는 "그 프레임의 rAF 간격으로 나눈 이동 거리" 기준(perflab 정의와 같게).
- 동행 경로도 같은 시계로 바뀌는지 확인(패킷 재생 시나리오가 있으면 그 speedCv).
