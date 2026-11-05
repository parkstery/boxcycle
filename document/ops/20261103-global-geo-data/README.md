# 20261103-global-geo-data — 전세계 지역 데이터 구조

| 항목 | 내용 |
|---|---|
| 상태 | IN_PROGRESS — G1·G0.5(P1 1차·P2·P5)·G2·G3(국가 입력·범위 버튼)·G4 서버 배포(004e4261), 유럽 RTDB 생성 |
| Supervisor | Claude Code (Opus 5.5) |
| 계획 | [00-plan.md](00-plan.md) |

## 요약

서비스·DB는 하나로 두고, 데이터에 지역 표시(대륙·국가·행정구역·타일 quadkey)를 붙여 지역별로 찾게 한다. 거리 순위는 사람(대표 국가) 기준, 정복·개척 순위는 도로 기준. 기간은 주·월·연(+전세계 전체), 도시는 보류.

## 다음

1. Chief 폰 시험: 국가 입력·순위 범위 버튼(11-04 기준 범위 요청 0건)
2. Publication·Trail 목록 지역 필터 화면(시안 → Chief 승인)
3. G5 Conquest 지역 통계(개척 순위 지역 범위의 재료), 유럽 RTDB 2차(앱 접속 분리, [§5.1](00-plan.md))

## G1 결과 (2026-11-03, Claude Code 직접)

위치 판정 모듈과 경계 데이터 4.8MB. geoRegion 30/30, functions 201/201, eslint 0. 첫 판정 70ms·+12MB. 원본 오류(모스크바 코드 뒤바뀜)와 국가별 행정구역 단위 차이는 생성기에 고정 — [§3.4](00-plan.md).

재현 (`C:.HDevoxcycleunctions`):

```
node scripts/geo-region/build-geo-data.mjs <Natural Earth GeoJSON 폴더>
npx tsc; node --test lib/geoRegion/geoRegion.test.js
```

## 기록

- 2026-11-03 Chief: 거리=(가) 사람 기준, 정복·개척=(나) 도로 기준, 기간 주·월(연은 추후), 도시 보류, 나머지 Supervisor 권장안 수용.
- 2026-11-03 Chief 2차: 독도=한국 관점 판, 주·월 경계=각 사용자 시간대, 추가 기간은 흔한 방식(→ 달력 연, 전세계 전체 유지), 가입 정보에 국가 없음 → 입력 신설.
- 2026-11-03 Chief 3차: 연 단위를 미루지 않고 처음부터 포함(D14). 90일 칭호는 재료만 남기고 기능은 별도.
- 2026-11-03 Chief 4차: Q3·Q4 제안대로, G0.5 준비를 계획에 넣고 G1과 진행. 워크트리 없이 새 폴더만 사용(워크트리 금지 규칙).
