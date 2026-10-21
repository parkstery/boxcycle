# 지명 겹침 대비 구현 결과

| 항목 | 내용 |
|---|---|
| 문서 유형 | record |
| 작성 | 2026-10-22 |
| 연결 | [지시14](02-task-14.md) |

Codex 직접 구현: 숫자 검정 stroke 2.5→4px, 라벨 2→3px, 전체거리 2→3px, 단위/힌트 1.5→2.5px. paint-order stroke fill 유지. 공통 글리프 그림자 2px/4px 중첩과 아래쪽 2px 그림자로 가까운 지명을 국소적으로 가린다. 라벨/단위의 옛 그림자 덮어쓰기를 제거했다. 투명 캡슐·::before none 유지.

실제 HUD 컴포넌트의 SVG 지도 fixture에 흰색 지명(검정 키라인)을 HUD 아래에 겹쳐 Chromium 800×360 DPR2 캡처: `.out/hud-place-label-halo.png`. 계산 스타일 숫자 stroke 4px, 공통 그림자 4층 확인. 실제 지도 라벨을 변경하거나 감추지는 않았다.
