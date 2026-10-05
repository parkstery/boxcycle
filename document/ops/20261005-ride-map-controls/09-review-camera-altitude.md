# 카메라 고도 — Supervisor 검수

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Codex 검수 |
| 작성 | 2026-10-05 |
| 상태 | **APPROVED** |
| 결과 | [08 Cursor 결과](08-result-camera-altitude.md) |

축척 바로 왼쪽에 카메라 해수면 고도를 표시했다. Mapbox position.toAltitude()를 읽고 m/km로 표시한다. read-only IControl과 이벤트 cleanup, 동일 표시값 DOM 갱신 생략을 검수했다. 기존 줌·카메라·동행 알고리즘 변경 없음.

Cursor CLI exit 0. 타입 검사·신규 control lint·셀렉터 15단계 통과. 740×300 실화면의 카메라 1/2·줌·스타일 변경 모두 표시값과 실제 고도 일치(pass:true), 축척 왼쪽·FAB/attribution 겹침 없음. 캡처를 직접 확인했다. 초기 서로 다른 틱의 측정 불일치는 동일 틱 수집으로 교정했으며 최종 근거는 [metrics](.out/metrics-altitude.json)와 [캡처](.out/altitude-cam2.png)다.

커밋·push·배포 미실시. Chief 사용 확인·최종 종료 대기.
