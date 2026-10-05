# Cursor 조사 — 칼로리와 단일 이어달리기

README와 이 파일만 읽고 필요한 소스만 조사. 코드 수정 금지. 결과 02-audit.md, stdout 10줄 이내, 토큰 절약. 기존 조사 document/ops/20261005-product-value-name-calories/02-result-and-proposal.md의 칼로리 조사 재사용. 커밋/push/배포 금지.

1. 현재 calorie 계산 전체 경로(App·record·server 집계)와 실제 수집 중인 weight/time(active vs elapsed)/power/cadence/virtualspeed 유무, 중복·pause·resume 구간을 요약. 거리×30 변경 후보는 체중+실제 활동시간+stationary MET, power는 실제watts가 있을 때 후속, HR/RPM/virtualspeed를 실제 운동 강도로 오인 금지. 칼로리 구현은 이번 범위 아님.
2. 이어달리기 진입 모든 경로(다음카드/내경로load/최근주행), 정확한 eligibility/98%완주/97%재개상한/record폐기/TTL/ownership/guest/geometry/최근history 제한·progress transaction 및 종료시 savedroute갱신 확인. 다른 경로를 타면 후보를 잃는 원인과 '진행률이 삭제됨' vs '재개 안내/로드 배선 소실' 구분. file:line 근거.
3. Chief 확정 정책: 이어달리기 슬롯은 사용자당 1개. 다른 경로 선택/주행·카드 일시 닫기·앱 재시작은 슬롯 포기가 아님. 명시적 '이어달리기 종료/포기' 또는 해당 경로 완주/삭제/실제무효만 해제. B를타더라도 A유지, 2개 동시이어달리기 금지. A가유지중이면 B를자동덮어쓰기/추가slot 금지. 최근기록 히스토리에서 A가밀려도 기회유지 필요.

Supervisor 설계용으로 기존 user prefs/Firestore owner doc/Rules/localstorage를 좁게 조사: 사용자별 지속적 단일slot+포기 tombstone을 최소 어디에두면 기존구조/비용에맞는가. 기존users route 필드에 optionalpointer 추가 시 영향(읽기구독유무/쓰기권한/백엔드schema)이 있는가. client-only면 다른기기·Guest·로그인전환·history eviction 한계를 반드시 표시. 후보 bootstrap은 existing progress 미완주중 최신 relevant route하나, 활성slot 자동교체 금지. 기존 처음부터는 이번 회차 restart이며 별도포기버튼과 구분하는 편이Chief요구에맞음. 공용재개함수/최근주행에서 slot한개 enforcement범위, 의미변경/데이터모델변경을 Supervisor가 판정하도록 최소안 1개+필요결정만 제시. 새 architecture 독단구현 금지.

검증은 읽기전용 소스대조, 테스트실행필요없음. 완료조건은 위3개근거와 exact 범위/기존테스트추천. 대규모 문서탐색 금지.
