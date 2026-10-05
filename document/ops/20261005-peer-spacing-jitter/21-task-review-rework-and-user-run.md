# 검수 재작업 및 사용자 테스트 준비

Codex · 2026-10-05. 20은 구현 제출이며 아직 승인하지 않는다. Chief가 계속 진행 및 검증된 워크트리 path/실행 명령 안내를 요청했다. 제품/시험 수정은 Cursor 담당. 타 작업 보존, 주기 유지, commit/push/deploy 없음, 지시19 시간 상한 유지.

## 실제 diff에서 확인한 필수 재작업

1. `common-display-product-harness`가 selfSample을 pending 원격 도착 이벤트에서 넣고, stall이면 자기 표본도 중단한다. 실제 fanout은 enqueue 직후 local 자기 표본을 넣는다. 이것이 stall 일치0을 인위적으로 만든다. 실제 enqueue/capture path를 시험하고 local self 표본은 송신 시 가용, peer만 delivery/drop하도록 수정. 0.1m rounded debugSnapshot 대신 실제 raw entity/render 값으로 간격/프레임 지표를 측정. accel의 거리 도함수에 맞는 snapshot 속도를 입력한다. 제품 import만 하고 수작업 경로가 제품과 다르면 '제품 경로 PASS'라 쓰지 않는다.
2. `Registry.step`은 commonNow를 각 entity의 별도 renderClock에 전달하고 self는 별도 catchupClock이다. join/leave 전환 및 프레임 호출 순서에서 같은 renderTime이 아니다. 중앙 단일 frame renderTime을 실제 MapView self·peer·camera가 소비하도록 연결한다. hook sample은 delay0일 때 clock을 아예 갱신하지 않아 leave에 즉시 raw로 점프한다. D0↔600 전환과 solo 안정상태0 모두 재현/수정. React liveForMap 카메라 경로가 raw로 덮어쓰는지 App/MapView 소비부 전체 확인. reset 후 companion flag 소실도 시험한다.
3. 서버축 peer의 paused/completed가 즉시 newest 위치로 snap하며 self는 600ms 과거다. serverTimeline에서는 phase/속도도 capture시점으로 처리해 불일치/튐을 막고 구버전 정지/liveness 계약 보존. self 버퍼는 raw dist/speed이나 peer wire는 0.1m/0.01mps quantization이다. 동일 canonical encode표본을 자기에도 사용. queue coalescing/dropped send에서 자기만 가진 표본이 상대와 크게 어긋나는지 실제 flight시험. 서버축↔legacy 전환 시 혼합 buffer 축 reset/rebase 계약 구현/검증.
4. offset 미준비/큰jump/재접속 및 경로/정지/resume/FS-only/구버전/한 방향 stall 시험이 20에 빠졌다. actual clock state 적용으로 시험하고 정확히 미실행/FAIL을 보고. clock jump를 캐시 flag만으로 처리하고 old/new buffer 혼용하지 않는다. '불확실'을 보고서에만 적은 경우 제품 상태처리라고 쓰지 않는다.
5. `npx tsc -p tsconfig.json --noEmit`은 solution root가 references/files[]면 하위 project를 검사하지 않는다. scripts를 확인하고 실제 `tsc -b` 또는 app project typecheck와 변경파일 lint 실행. RULES 시험은 regex계약인지 emulator평가인지 명시. 운영 기존 Rules는 `$other:false`가 없어 optional tSrv 허용 가능하므로 '배포전 반드시 거부'를 단정하지 않는다. 실제 동작 근거와 필요한 환경을 정리한다.

## 사용자 실행 준비

검수에 충분한 수준까지 수정/재생 완료 후 결과22에 정확한 checkout/worktree 절대 path, 브랜치, PowerShell 실행 명령, URL/포트와 모드, 2개창 같은Trail 테스트 절차(등속→속도변화→정지/resume, 각10~15초), 예상 자기/카메라600ms·HUD즉시·solo0를 작성한다. 두 창 모두 새 코드인지 확인 가능하게 한다. package scripts/vite config/환경파일 존재만 확인(비밀 출력 금지)해서 재현 가능한 명령을 검증한다. 다른 작업 섞인 현재 checkout을 깨끗한 전용worktree라고 부르지 않는다. 별도 test checkout 필요 시 supervisor에 구체 제안. 네트워크/배포 권한이 없어도 local emulator나 dev 경로를 먼저 완성한다. 필요 브라우저 관측은19 상한 내로만.

결과 `22-result-common-display-rework.md`: 각 항목 변경/시험/한계, raw JSON, 실제 tsc/lint, publish 횟수/encode비용, 사용자 실행 안내. 이전20 기록 보존. READY_FOR_REVIEW는 제품 경로 게이트로 판단하며 모델exit0만으로 합격하지 않는다.
