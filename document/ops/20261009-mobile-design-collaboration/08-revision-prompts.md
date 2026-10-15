# 수정안 02 생성 프롬프트

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 생성 절차 보존 |
| 최초 작성 | 2026-10-09 |
| 상태 | 검토됨 — 컨셉 이미지 |
| 독자 | AI |
| 연결 문서 | [수정안](07-design-revision-02.md) |

도구: built-in image_gen.imagegen. CLI fallback 미사용.
위성 편집 대상: previews/ride-a-porcelain-teal.png.
전방 편집 대상: 위성 수정본. 배경 참고: N:/개인/261009/Screenshot_20261009_210147_Chrome.jpg.
최종 두 이미지 workspace 복사, 원본 보존.

## 위성 수정

~~~text
Use case: ui-mockup edit. Revise the provided RTW LANDSCAPE phone cycling app concept. PRIMARY USER CORRECTION: the map and forward route must have visual priority. Remove the entire huge opaque top instrument panel. Show smaller crisp unboxed HUD TEXT directly over the map, with NO filled strip, NO glass panel, NO rectangular gradient behind it.
Maintain identical satellite map geometry, red planned route leading from blue position dot upward and right, purple claimed road, bottom left minimap, light/teal bottom right ride controls, right edge camera/layers/recenter controls, attribution, and landscape 740:300 aspect. No photoreal street or sky. No browser/device bars.
Recompose top area: remove the giant RTW wordmark and give a small RTW + menu entrance at top left, occupying only about 80x36 logical pixels. A modest small avatar remains top right. All FOUR metrics form one COMPACT GROUP at the UPPER LEFT below the small brand/menu, within roughly x12..275 logical px and y55..100 logical px. They must NOT span across the center of screen. Exact metrics: "속도" above "18.6" with small "km/h"; "거리" above "2.4/8.6" with small "km"; "시간" above "12:48"; "새 도로" above "+0.42" with small "km". Speed is slightly larger, approximately 24 CSS px, others 18..20 CSS px, labels 12..13 CSS px. Nicely aligned compact typography, restrained spacing, white/ivory text with a THIN dark outline and short dark shadow tightly following glyphs, NO orange or yellow. At 3x render scale labels 36px and numbers 54..72px. Do not add borders, divider strokes or cards between metrics.
The upper CENTRAL area (x300..650 logical px) must be COMPLETELY free of HUD text or opaque backgrounds so the red forward route and upcoming bends are visible. Never move the route to accommodate UI; move UI away from route. UI must not cover the route beyond center position dot.
This is a visual design prototype for a shallow actual phone display: intelligent spatial prioritization rather than huge polished desktop elements. Retain solid light surfaces ONLY on actual interactive buttons; HUD readouts have transparent background. Menu and profile may be small visually with 44px invisible target reserved. Leave the rest of the screenshot unchanged, all map routes and numbers unchanged. Keep Korean accurate, no labels outside screenshot.
~~~

## 전방 시점

~~~text
Use case: ui-mockup edit. Make a SECOND camera-state concept for RTW landscape phone.
IMAGE 1 is the UI edit target: keep compact unboxed white HUD text at upper left, small menu/RTW, profile, minimap bottom left, light teal controls bottom right, three right-edge camera/layers/recenter buttons.
IMAGE 2 is the REAL EXISTING APP forward camera screenshot reference. Replace the satellite background with the same PLAIN low-detail Mapbox 3D vector road/terrain scene from IMAGE2, not photorealism. Pale beige terrain, white/light gray roadway, blue sky, small lowpoly cyclist center at approximately x50%,y56%. A thin red intended route goes ahead from the rider toward horizon, and purple claimed road behind. Do not invent detailed buildings, trees, highway, cars, photoreal cyclist or photoreal scenery. We are redesigning UI, not upgrading the map engine.
Only app content, no Chrome address bar, no Android bars. Aspect 740:300. Preserve the exact compact HUD values from image1: 속도 18.6 km/h, 거리 2.4/8.6 km, 시간 12:48, 새 도로 +0.42 km. Put these entirely in upper left 40% width, y12..65 CSS px. RTW+menu must NOT need a whole extra header row: small RTW/menu at left edge, metrics can start after it, keep total upper-left HUD footprint below44% viewport width. Reduce typography as needed to roughly24 CSSpx speed,18 others,12 labels. No full filled panel, no rectangular darkening. Thin dark glyph outline and tiny short shadow only. HUD must end left of the forward red route; preserve empty top-center so forward road and next bends remain visible. Do not move map route artificially for UI.
Remove original black/orange panels, coaching slogan, name labels, address dock, giant route markers, elevation plot and clock. This is a concept of foreground interface on the original plain rendering, not a real app screenshot. Keep minimally styled vector minimap with same route semantics, attribution © Mapbox © OpenStreetMap along bottom. No annotations outside screen. Light interactive controls remain; no black/orange UI.

~~~
