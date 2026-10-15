# 수정안 03 — 제목 옆 단위·RTW 오른쪽 계기

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 시각 초안·Muse 검토 감리 |
| 최초 작성 | 2026-10-09 |
| 상태 | 초안 — Chief의 배치 시험 요청 반영, 구현 미승인 |
| 독자 | chief · AI |
| 연결 문서 | [입구](README.md) · [이전 수정안](07-design-revision-02.md) · [Muse 지시](09-task-hud-units.md) · [Muse 결과](10-result-hud-units.md) |

## 요청과 결과

Chief 제안: 단위를 숫자 옆 대신 제목 옆에 표시하고 RTW 오른쪽의 최상단 한 묶음으로 배치한다. 중앙 전방 시야와 배경 없는 계기 요구를 유지한다.

[수정 시안](previews/ride-v3-title-units-forward.png)

- 속도 km/h → 18.6
- 거리 km → 2.4/8.6
- 시간 → 12:48
- 새 도로 km → +0.42

숫자에 인위적인 자간을 넣지 않는다. 전체 브랜드+계기는 화면 좌측에 한정한다. 지도와 주행 장면, 다른 컨트롤의 변경은 요청 범위가 아니다.

## Supervisor 시각 검토

생성 시안에서 네 필드의 단위가 제목에 올라갔고 숫자 행에 단위가 없다. 별도 아래 계기 행 없이 메뉴·RTW 오른쪽에 계기 묶음이 배치됐다. 상단 중앙과 예시 전방 노선이 비어 있다.

이미지는 image_gen 편집 컨셉이며 실제 CSS 렌더가 아니다. 글자의 실제 CSS 크기·좁은 폰에서의 가독성·긴 거리/시간·카메라별 겹침·터치 영역은 미검증. 생성기는 숫자 주변 자간과 로고 형태를 일부 재해석하므로 그것을 최종 규격으로 채택하지 않는다.

## Muse Free 검토와 감리

정확한 모델 opencode/muse-spark-1.3-contributor-free로 읽기 전용 작업을 실행, 종료코드0. 실제 MapHud.tsx·MapHud.css와 공간밀도 기준을 읽었다. 초기에 지시 파일 경로 조회1회 실패 후 Glob으로 정확한 경로를 찾아 계속했다. 원본 로그 보존.

- 기존 HudMetricCell은 라벨 위·값 아래이고 단위는 값 옆. 제안은 D1의 제목 단위 규칙과 일치한다.
- 기존 거리 필드 폭6.45rem, 단위0.55rem, 수치0.95rem(hero1.25rem) 등 소스 근거를 보고했다. 숫자는 tabular-nums 사용.
- 제안의 거리70px·일부 제목48px는 폭이 부족할 수 있다고 보고했다. 이 값은 확정 폭이 아니다. 실제 콘텐츠 실측을 우선하고 제목/숫자 잘림·무조건 글자 축소로 해결하지 않는다.
- Muse의 “읽은 파일4개” 요약은 실제 나열한 파일 수와 맞지 않으므로 그 집계는 채택하지 않는다.
- Muse의 중앙정렬 권장은 제안에 불과하다. 이번 시안은 각 필드 제목·숫자를 좌측 정렬하며 이웃 침범·잘림을 허용하지 않는다.
- 현재 앱의 평균 속도 표시가 있다는 사실은 유지한다. 네 필드 컨셉을 평균 속도 기능 삭제 승인으로 해석하지 않는다.
- 출력의 루트13.5px 환산은 추정이고 실제 viewport 루트 크기 측정이 아니다.

앱 소스 변경·앱 테스트·배포 없음. 문서 검사·diff 검사만 수행한다.

## 이미지 생성

built-in image_gen.imagegen, CLI fallback 미사용. 입력: previews/ride-v2-forward-text-hud.png. 최종 출력만 새 이름으로 복사, 기존 시안 보존.

~~~text
Use case: ui-mockup precise edit. Input is RTW landscape phone app design. Make ONLY the upper-left brand and instrument arrangement change, preserve entire map scene, forward route bends, cyclist, minimap, right controls, bottom controls exactly.
USER REQUEST: move units up beside TITLES, remove units beside numeric values, place all instruments directly TO THE RIGHT of RTW in the SAME TOP HEADER ROW, no second row below logo. Keep central top of screen EMPTY.
Canvas aspect 740:300; render about 3x (2220x900) or preserve input aspect. Think actual compact phone layout, not desktop. Leftmost menu icon, then small plain "RTW" wordmark. Entire brand+instruments must end by x=335 logical CSS px (45% of width). At 1969px image width, all these must end by x890; do NOT span to central x985. Top margin8px, instrument labels at y10 and values y27 with row bottom y49 CSSpx. Brand aligned vertically to this 42px-tall group, not in a separate line. Menu+RTW occupies logical x10..94. Instrument group x102..334, columns around48,70,48,52px with small gaps. Distances get slightly more width because slash-separated numbers.
EXACT top line column titles: "속도 km/h"  "거리 km"  "시간"  "새 도로 km".
EXACT bottom line values: "18.6"  "2.4/8.6"  "12:48"  "+0.42".
No km/h or km anywhere beside/below these numeric values. Natural tight numeral spacing, NEVER "1 8 . 6". Labels regular12-13CSSpx, values bold20-22CSSpx. White text with extremely thin dark outline and tight short shadow, no rectangular background, no gradient strip, no panel. Each value left-aligned under own label. No extra linebreaks in titles, no oversized number lettering. Remove the old entire instrument row y112..181 input pixels and restore sky in that area. Remove any dividing vertical rules; grouping by whitespace only.
All other image parts must remain unchanged, especially the cyclist and forward red route must NOT move to create clearance. We are compacting UI, not moving road or changing camera. Top right profile unchanged. Keep light teal controls and attribution unchanged. This is a visual concept, no device frame, no browser address bar, no external labels.
~~~
