# 계기판 글리프 외곽선 구현

| 항목 | 내용 |
|---|---|
| 문서 유형 | record |
| 작성 | 2026-10-22 |
| 연결 | [지시13](02-task-13.md) |

Codex 직접 수정: 캡슐 ::before 제거, 투명 배경 유지. 검정 2.5px 숫자 외곽선·stroke fill 순서·800 굵기·하늘색/연파랑/초록 적용. 라벨과 단위에도 작은 키라인, 폰 가로의 글리프 잘림 방지를 위해 계기 셀 overflow visible 적용.

실제 제품 컴포넌트 fixture를 Chromium 800×360 DPR2에서 렌더했다. 계산값: background rgba(0,0,0,0), ::before content none, 숫자 stroke 2.5px. 캡처: `.out/hud-glyph-outline-800.png`. 이 배경은 검수용 SVG이며 실제 위성지도/폰은 미검증이다.

실행 위치 `C:\20.HDev\boxcycle\apps\web`. 브라우저 명령 ego-browser는 이전 확인에서 사용 불가여서 설치 없이 기존 Playwright로 검수했다. 커밋·푸시·배포 없음.
