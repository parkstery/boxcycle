# 검수 재작업 — FS 추정 시간의 안전성과 사용자 튐 원인 범위

Codex · 2026-10-05. 27의 버퍼 clear 재현 및 점프3.18→0.058m는 유효한 최소결함 증거다. 그러나 사진 당시 RTDB공백이 측정되지 않았으므로 사용자 잔여튐의 원인 전부를 확정하지 않는다. 사용자 확인 동기화 보존. 타작업 보존, 주기/FSschema/트래픽 증가없음, commit/push/deploy없음, 가상재생 명령120초.

## 코드에서 발견한 보완 필수

`bridgeFsPacketToServerTimeline`가 `dDist / max(oldSpeed,newSpeed)`로 만든 시각을 실제 캡처 `tSrv`와 같은 속성에 넣고, `rememberServerCapture`가 다시 이를 신뢰 anchor로 저장한다. 이는 FS commit/capture 차이와 가감속/정지에서 잘못된 시각을 연쇄 추론할 위험이 있다. 정본의 tSrv='실제 캡처 순간의 추정서버시각' 계약과 다르다.

1. 실제 wire캡처와 receiver추정 fallback시각을 명확히 구별한다(내부 타입/quality표시로 충분, wire/FS필드 추가금지). 브리지 추정치는 실제 RTDB anchor를 덮어쓰지 않는다. publication/uid별 anchor경계, frozen반복, 동일/역행FS, 큰skew/가속/감속/정지, RTDB재개를 처리한다. 추정fallback을 정상 공통동기화로 취급하지 않고 기존 연결/DEV상태에서 구분한다. 가짜 tSrv를 권위 있는 timestamp로 생성하는 구조를 제거하거나 의미가 명확한 내부표시축으로 바꾼다.
2. 뒤늦은 RTDB/FS packet이 anchor를 되돌리는지 실제 단계별 시험. FS항상4초, RTDB공백→FS선택→가감속/0속도→RTDB복구, 이전publication anchor유입을 재현. 추정시각 미래/NaN/무한외삽/큰 backtracking/복구 snap 없는지 확인. distance/speed로 캡처시각을 정확히복원할수없다는 한계는 인정하고 연속fallback으로만 다룬다.
3. residual gate가 stall구간10~16초를 제외해pass한 사실을 명확히 기록한다. **점프/역행 gate는 공백과복구포함전체구간**, 위치일치 residual은 전체값과정상값둘다제시. 기존등속before와같은상한으로비교하고 exclusion추가/수치완화로 합격을만들지 않는다. 가감속/정지 fallback시험추가. 새 gate/mutation이이추가케이스도검사하도록한다.
4. 정상 저속 dual/bundle은 PRE도PASS였으므로 '사용자잔여튐완료'가아니다. 주행중 실제 선택source·timestampquality·frame시각·raw peer/self거리·최대jump 등을 기존 DEV진단에서 짧은 in-memory ring/한번 export로 확보할방법을 준비한다. 패킷마다콘솔스팸/새네트워크쓰기금지. 사용자가 다음10~20초관측으로 FS전환인지 실제GLB/camera변환인지 구분할수있는 구체명령을 제공. 기존진단으로충분하면신규UI없음.

결과29: 실제수정·추가시험exit/벽시간·전후숫자·추정time구별·회귀·남은한계와같은path사용자재시험안내. 좁은수정인데전체브라우저주행금지. 새검증외기존full반복은필요한경로만.
