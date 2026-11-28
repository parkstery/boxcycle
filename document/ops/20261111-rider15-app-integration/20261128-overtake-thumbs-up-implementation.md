# 추월 동행 엄지척 구현

2026-11-28 · Codex 하위작업 thumbs_up. 커밋/푸시/배포 수행 안 함. App 연결·HANDOFF·최종 통합은 메인 담당.

## 동작

같은 Trail 렌더 시계의 self/peer 진행거리 차이가 뒤2m→앞2m로 변하고 상대속도 양수인 경우8초 동안 이름+👍 단추 표시. 렌더 보간과 별개인 검출기로서 새합류·순간점프·수신2초 초과·역방향·실제gap변화와 속도 불일치를 제외한다. 한상대 재노출30초. 동시 추월은 실제zero-cross 시각→근접gap→uid 순으로 결정한다. 버튼 표시 중 다른 후보로 대상을 바꾸지 않고 클릭 시 대상 고정.

RTDB `/trails/{trailId}/thumbsUp/{targetUid}/{senderUid}`에 최신 이벤트 슬롯을 쓴다. UI8초TTL·eventId중복방지·latest20/createdAt8초 query. 수신자 본인만 읽고 발신자는 자기uid로만 쓴다. 동일코스motion.p·live·서버시각15초 이내 및 미래1초 상한, 쓰기3초 간격·8초TTL/최대10초·필드화이트리스트 검증. 논리만료이며 슬롯의 물리TTL 삭제는 없음(발신자당 최신1슬롯); query가 만료 과거슬롯을 읽지 않는다. 상시 추가구독은 수신자자신의짧은이벤트 경로1개. 송신1write·서버offset확인, 상대 슬롯당최신overwrite. Rules 기본+유럽 둘 다 반영 필요.

송신 성공 뒤 본인 `live-self`, 수신 시 발신uid 아바타의 실제 기존LookThumb 클립과 토스트를 재생한다. 닉네임은 이벤트senderName을 신뢰하지 않고 기존동행uid→label을 사용, 확인불가면동행라이더. 경로 중앙에겹친모델만으로 실제좌우통과를확정할수없어기본오른쪽을사용한다. 급커브15도 이상/원거리정적LOD면 제스처를 취소하고나중에뒤늦게재생하지 않는다. 자산미준비시에도수신알림은유효하지만늦게로딩된클립은당시이벤트를재생하지않는다.

제스처는 head/neck·clavicle·팔/손 quaternion만 별도샘플. 골반·다리·페달·바퀴와전신코너롤은보존한다. 기존mixer가동일위상재요청에서쓰기생략하는특성을고려해이전상체오버레이를먼저걷고기본주행을평가한다. 중단/종료/Trail전환은런타임제스처·후보정리.

## 검증

- 추월검출3/3 PASS: 정상뒤→앞1회, 새합류/보정/역방향/낡은수신거부, 동시추월입력순서독립.
- 실제GLB리그1/1 PASS: 좌/우팔움직임·하체/크랭크/바퀴위상보존·그립복귀. 초기그립복귀실패는mixer동일위상쓰기생략에의한오버레이잔존으로수정후통과.
- peer-sync replay --check:19시나리오전부PASS. Registry에는읽기전용신선도helper만추가, 위치적분·패킷·보간정책수정없음.
- 실제auth/database Rules+송수신통합1/1 PASS(1433ms): 비인증/타인읽기·발신uid위조·만료/과긴TTL·다른코스·미래sender/target시각·paused쓰기거부, 정상송신/수신·슬롯덮어쓰기onChildChanged·eventId중복억제·unsubscribe·재접속만료제외.
- 새소스/시험 lint오류0·경고0. 통합빌드최종검증은메인담당.

Rules시험중 `.info/serverTimeOffset`를get으로조회하면RTDB가Invalid token in path를내는실제문제를발견해onValue onlyOnce로변경했다. 첫fixture REST owner는query가아닌Authorization Bearer owner로접근해야했으며시험준비코드수정후PASS.

Chief지시대로주행/브라우저시험은이작업에서실행하지않았다. 두계정실주행최종확인과모델화면자연스러움은Chief확인대기.
