2026-10-28 **접힌 RouteDock LED 3배 / LOCAL_VERIFIED·미배포**: Cursor CSS2줄로지름8→24px, Codex독립4가로×idle/riding8상태24×24실측·내부7px보존·탭PASS, sensor-dock9PASS. [결과·감리](07-result-led-size.md). 기존5031유지·커밋푸시배포없음. 확인 C:\20.HDev\boxcycle\apps\web → 서버없으면 npm run dev:localhost -- --port 5031 → http://localhost:5031/ 새로고침·접힌LED탭.

# 센서 RouteDock 통합

상태: 접힌 LED 24px Cursor구현 완료 / Codex감리대기 / 미배포. 기존 통합은 LOCAL_VERIFIED([03-review](03-review.md)). Chief 후속 [06지시](06-task-led-size.md) → Cursor [07결과](07-result-led-size.md): `.route-dock__led` 8px→24px 두 줄만. 토글28px·펼침7px불변. 전수시험미실행. 기존증거보존·커밋푸시배포없음.

- [구현 지시](01-task.md)
- [1차 결과](02-result-cursor.md) / [보완결과](05-result-review-fix.md) / [독립감리](03-review.md)
- [LED 크기 지시](06-task-led-size.md) / [LED 크기 결과](07-result-led-size.md)
- 기본 실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 기존 http://localhost:5031/ 재사용.

Chief 질문에 대한 근거: 상세 작업 규칙 §운영 역할에 `Developer = Cursor AI·CLI(기본)` 명시. 이 저장소에서는 별도 요청 없이도 Cursor 기본, Codex는 지시·감리. 공통 Codex 기본 동작과 구별한다.

