# 줌 실제 동작 재지시

담당 Cursor CLI. 02 결과·03 검수를 읽고 필요한 수정만 수행한다. 전체 조사 반복 금지. 기존 다른 작업 보존, 커밋·push 금지. 결과는 05-result-zoom-rework.md, stdout 10줄 이내.

## 확정 설계와 범위

- 새 행은 **줌**: `−` 축소/멀게, `+` 확대/가깝게. callback/disabled/aria를 정확히 맞춘다. 스타일 토글과 주행 시 표시 조건 유지.
- App의 기존 `handleRideCameraDistanceFromUserZoom`과 `rideCameraSpanFloorMode='userZoom'` 경로를 우선 재사용한다. 거리 지배 모드(aerial, forward/backward/left/right)는 preset distance 상태를 사용하되 상대 확대/축소를 적용하고 기존 gesture zoom 경계·계산을 참조한다. 5m/6m·aerial200m에서도 zoom 방향이 뒤집히거나 버튼이 무효가 되지 않게 한다. 경계 정리는 기존 userZoom 경로에 맞춘다.
- **rideCameraFollow.ts**에서 `productTune` 거리만 명시적인 `userZoom`에 의해 덮어쓸 수 있도록 최소 수정한다. QC2/3 초기 preset 거리는 그대로, pitch/bearing/앵커 튜닝은 유지, camlab의 명시적 override 우선순위는 유지한다. QC 새 선택 시 기존 preset 모드 reset 유지. 카메라·peer motion 알고리즘을 새로 만들지 않는다.
- 거리 없는 모드(topDown/north/keep)·QC1 routeFit/free는 App의 기존 `mapZoom` 상태/제어로 분기해 실제 zoom을 변경한다. routeFit→free 유지, QC1의 mode/fit 요청을 자동 변경하지 않는다. 실제 현재줌과 App mapZoom 차이가 있으면 기존 onMapZoom 경로/실측 zoom 동기화를 확인해 눌렀을 때 반대방향 jump가 없게 한다. 기존 방법으로 구현이 어려우면 같은 맵 제어 파이프라인을 최소 재사용하되 변화와 근거를 명시한다.
- 관련 MapView handler/공통 helper를 읽는 것은 허용. 필요한 줌 배선 변경만 허용하며 공용 함수의 다른 동작 의미는 보존. 맵 뷰 시트의 스타일/현재 거리 값도 같은 상태를 계속 표시한다.
- 터치 실제 hit test(버튼 중심·가장자리)로 이웃 컨트롤/QC/맵버튼 오클릭과 지도 전파를 확인한다. 보이지 않는 pseudo 영역으로 이웃 버튼을 덮는 것을 터치44px 충족으로 보고하지 않는다. 필요한 최소 간격/높이 조정은 허용. 기존QC를 불필요하게 키우지 않는다.

## 검증·증거

selectors, 변경 파일 lint, tsc, 기존 framing 계약. QC2/3에서 버튼 클릭 후 실제 지도 zoom/프레이밍 변화가 300ms 이상 유지됨·다시 QC 선택하면 기본복원, QC1routeFit에서±방향·aerial에서동작을 확인한다. 기존5010 live 서버 재사용/단일worker. 실지도 상태 수집은 기존 debug hook만 사용하고 새 인증 우회를 만들지 않는다. 실제 map zoom 수집이 안 되면 증거를 얻을 수 있는 기존 headless/카메라 하네스를 사용하고 UI 클릭/프레임 지속 검증을 구분한다.

업데이트 캡처·740×300 rect·hit-test 결과를 남긴다. 전체e2e 무의미하게 확장하지 않는다. 5분 무진전 브라우저는 중단 후 서버/프로세스/log 확인·단일worker/headless·계약 대체 경로로 전환. 실제 변경만 diff로 보고하고 관련 회귀가 없으면 완료한다. 기존02는 덮어쓰지 않는다.
