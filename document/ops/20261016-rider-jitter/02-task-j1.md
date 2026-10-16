# 지시 J1 — 라이더 앞뒤 떨림: 원인 조사 + perflab 떨림 지수

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 작업 위치 | `C:\20.HDev\boxcycle-jitter` (브랜치 `fix/rider-jitter`, 기준 `main2` `a4585f2`) |
| 결과 파일 | `C:\20.HDev\boxcycle-jitter\document\ops\20261016-rider-jitter\03-result-j1.md` |

## Chief 관찰 (사실)

- 주행 중 **페이서와 실제 동행 라이더 모두** 진행 방향으로 앞뒤 "툭툭툭툭" 진동한다(오래된 문제, 동행 fanout 간격을 매우 짧게 했을 때 사라진 듯했던 적이 있다).
- **PC 에서는 페이서 떨림이 확실히 보이고, 스마트폰에서는 페이서 떨림이 없다.**
- 페이서는 네트워크를 거치지 않고 로컬에서 계산된다 → 네트워크만의 문제가 아니다.

## Supervisor 가설 (검증할 것)

H1. **화면 주사율 맥놀이**: PC 모니터 120–165 Hz 와 폰 60 Hz 차이. 고정 간격으로 갱신되는 값(자기 위치 샘플러·세션 틱·페이서 월드 스텝 등)과 rAF 마다 계산되는 값이 섞이면 주기적 앞뒤 튐이 생긴다.
H2. **시계 혼용**: `Date.now()`(정수 ms, 브라우저에 따라 거칠게 반올림)와 `performance.now()`/rAF 타임스탬프가 위치 보간·외삽에 섞여 있다(예: `PeerMotionRegistry` step 의 `Date.now()`).
H3. **카메라 추종과의 상대 운동**: 카메라가 본인을 스무딩해 따라가는데 페이서·동행 위치는 다른 시계로 계산 → 화면상 상대 위치가 흔들림.

## 할 일

1. **코드 추적(읽기)**: 매 프레임 본인·페이서·동행의 화면 위치가 정해지는 경로를 끝까지 따라가 시간 근원을 표로 정리한다 — `MapView.tsx` 주행 틱(`tickBody`, `sampleLiveLngLatRef`, `sampleLiveDistMRef`, `stepPacerWorld`, `resolvePacerDistM`, `stepPeerDriveAndBuildGeoJson`), `lib/peerMotion/*`(`selfDisplayBuffer`, `integrator`, `PeerMotionRegistry`, `commonDisplayClock`), 카메라 `tickRideCameraFollow`. 각 값이 **어떤 시계(rAF ts / performance.now / Date.now)로, 어떤 주기(매 프레임 / 고정 Hz / 패킷 도착)로** 갱신되는지.
2. **재현**: 헤드리스로 rAF 주기를 바꿔(예: Playwright CDP `Emulation.setCPUThrottlingRate` 대신 페이지에 `requestAnimationFrame` 을 감싸 강제 간격 6.9 ms(144 Hz)·16.7 ms(60 Hz) 로 호출하는 init script) 주행을 돌리고, 페이서의 프레임당 경로 거리 변화(자기 대비 상대 거리와 절대 거리)를 기록. 144 Hz 에서만 앞뒤 역행·속도 들쭉날쭉이 생기는지.
3. **perflab 떨림 지수**(운영 `?perflab=1` 에서만, 쿼리 없으면 비용 0 — F1 규칙 그대로): 렌더 spec 마다(id·kind) 매 프레임 경로 거리(본인 `distM`, 페이서 `along`, 동행 `displayDistM`)와 rAF 시각을 10 s 창에 기록 → 라이더별 `역행 프레임 수`, `최대 역행 m`, `속도 변동계수(프레임 속도 표준편차/평균)`, `본인 대비 상대 거리 변동(표준편차 m)`. 패널에 라이더별 한 줄, 복사 JSON 에 포함. MapView 에서 spec 을 만드는 곳에 측정 훅 한 줄(쿼리 없으면 즉시 반환).
4. **원인이 확정되면 수정안을 제시만** 하고(코드 수정은 다음 지시), 확정되지 않으면 어떤 추가 측정이 필요한지 적는다. 단, 3번 계측 코드는 이번에 구현한다.

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, `npm run test:quick`(worktree 의 route 3건 `functions/lib` 부재 실패는 환경), `npm run test:pacer`, `npm run test:peer-spacing`(있으면), `npm run test:rider-preserve`, `npm run build`. 계측 함수 단위 시험(역행·변동계수 계산). dev 서버 5070, 끝나면 종료.

## 결과 파일

시간 근원 표, 재현 결과(60/144 Hz 수치), 가설 판정, 수정안, 변경 파일, 명령 exit code.

## 금지

동행 동기화·페이서·카메라 **동작** 변경(계측 훅 추가만 허용), 쿼리 없는 운영 동작 변경, commit · push · 배포, 백그라운드 잔류.
