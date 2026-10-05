# Supervisor 계측 감리 중간 메모

2026-10-05. 이 문서는 다음 Cursor 지시에서 필수로 읽는다.

- `.out/peer-spacing-jitter-metrics.json` 초기 200ms/sin 표본은 minSpeed=0, maxSpeed=12이고 maxJump=0.2이다. Registry.debugSnapshot은 displayDistM을 0.1m로 반올림한다. 이 값을 60fps 미분하면 등속도 0/6/12m/s로 측정된다. **속도 판정은 반드시 반올림하지 않은 실제 entity/render 좌표 기반**이어야 한다. 원인과 회귀를 정량화하기 전에 이 계측 오류를 제거한다. 기존 export/getEntities 등 공개 조회가 있으면 이용하고, 하네스만을 위해 production 공용 API를 만들지 않는다.
- WARMUP=5s는 1000/3000ms에서 초기 적응형 지연 수렴에 부족할 수 있다. 시작 구간·안정 구간을 각각 측정한다. 안정 구간을 늦추어도 초기 역행을 숨기지 않는다.
- 3000ms 간격은 RTDB source-stale=2500ms보다 길어 반복 FS 전환이 생길 수 있다. 1초 정상 경로 진동, 3초 반복 폴백, 완전 끊김을 구분한다. 송신 주기/정책 상수는 임의 변경하지 않는다.
- Chief는 구현/시험은 Cursor AI가 수행하고 Codex는 계획·지시·감리만 할 것을 명시했다. Codex가 제품 코드를 대신 구현하지 않는다.
- 양쪽 표시 시점 정책 선택은 아직 답변되지 않았다. 현재 단계에서 렌더 구조를 바꾸지 말고 두 창 역순 문제의 재현과 선택지별 구체적 범위·비용·지연을 준비한다.
