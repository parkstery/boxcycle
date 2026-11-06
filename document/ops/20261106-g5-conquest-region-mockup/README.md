# G5 지역 화면 시안 (Conquest 지역 통계)

작성 2026-11-06 Supervisor Claude Code 직접 · **근사 시안**(실제 캡처 아님) · `mockup.png`(재현 `node capture.cjs`)

| 안 | 내용 | 결과 |
|---|---|---|
| ① 내 도로망 지역 칩 | 「전체 도로망/신규 도로만」 줄 앞에 지역 칩, 고르면 큰 km 숫자가 그 국가 값으로 바뀐다 | **채택(Chief 11-06 「추천안대로」)** |
| ② 지역별 목록 | 줄을 누르면 국가별 막대 목록 | 대안, 미채택 |
| ③ 개척 순위 범위 | 고정76 범위 버튼을 개척 탭에서도 | 채택. 단 대표 국가가 있을 때만(국가 코드를 못 정하면 서버가 400) — 시안 ③ 설명의 「국가 없음도 고를 수 있다」는 취소 |

한계(Chief 승인): 지도는 거르지 않는다(판정은 서버 한 곳, D7) · 행정구역은 이름 표가 없어 화면은 국가까지 · 개척 `uses`는 세계만.
구현: S1 `functions/src/conquestRegion.ts` · S2 `conquestOnRideCreated.ts` · S3 `leaderboardScoresCore.ts` · S4 Rules·삭제 등록 · S6 `UserInfoSheet.tsx`+`ListRegionChip` 재사용 · 고정80.
