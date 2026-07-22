# peer-sync Replay 하네스 — 도구 사용법 (HOW)

이 폴더(`apps/web/scripts/peer-sync/`)는 동행 peer 위치 동기화(보간)를 **실주행·앱 구동 없이**
패킷 로그로 재생·검증하는 오프라인 하네스다. **언제·왜 쓰는가**는
[`.claude/skills/peer-sync/SKILL.md`](../../../../.claude/skills/peer-sync/SKILL.md)를 보라 — 이 문서는 **어떻게 쓰는가**만 다룬다.

핵심: 검증 대상 순수 함수(`src/lib/peerMotion/integrator.ts`·`mergePackets.ts`·`rideSyncPolicy.ts`)를
**vite `ssrLoadModule` 로 소스 그대로 로드**한다. 그래서 하네스가 통과시키는 코드 = 프로덕션이 실제로 도는 코드.
별도 컴파일·목(mock) 없음. 모두 `apps/web/`에서 실행.

## 파일

| 파일 | 역할 |
|---|---|
| `replay.mjs` | 오케스트레이터 — 시나리오를 재생 → `--check`(불변식, exit 0/1) + `--graph`(PNG) |
| `scenarios.mjs` | 내장 시나리오(패킷 이벤트 시퀀스). `expectFail` 로 known-fail 회귀 고정 |
| `invariants.mjs` | 재생 타임라인의 기계적 PASS/FAIL 판정(clamp·역행·순간이동·외삽상한) |
| `graph.mjs` | distM-vs-time SVG 생성 + chromium PNG 렌더 |
| `.out/` | 그래프 산출물 PNG/SVG(gitignore — 휘발성 검토용) |

## 실행

```bash
cd apps/web && node scripts/peer-sync/replay.mjs [--check] [--graph] [--scenario <name|path>] [--out <dir>]
```
- 무옵션 = `--check --graph` 둘 다.
- `--check`: 전 시나리오 불변식 판정. known-fail 외 위반이 있으면 exit 1. 커밋 전 게이트로 쓴다.
- `--graph`: `.out/peer-timeline.png`(+svg) 생성. **Read 툴로 PNG 를 열어** 파란선(보간)이 회색점(수신 패킷)을 ~DELAY 뒤에서 매끄럽게 따라가는지 눈으로 본다.
- `--scenario <name>`: 내장 시나리오 하나만. `<path>`(json)면 외부 로그 재생.

출력 기호: `✓` 통과 · `✗` 위반(실패) · `~` known-fail(예상된 위반, 통과 처리) · `!` known-fail 인데 통과(고쳐졌으니 `expectFail` 제거하라는 신호).

## 시나리오 추가 (회귀 고정)

새 sync 결함을 만나면 그 패킷 시퀀스를 `scenarios.mjs` 에 추가한다:
- 이벤트 = `{ atMs, packet }[]`. `atMs` = 수신 측 시계(Date.now) 기준 ms. `packet` = `PeerMotionPacket`(`src/lib/peerMotion/types.ts`).
- 등속 구간은 `steady({...})` 헬퍼로. 불연속·정지·완주는 그 뒤에 이어 붙인다.
- **아직 안 고친 버그**면 `expectFail: true` 를 달아 known-fail 로 고정 → CI 는 통과, 고쳐지면 `!` 로 알림.

실주행 로그를 재생하려면 `PeerMotionPacket` 배열을 `{ name, routeLenM, events:[{atMs,packet}] }` JSON 으로 만들어 `--scenario <path>`.

## 시간 주입 방식 (주의)

`applyPeerMotionIngest` 는 내부에서 `Date.now()` 를 `recvAtMs` 로 쓴다. 재생 결정성을 위해
`replay.mjs` 가 재생 중 전역 `Date.now` 를 이벤트 시각으로 스텁하고 끝나면 복원한다(소스 무수정).
`stepPeerMotionEntity` 는 `nowMs` 파라미터로 직접 주입한다.

## 미구현 (하네스 확장 TODO)

- **mergePackets 재생 미포함**: 현재 시나리오는 이미 병합된 단일 패킷 스트림만 넣는다. RTDB(10Hz)+Firestore(1Hz) **이중 스트림 병합**(`mergePeerMotionPackets`)의 clock 혼용 버그는 아직 재생 안 한다 — 두 소스 이벤트를 각각 넣고 merge 를 태우는 시나리오 타입 추가 필요.
- **R2 reconcile(soft/hard pull) 미검증**: 자기 위치 보정(`PEER_RECONCILE_*`)은 이 하네스 범위 밖.
- **알려진 미해결 버그**: `stationary-dedup`(정지 peer ~7m 오버슛)은 `expectFail` 로 고정만 됨. 근본 수정은 별도 작업.
