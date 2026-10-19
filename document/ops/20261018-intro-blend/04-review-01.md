# 감리01 — 레퍼런스 결합 초기 화면

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Supervisor 시각 감리 |
| 최초 작성 | 2026-10-18 |
| 상태 | REWORK_REQUIRED — [재지시02](02-task-02.md) |
| 독자 | chief · Developer |
| 연결 문서 | [계획01](02-task-01.md) · [묶음](README.md) |

실제 콜로세움 위성지도+남색 그라데이션+나침반/SPINATLAS+코랄 포인트+기존 카피/CTA 조합 구현 확인. 실제 앱6크기(667×275/667×300/740×300/844×390/1366×768/1440×900) 캡처, Mapbox응답110건 모두성공. 가로넘침0·각제목1행씩 총2행·CTA44px·폰하단설명숨김 통과. 수치 [JSON](evidence/initial-geometry.json), [PC](evidence/initial-1366x768.png), [폰](evidence/initial-667x275.png). 변경 전 [PC](evidence/before-1366.png)·[폰](evidence/before-667.png)도 실제 타일 응답57건 모두성공으로 확보했다.

미흡: 폰제목20.25px/브랜드19.575px/kicker8.37px로 작음, 부제 뒤에 짧은 조각이 남는 줄바꿈, PC하단설명 세로배치, Mapbox로고클릭막힘. 마지막 문제는 기존 인트로에도 있었지만 이번 동일화면 수정 범위에서 보완한다. 시각검수 후 제목24px/브랜드22px/eyebrow10px, 부제2구절, PC3열, 출처z-index를 재지시했다. 최종합격은 재작업 후 별도 검수한다.
