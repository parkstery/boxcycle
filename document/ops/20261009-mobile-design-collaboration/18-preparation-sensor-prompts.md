# 준비·센서 시안 프롬프트

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 생성 근거 |
| 최초 작성 | 2026-10-09 |
| 상태 | 검토됨 — 컨셉 |
| 독자 | AI |
| 연결 문서 | [대표 화면](17-design-preparation-sensor.md) |

built-in image_gen.imagegen 사용. CLI fallback 미사용. 프로젝트 작업 묶음 previews에 최종 파일 복사, 이전 파일 보존.

## 준비
입력: previews/ride-v2-satellite-text-hud.png (지도 참고).
~~~text
Use case: ui-mockup. Create a RTW LANDSCAPE SMARTPHONE PRE-RIDE PREPARATION screen concept using input satellite map as BACKGROUND REFERENCE only. The input shows old running HUD and oversized controls: remove those. Keep reference's same plausible actual satellite Mapbox map and red route plus purple claimed-road semantic colors. Landscape740x300 CSS aspect, rendered high resolution, flat edge-to-edge application image only, NO browser/Android/device chrome. This is a design mockup not live UI.
User's accepted design language: compact transparent HUD, no black/orange, teal accents, no big rectangular control dock, icon-only play/pause/stop, keep map and central route visible. In preparation no running speed/time/new road readouts (not yet riding).
Top left small plain RTW with a small menu icon; top right small profile. Right edge keep small independent map layer and recenter buttons, no camera numbers. No minimap because main screen is route overview, not redundant nested map.
At LOWER LEFT, a carefully designed content-fit LIGHT PORCELAIN route summary panel, about215x142 logical px, inset12px, not a huge sidebar: subtle 8px corners, barely-there shadow, solid enough that map labels never bleed through, no nested cards or decorative badges. Efficient4/8px spacing, 14px body minimum in intent, title16px. Precise typographic hierarchy, each item has a purpose.
Panel row1: bold title "광명 가학로", right pencil edit icon in44px touch allocation; small auxiliary label "선택 경로" above title if fits, no redundant heading.
Row2: start green outlined small S dot with "서독로104번길"; end red outlined E dot with "가학로". Two short lines, no full administrative addresses or coordinate text. This is summary, editing remains via pencil.
Row3: label "거리 km" followed bold "8.6" (unit in LABEL, never repeated after numeral). A subtle chevron at row edge for route detail if needed.
Row4: Bluetooth outline icon and text "센서 없음 · 체험", small chevron; this explicitly represents manual mode ALREADY chosen, not auto sensor fallback. Touchable row min44 logical height, no fullwidth action CTA in panel. Avoid optional extra prose.
Bottom RIGHT, three physically independent small round icon-only controls at FIXED POSITIONS, no shared enclosure: ▶ START teal disc, Ⅱ PAUSE disabled subdued neutral disc, ■ STOP disabled subdued neutral disc. All remain visible as source contract specifies, active ▶ clearly distinguishable; no words under/next to symbols. Visible diameter36~38 logical px, invisible44 targets centers52apart. Individual button surfaces only, map visible between. This is pre-ride ready after input selection, not paused.
Central red route and next bends completely unobscured; map is hero. Keep attribution "© Mapbox © OpenStreetMap © Maxar" bottom. Korean exact text, no personal info, no fabricated subscription/social/gamification. Do not invent photoreal cyclist/scenery. Presentation should feel premium, precise, restrained. NO fullscreen dimming scrim for preparation.

~~~

## 센서
입력: 생성 준비 이미지.
~~~text
Use case: ui-mockup precise state edit. Input is RTW LANDSCAPE PHONE PRE-RIDE UI concept. Create its SENSOR SETTINGS OPEN state. Preserve satellite background, route geometry/colors, small top-left RTW/menu, top-right profile, right map/recenter controls, three fixed start/pause/stop positions. Do not invent landscape or features. No device/browser/Android bars, aspect740x300.
Replace ONLY the lower-left route summary card with a SMALL content-fit left-side sensor settings panel, approximately logical x12,y92,w250,h180. Do NOT add a second card over the existing card, do NOT stack two panels. Light opaque porcelain #F7F9F8 surface,8px corners, fine border, subtle short shadow. Readable14px body,16px title, compact aligned content; no giant padding, no nested boxes, no fullwidth action buttons. Open setup is a deliberate reading panel, but center map and red forward route remain unobscured. No dark fullscreen scrim.
Header ONE ROW: "케이던스 센서" bold, small gray status "미연결", right close "×" symbol with44px touch allocation, thin divider optional.
Next row TWO content-width controls side-by-side, both44px tall: Bluetooth line icon + "센서 연결" in light neutral button; "센서 없음" selected state with subtle TEAL outline and tiny checkmark, not huge filled card. This state is MANUAL MODE EXPLICITLY CHOSEN before ride, and sensor unconnected. Never claim auto fallback. No device name/rpm measurement fabricated. No explanatory paragraph duplicating buttons.
Below, a compact LABEL/VALUE row: left "체험 속도 km/h", right bold "5". Unit ONLY in label.
Last row manual speed control: minus symbol button(44px hit area), short slim horizontal slider with teal thumb toward low end, plus symbol button(44px hit area). Keep controls separated enough for touch. Thin track, not huge bar. Do not put extra repeated numeric field or km/h beside slider.
Three bottom-right transport icons remain at SAME fixed positions as input, visible without a common enclosing background; they are background controls while settings is open, not new sheet actions. No confirm/save button because the existing setting applies directly and close returns to preparation.
Exact Korean labels. No black/orange UI, no decorative badges/trophies/upgrade cards. Professional visual grouping and efficient space. No panel title outside screenshot.
~~~

## 출처 표시 복원
입력: 생성 센서 이미지.
~~~text
Precise image edit. Keep the entire provided RTW landscape phone sensor settings concept unchanged. Restore ONLY the small map-provider attribution at the bottom center, which is missing: exact text "© Mapbox © OpenStreetMap © Maxar", white small font with thin dark halo directly over map, no fullwidth footer or filled panel. Keep every other pixel/layout/text/button/map as close to input as possible. Do not add browser chrome or any other feature.
~~~
