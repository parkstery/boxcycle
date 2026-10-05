# 축척 왼쪽 카메라 고도 — Cursor 작업 지시

담당 Cursor CLI. README와 이 지시만 읽고 필요한 소스만 조사한다. 기존 타 작업/이전 변경 보존, 커밋·push·배포 금지. 결과 08-result-camera-altitude.md, stdout 10줄 이내.

## 확정 범위

Chief 요청: 우측 하단 축척 표시 바로 왼쪽에 현재 카메라 높이(고도)를 보여준다. 좁은 가로 화면에 작은 읽기 전용 라벨 '고도 12.3 m' 또는 큰 값 km 단위를 표시한다. 축척과 같은 행, 안정적인 정렬·간격, 주행 제어/귀속표시와 겹침 없음. 전체 지도에 항상 표시해도 좋으며 축척 존재 조건과 일치한다. ARIA/tooltip으로 '카메라 고도(해수면 기준)'를 명확히 한다.

실제 Mapbox 카메라 좌표를 읽는다: getFreeCameraOptions().position.toAltitude()는 meter(공식 https://docs.mapbox.com/mapbox-gl-js/api/geography/#mercatorcoordinate 와 https://docs.mapbox.com/mapbox-gl-js/api/properties/#freecameraoptions). 주행 카메라 거리나 줌을 고도라고 표시하지 않는다. 지표 위 상대높이로 오인시키지 않는다. 지원하지 않거나 비정상값이면 '고도 —', 임의 수치 대입 금지. globe/스타일 전환도 안전하게 처리.

기존 ScaleControl과 bottom-right CSS를 읽고 작은 Mapbox IControl 또는 동등한 최소 구현으로 같은 행 배치. 프레임마다 React 전체 렌더 금지. render/move 등 기존 이벤트로 실제 높이 갱신, 표시값이 같을 땐 DOM 갱신 생략, teardown 이벤트 제거. 기존 카메라·동행·줌 알고리즘 변경 금지. 해수면 기준은 UI title/aria에만, 긴 구현 설명 UI 금지. 상태보드/ops index는 Supervisor가 마무리한다.

## 검증

타입·변경 TS lint·selectors 계약. 기존 5010 서버/단일worker/740×300 재사용하여 표시값과 실제 position.toAltitude() 일치, 카메라 1·2 및 줌 변경 후 업데이트, Outdoors/Satellite 유지, 축척 왼쪽·겹침 없음 확인. 기존 .out 검증 진입 helper 재사용(새 인증 우회 금지). 캡처/측정은 .out/altitude-*로 새로 기록하고 이전 증거 덮어쓰기 금지. 브라우저 5분 무진전 시 중단·서버/로그 점검 및 대체. 실패는 정확히 기록. 의미 없는 전면 e2e·새 테스트 대량 작성 금지.
