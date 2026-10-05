# 등속 동행 간격 진동

- 상태: **CLOSED** — Chief 실주행 PASS · 상세 보고 · main2/main 통합(TASK-39)
- Supervisor: Codex / Developer: Cursor CLI
- Chief 요구: 같은 Trail에서 등속 동행이 앞뒤로 튀는 근본 원인 분석과 수정. 송신 빈도 증가로 해결하지 않는다. **같은 시각 양쪽 창의 위치·순서 일치**. 기존 트래픽 절감(RTDB 200ms · FS 4s) 보존. **초당 서브미터 상대간격 진동**이 주 증상(드문 수m snap 아님).
- 최신 지시: [39 최종 보고·통합](39-task-final-report-and-integrate.md)
- 최신 결과: [40 통합 결과](40-result-final-report-and-integrate.md) (작성 예정 → 완료 후 이 링크)
- 최종 보고: [archive/261005](../../archive/261005-RTW-동행-위치-동기화와-반복진동-해결-결과보고.md)
- 보존 검수: [38 정밀도·capture](38-review-precision-and-capture.md) · [35 paired](35-result-real-paired-json.md) · [37 capture](37-result-review-capture-and-evidence.md)
- 증거: [evidence/real-paired-20261005](evidence/real-paired-20261005/) · [graphs](evidence/real-paired-20261005/graphs/) · [quantize-beat-metrics](quantize-beat-metrics.json)
- Firebase/Vercel 수동 배포는 범위 밖(push 연동 자동배포 가능 시 환경 따름).
