# 감리 W1 — 흔들림 구현

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 대상 | [03-result-w1.md](03-result-w1.md) (Cursor) |
| 판정 | **APPROVED — GW1 통과** |

- 소스 검토: 셰이더 주입 3곳·균일 변수·수식이 뷰어(`viewer.html` installSway/updateSway)와 문자 그대로 같다. 리그 IK/DQS 무변경, `crankPhaseR` 는 읽기 전용 노출. 라이더마다 `setPhase → setVisualKind → setSway → render`, 모델 행렬 lean 에 `bikeRollRad` 가산(rider14 만).
- Supervisor 재실행: `test:rider-preserve` 37 + 계약 6 통과(동등성 시험 무수정 통과 → 흔들림 0 에서 기존 출력 동일), 운영 빌드 `index-CfxOof0w.js` 에서 `?sway=` 처리 0건.
- envelope "정지 2 s 후 < 0.01" 을 2.3 s 로 본 것은 유지 창 300 ms 를 정확히 반영한 해석 — 수용.
- **W2 에서 볼 위험 추가**: 동행 위상이 네트워크 갱신 간격(> 300 ms)으로만 바뀌면 envelope 이 들쭉날쭉할 수 있다. 실제 동행 화면에서 확인, 필요하면 동행만 유지 창을 늘린다.

## 미리보기

채널 `sway`: **https://boxcycle-dc2df--sway-s9uwmo52.web.app** (만료 2026-10-23). 운영은 `index-CrSGmUCb.js`(흔들림 없음) 그대로 확인.
