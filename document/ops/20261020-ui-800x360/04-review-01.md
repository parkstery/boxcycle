# 감리01 — GLM 구현 후 재작업

2026-10-20 Supervisor Codex. **REWORK_REQUIRED**. Developer 결과01의 정적 통과와 실화면 합격은 다르다.

- 모델: `opencode/glm-5.3-flash-free`, 실제 세션 `ses_ea785d84affehdyAsa6rRM2bcY` (CLI JSON에서 확인).
- 기준 대비 변경은 허용한 제품 6파일만. App.tsx·MapHud.tsx·미니맵·좌하단 스택 원래 dirty의 SHA-256은 baseline과 동일.
- 독립 계약 시험: route-dock riding/sensor-chip-slot/sensor-ui 34/34 PASS.
- 실제 800×360 fixture에서 라벨11px 및 시작·센서·캐럿44px 확인. 그러나 아래 불합격.

| 항목 | 실제 결과 |
|---|---|
| 상단 겹침 | 긴 값 주행: 계기판 x116~600/y11~67, 카메라 x372~535/y11~41. 서로 겹침 |
| 시작 라벨 | 모바일44px width override로 시작 두 글자가 두 줄로 꺾임 |
| 주소 삭제 | 실제16.2×44px. 가로44px 불충족 |
| 캡슐 폭 | Developer 계산≈402px와 달리 actual≈484px. 계산만으로 겹침 없음 판정 불가 |

독립 재현 명령:
```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npx playwright test ui-800x360 --grep '800×360 준비' --workers=1 --reporter=line
```
exit1, `riding: metrics vs right controls` FAIL (수정 전 회귀 증거).

Cursor [지시02](02-task-02.md)의 선행 보완에 이 세 결함을 포함했다. 기존 지시01 결과/정적검증 기록은 보존한다. 검수용 fixture는 실제 UI 컴포넌트와 인메모리 상태를 사용하며 서버 주행·Claim을 만들지 않는다.

인계: GLM은 결과01 파일과 정적검증 기록을 완성했다. 최종 채팅 응답 대신 문서를 정리하던 CLI에 Ctrl+C로 종료를 전달하고 exit1을 확인한 뒤 Cursor를 시작했다. 제품 수정 실패를 뜻하는 exit1이 아니라 순차 인계 종료다. GLM이 허용범위 밖 PROGRESS에 추가한 이번 작업 한 줄은 Supervisor가 검수 상태로 정정하며 기존 기록은 보존한다.
