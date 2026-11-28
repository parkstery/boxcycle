# 5/6kmh 저상대속 추월 엄지척 버튼 누락 수정

Codex 하위작업 thumbs_up · 2026-11-28. Chief 두계정 같은Trail 직접주행 스크린샷·엄지척단추누락 제보. 브라우저·실제주행시험은 실행하지 않음. 커밋/푸시/배포 안 함.

## 원인

기존 뒤2m→앞2m는5/6kmh 상대0.277m/s에서14.4초가필요한데, 매프레임fresh2초 또는단기속도검사가한번이라도실패하면뒤에있던이력을지웠다. FS4/12초간격에서는정상후보가사라진다. 또한단순fresh14초확대만으로는실제Registry12초출력의외삽→hold→보정구간에서화면gap미분과표시속도가불일치해여전히후보0건이었다.

거리는자기sampleLiveDistM이rideDistanceAlongRoute를거친geometry미터, 송신liveLocationSnapshot도동일변환후distMetersAlongRoute, RegistrydisplayDistM도같은geometry미터라단위/거리축문제는확인되지않았다. HUD0.38km는10m표시정밀도라정확한gap판정자료가아니다. pub/sub·active effect가매프레임재설정되는결함도없었다.

## 수정

- 관측뒤거리-0.5m, 확정앞거리+0.5m. 최초나란히gap0관측도실제단조전진/0.3초안정/+0.5m확정후허용. 처음부터앞인신규합류는배제, 정지좌표노이즈로즉시제안하지않음.
- 읽기전용getOvertakeEvidence는마지막수락패킷의원본거리·캡처시각·로컬수신시각·속도를제공. 동일패킷재수신은수신신선도를되살리지않는다. UI신선도는FS최대12초+도착여유2초. 위치적분/패킷/송신주기수정없음.
- sourceCapturedAt은같은동행의캡처축에서차이만비교하고, sourceReceivedAt은로컬Date.now축의신선도만판정. 같은패킷반복프레임을새이동증거로쓰지않음.
- 연속원본패킷의거리증가가속도적분과일치할때만정상FS따라잡기를허용. 이력이30초이내이고실제화면전진0.3초이상/+0.5m확정일때후보생성. 큰미검증점프·역방향·시계단절·과도한노후수신은폐기.
- 실제Registry140초회귀에서FShold보정이동일추월을84초에재노출하는추가결함발견. 한추월제안후상대속도가음수로바뀌며진짜뒤로돌아오는관측이있어야다음추월을준비하도록수정했다.
- runtimebridge는rider자체structural증거형으로확장했고MapView공급은passing담당이getOvertakeEvidence로연결. 시각비껴가기보정전경로heading·원거리축을유지.
- 시각추월정책의빠른상대는왼쪽이므로엄지척기본side도left. 기존좌/우클립·db테스트인자·메인의eventIdfallback은보존, Rules허용방향은이미좌우모두지원.

## 검증

추월단위/프레임재생9/9 PASS. 실제PeerMotionRegistry→runtimepub/sub→detector를100ms UI로140초재생했고, 5/6kmh·200ms/4초/12초패킷각각후보1건확인(22.5초gap0.52m,37.8초gap0.50m,51.7초gap1.03m). 원본12초45m점프거부, 14초후동일패킷재수신fresh=false, 뒤-0.5/나란히0/첫앞합류/정지노이즈/실제뒤로돌아온후재추월포함.

peer-sync replay --check19시나리오PASS, 변경lint0오류/0경고·통합buildPASS·의존방향0/순환0. 마지막미세상태수정후최종전체게이트는메인담당. Rules나전송본문은side기본Left외변경없어새Rules배포불필요. Rules에뮬레이터기대side단언만Left로갱신했고이추가side단언을위한새Rules실행은하지않았다.

변경파일: ride/overtakeThumbs.ts, riderPrototype/overtakeThumbsRuntime.ts, components/ride/OvertakeThumbsUp.tsx, peerMotion/PeerMotionRegistry.ts, ride/repo/rtdbThumbsUp.ts, 기존추월시험·새overtake-low-speed-replay.test.ts·Rules시험side단언. MapView직접편집없음. Chief직접화면시험은대기.
