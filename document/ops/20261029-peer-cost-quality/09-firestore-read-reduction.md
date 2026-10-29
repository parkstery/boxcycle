# Firestore 읽기 저감 — 자기 문서 서버 제외

작성: 2026-10-29. 설계·구현·시험·검수: **Codex 직접**, 하위 agent·외부 구현자 없음.

## 이번 적용과 판단

Chief는 Firestore 읽기 비용 저감과 동행 표시 품질·장애 복구 유지를 지시했다. 이번 변경은 기존에 모든 소비자가 수신 후 제외하던 자기 uid 문서를 **Firestore 쿼리에서 제외**한다. 데이터 모델·Rules·색인·저장 주기·타인 표시 의미는 유지한다. 해당 범위는 지시 안에서 자율 구현할 수 있다고 판단했다.

`livePublicationRides`의 동행·Trail 관전·세계 지도 소비자 세 곳이 동일한 `documentId() != myUid` 쿼리를 공유한다. hub 키는 Trail과 제외 uid의 쌍이다. 같은 viewer의 세 소비자가 구독을 세 개 만들지 않으며, 계정 변경 때 다른 viewer의 캐시를 넘기지 않는다. uid가 없는 기존 호출은 전체 조회 계약을 유지한다.

**정상시 Firestore 구독을 해제하는 방식은 적용하지 않았다.** 끊긴 RTDB를 감지한 뒤 Firestore를 새로 붙이면 초기 조회 지연이 기존의 즉시 사용 가능한 백업보다 길 수 있다. 현재 관측된 큰 수신 공백 문제를 가진 상태에서 이를 품질 무손실로 판정할 수 없다. Firestore의 타인 구독은 계속 열어 둔다.

유지 항목: RTDB 목표 200ms·거리 0.01m·실제 표본시각, Firestore 4초 기록과 정지·완주 burst, 공통 표시 시계·600ms 지연·외삽 상한, peer 발견·이름·타인 수·삭제·재합류·권한 오류·재연결. UI 디자인 변경 없음.

## 효과를 해석하는 범위

실제 Firestore emulator와 별도 SDK writer/viewer를 사용했다. 자기 uid 문서를 원격에서 20회 갱신했을 때 기존 전체 조회는 문서 변경 20건·콜백 20회, 제외 쿼리는 둘 다 **0**이었다. 최초 빈 결과 동기화는 이 집계에서 뺐다. [원시 결과](evidence/firestore-self-exclusion-emulator.json).

이는 서버 조회 범위와 원격 전달 감소의 증거다. 같은 SDK의 로컬 쓰기 알림·캐시와 청구는 다르며 **20→0을 운영 비용 100% 감소로 해석하지 않는다.** 4초 쓰기 약900회/시간, Rules의 쓰기 의존 읽기, Functions, 세션 멤버, 세계 collectionGroup 등 다른 읽기는 유지된다. 빈 쿼리도 최초 실행·재연결에는 최소 읽기 비용이 있다.

특히 타인끼리의 `900 × N × (N−1)`/시간 수준 위치 fanout은 이번에도 남는다. 이 변경은 자기 문서 재수신 범위를 제거한 단계이며 **Firestore 다인 비용 문제 전체의 종결이 아니다.** 이전 RTDB bytes 감소율도 Firestore 절감률로 합산하지 않는다.

공식 근거: [Firestore 과금](https://firebase.google.com/docs/firestore/pricing) — 결과 문서 갱신·최소 쿼리·재연결·Rules 의존 읽기, 하나 이하 range field 쿼리의 index-entry 과금 예외. 이번 쿼리는 documentId 하나의 부등식이며 새 복합 색인을 추가하지 않는다.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`.

| 검증 | 명령·결과 |
|---|---|
| hub 공유·viewer 캐시 격리·해제·오류 | `node scripts/test-quick.mjs meters` — 59 PASS / 0 FAIL |
| 표시·소스 전환 재생 | `node --test scripts/peer-sync/live-ride-query-fallback.test.mjs` — 4 PASS / 0 FAIL |
| 실제 Firestore 쿼리·Rules·재연결 | 아래 emulator 명령 — 1 PASS / 0 FAIL |
| 타입 | `npx tsc -b --pretty false` — PASS |
| 제품 빌드 | `npm run build` — PASS, 기존 large chunk 경고 |
| 변경 소스 ESLint | 0 error·9 warning. 기존 overlay hook 의존성과 eslint-disable 경고이며 해당 구간 수정 안 함 |
| 도메인 방향 | 루트 `node scripts/check-dep-direction.mjs --check` — 신규 query 파일 등록 후 PASS, 방향 위반·순환 0 |
| 전체 빠른 시험 | 커밋 스냅샷 `node apps/web/scripts/test-quick.mjs` — **1454 PASS / 0 FAIL**, 4 TODO(기존), 5파일 제외 중 FS emulator 별도 1 PASS |

재생은 기존 `syncPeerMotionFromPresence → PeerMotionRegistry.step` 제품 코드로 정상·RTDB 무응답·명시적 오류·Firestore 단독을 각각 22초 실행한다. 자기 Firestore 갱신 콜백이 제거되는 조건도 포함했다. 각 20ms 프레임의 **반올림 전 표시 거리**와 연속 중복을 제거한 실제 선택 패킷을 기존과 비교해 전부 동일했다. RTDB 정상 주기·보간 알고리즘을 수정하지 않아 새 보간 그래프는 만들지 않았다.

emulator에서는 원격 타인의 주행·일시정지·재출발·완주·publication 변경 6개 사건과 삭제·재합류·viewer offline/reconnect를 검사했다. 매 사건의 문서와 Firestore-only fallback 패킷의 거리·phase·원본 시각이 동일했다. 타인 uid 쓰기를 실제 현행 Rules가 거부하는 negative assertion도 통과했다. 로그의 PERMISSION_DENIED는 이 의도된 시험이다. 운영 DB에 시험 쓰기를 하지 않았다.

재실행:

```powershell
cd C:\20.HDev\boxcycle\apps\web
node --test scripts/peer-sync/live-ride-query-fallback.test.mjs
node scripts/test-quick.mjs meters
New-Item -ItemType Directory -Force .out | Out-Null
$fsReadConfig = @{firestore=@{rules='C:/20.HDev/boxcycle/firestore.rules'};emulators=@{firestore=@{host='127.0.0.1';port=8089};ui=@{enabled=$false};singleProjectMode=$true}}
$fsReadConfig | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 .out/fs-read-emulator.json
& 'C:\Users\kdrea\AppData\Roaming\npm\firebase.cmd' emulators:exec --only firestore --project demo-peer-fs-read --config .out/fs-read-emulator.json "node --test scripts/peer-sync/live-ride-query.emulator.test.mjs"
```

초기 시도 `node --import tsx ...`는 설치되지 않은 tsx 때문에 실행 실패했다. 저장소의 Vite 등록기를 사용하는 정식 quick runner로 대체해 통과했다. 개발 부산물 게이트는 작업 트리에 타인이 추가한 미등록 `scripts/handoff-check.mjs` 때문에 FAIL했다. 해당 파일을 삭제하거나 이 작업에 포함하지 않으며, 릴리스 스냅샷에서 이 변경만의 게이트를 별도 확인한다.

## 남은 핵심 작업

1. 운영 Firestore reads를 앱 종료 기준 구간·1인·2인·종료 후로 나눠 확인한다. 변경 콜백 수를 청구 reads로 치환하지 않는다. Chief에게 눈으로 장시간 라이딩할 것을 요구하지 않는다.
2. 큰 폭의 타인 fanout 저감은 상시 사용 가능한 백업을 별도로 유지하면서 설계해야 한다. 후보는 서버가 여러 라이더의 백업을 제한된 주기로 묶어 전달하는 방식이다. hot document·문서 크기·읽기/쓰기 단위·추가 서버 비용·원본 표본시각·정지/완주·장애 독립성을 검증해야 하며, 이번 자기 문서 제외에 섞지 않는다.
3. 기존 RTDB/양 소스 4초 공백에서의 3.3m/4.6m 진단 실패는 여전히 미해결이다. 이번 전후 동일성 PASS가 해당 증상의 해결을 뜻하지 않는다. 운영 표시·운영 청구 절감률은 이번 로컬 시험으로 확정하지 않았다.

## 릴리스 상태

제품·시험·최초 보고서 로컬 커밋: `36d6d728`. 타인의 미커밋 UI·슬림화 문서는 포함하지 않았다. 전체 시험 첫 실행은 1453 PASS·1 cancelled(timeout)·4 TODO, exit 1로 **미통과**였다. 원인은 변경하지 않은 `scripts/identity/entry-location-dom.test.mjs`의 초기 위치 UI 시험 60초 timeout이며, 전체 결과를 단순 1453/0으로 합격 처리하지 않았다.

`.out/fs-read-release-36d6d728`에 해당 커밋만 추출한 결과, 전체 시험 **1454 PASS / 0 FAIL**, 4 TODO(기존), exit 0·79.3초다. 처음 시간 초과한 초기 위치 UI 시험도 통과했다. 개발 부산물 게이트 PASS·WARN 0. 작업 트리의 미등록 handoff 도구 실패와 구분했다. 격리 스냅샷의 `npm run build`도 PASS, main bundle `index-qovLMWuI.js`. 푸시·Hosting 결과는 완료 후 기록한다.
