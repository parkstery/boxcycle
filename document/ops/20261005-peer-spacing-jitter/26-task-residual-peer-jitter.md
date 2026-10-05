# 사용자 확인 후 남은 peer 앞뒤 튐 수정

Codex Supervisor · 2026-10-05. Chief 실제 테스트: **원하는 수준의 양쪽 동기화 확인, 위치 역전 없음. 다른 라이더 앞뒤 튐은 남음.** 기존 승인된 공통600ms를 보존하고 남은 결함만 조사·수정한다. 구현은 Cursor CLI, 검수는 Codex. 타 작업 보존. 송신200ms/FS4초 및 구독횟수 증가 금지. commit/push/deploy 없음.

사용자 이미지: localhost:5000 같은Trail, 표시 속도 대략5~6km/h의 저속 두라이더. 정지사진만으로 패킷원인을 확정하지 않는다. 사용자 확인은 동기화 항목만 APPROVED_BY_CHIEF, smoothness는 FAIL/REWORK로 기록한다. 최신25검수 및19/21, peer-sync SKILL/HARNESS 읽고 진행한다.

## 필수 순서

1. **수정 전 재현부터.** 현재 common-display 제품하네스가 RTDB-only 정상20km/h 중심이며 순서만gate한다. 실제 FS4초+RTDB200ms→select→stamp→ingest→frame→렌더 rawdist 경로를 5/6kmh(비슷한 두속도), 등속20, 저속정지→resume에서 재생한다. FS앞선capture/commit, RTDB지연/번들/중복/차단/재개, late표본 및 단방향공백을 포함. 자기 raw UI 아니라 같은 canonical 표시 거리와 peer 상대거리의 pp·역행·프레임 속도/가속·source/축전환을 함께 로그한다. true상대거리 drift(5vs6)가 진동으로 계산되지 않도록 truth/canonical gap residual을 사용한다. 원인별 최소 재현을 확보하고 BEFORE 증거 남긴다.
2. 우선 조사할 코드 증거(가설이며 확정아님):
   - FS가신선도/거리앞섬으로 선택되면 serverTimeline↔legacy로바뀌어 buffer clear/rebase된다. 사용자사진의 수m급튀기와4초주기의상관을 시험한다. 단순FS무시/안전fallback파괴금지. 신뢰가능RTDB capture축을 유지하면서 FS복구fallback이필요할때 연속적으로전환.
   - `applyPeerMotionIngest`가 순서검증전에 entity.speed/phase/liveness를 갱신하고 distance-only dedup한다. 늦은/동일거리 표본의속도로외삽점프하거나 저속양자거리중복을 drop해 보간공백을만드는지 시험. tSrv가새로증가하면서 같은dist여도 유효motion표본인지 legacy재배달과구분한다. 정지0을받고recv간격속도유도하는기존계약과서버축정지계약구분.
   - 서버축peer outer correction/catchup이 자기선형보간과달라 같은표본에서도 상대만벌어지는지; buffer의srcAtMs와offset변화/axis reset이앞뒤점프를만드는지. 이결함이없으면없다고보고.
3. 재현에 맞는 **좁은 수정**. 이미 사용자확인한공통시계/D600과HUD즉시/solo0를보존. snap임계/tolerance완화나주기축소/임의smoothing상수만으로가리지않는다. legacydedup/liveness정지/fallback도퇴행없도록검증.
4. 실제render프레임에서같은localNow를self/peer가사용하는지; Reactraw/liveForMap로GLB/카메라정기덮어쓰기를하는다른경로도정적계약/필요짧은관측으로확인. 네트워크거리튀기와카메라/메시transform튀기를구분.
5. 변경된 실제제품경로를재생하고 **smoothness/상대간격residual gate**를추가한다. gate가이전코드에FAIL하고수정후PASS하는근거(가능하면순수함수버전비교/안전mutation)를남긴다. 저속과등속의pp및maxjump/framevelocity/역행숫자를raw로제시. 단순전체exit0나순서0은smoothness해결증거가아니다. 기존공통순서와peer-spacing회귀,해당fallback/liveness/실제tsc-b/lint검증. 미해결공백/clockjump는정상시험과구분하고기존미해결을조용히합격으로처리하지않는다.

## 시간/사용자테스트

오프라인가상시간우선. 각명령120초상한,가상수십초를실시간기다리지않는다. 브라우저필요하면최대30~60초관측/전체180초/단일worker,진전없이60초면중단진단. 불필요하게긴주행금지. 운영로그가없어사진원인확정을못해도재현가능한코드결함은수정하고확정범위를명시한다.

결과 `27-result-residual-peer-jitter.md`: BEFORE/AFTER최소재현·수정diff·gate·명령exit/경과시간·순서회귀·트래픽불변·남은한계, 사용자현재path/명령과재시험방법(각10~15초,양쪽같은새코드). 원시JSON남긴다. README/PROGRESS사용자동기화확인과smoothness재작업구분. 필요하면원시시계/source상태를기존DEV진단으로노출하되새트래픽/개인정보로그추가금지.
