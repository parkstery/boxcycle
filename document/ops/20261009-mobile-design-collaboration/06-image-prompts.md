# 디자인 초안 01 — 이미지 생성 프롬프트

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 생성 방식·프롬프트 보존 |
| 최초 작성 | 2026-10-09 |
| 상태 | 검토됨 — 시각 컨셉, 구현 아님 |
| 독자 | AI |
| 연결 문서 | [디자인 초안](05-design-draft.md) |

도구: built-in image_gen.imagegen. CLI/API fallback 미사용. 원본 생성 이미지는 Codex generated_images에 보존하고 최종 두 장만 이 묶음 previews에 복사했다.
사용자 참고 이미지: N:/개인/261009/Screenshot_20261009_210202_Chrome.jpg (실제 위성 지도 참고).
개인 계정 이름·이메일은 시안에 전사하지 않았다.

## 첫 생성 — 폐기 (사실적 도로 배경 오류)

~~~text
Use case: ui-mockup. Create an exceptionally polished, credible production mobile application screenshot for RTW, Ride The World, an indoor cycling app on real-world roads. This is a visual concept, not a browser screenshot. Canvas is a very wide LANDSCAPE phone app content area, aspect ratio 740:300 (about 2.47:1), ideally 2220x900. Flat edge-to-edge UI screenshot, NO device mockup, NO browser address bar, NO Android status/navigation bars, NO presentation margins, NO title outside screen. Design for the severe spatial constraints of an actual 740x300 CSS viewport; do NOT design a desktop dashboard and squeeze it down.
Shared exact composition for comparing palettes:
Background fills entire screen: restrained real-world 3D map of Gahak-ro, Gwangmyeong, Korea, forward perspective with a small orange-free teal/blue jersey cyclist in center at x=49%, y=57%, following a crisp blue route on a road into distance. Soft pale buildings, muted sage terrain, almost no map labels, open center, horizon at roughly 30%. Avoid photoreal scenery, use a plausible clean vector 3D navigation map.
At x12 y12 in logical CSS coordinates a small RTW wordmark and menu icon inside a 44px tall light surface. To its right, a single compact LIGHT OPAQUE instrument strip roughly x98 y12 w500 h60, NOT nested cards: speed dominant 32px numeral, other data 22px numerals. Fine dividers, aligned baselines, legible units and short labels. Exact Korean text: "속도" "18.6" "km/h" ; "거리" "2.4 / 8.6" "km" ; "시간" "12:48" ; "새 도로" "+0.42" "km". No average speed needed in this concept; never invent trophies, goals, social badges or currency. Large metric numerals but efficient hierarchy. Text within top strip must fit actual logical width.
Top right one profile avatar button 44px, no long profile capsule or mileage. Right edge at x684 y88 stack THREE 44px touch buttons with small gaps: camera icon, map-layer icon, recenter icon. Selected camera can show "2" subtly, six camera choices are behind expanded control and not permanently on screen.
Bottom left at x12 y214 a small 130x74 opaque minimap, minimal route and rider dot, no nested header. Bottom right a compact horizontal opaque light control dock y244 height44: sensor status icon small dot, a blue/teal filled primary pause button "일시정지", and secondary "종료", touch buttons at least44 CSS px, no play button when already running. Leave center lower map unobstructed. Integrate subtle map attribution along bottom center "© Mapbox © OpenStreetMap", tiny but present. No debug clocks, raw coordinate text, coaching slogan, elevation graph or long start/end addresses. No floating tooltip over the rider.
Typography excellent Korean sans-serif, systematic four/eight pixel spacing, beautifully aligned labels and numbers, restraint, strong hierarchy. Important: light SOLID UI surfaces so map never bleeds through panel text. Avoid excessive pill buttons, nested outlined cards, orange accents, black/navy panels, gradients, glassmorphism, giant padding, oversized empty cards. Modest subtle shadow only separates UI from map. This should feel art-directed, refined and usable, not default AI dashboard.
PALETTE A: porcelain-white #F7F9F8 surfaces, ink #203B3C text, deep teal #087F80 primary action, muted mint supporting states, restrained 10px panel corners and 8px button corners. Warm sophisticated outdoor navigation product. Map route blue and claimed road muted purple with clear independent meaning; no palette-based recoloring of claim semantics. Render only this one full app screen.
~~~

## A안 수정 — 실제 지도 참고

편집 대상: 최초 생성 이미지. 배경 참고: 사용자 위성 지도 캡처. 전체 프롬프트:

~~~text
Use case: ui-mockup edit. Two input images. IMAGE 1 is the UI EDIT TARGET, retain its light porcelain/teal UI layout, Korean labels/numbers and sensible spatial hierarchy. IMAGE 2 is the REAL APPLICATION BACKGROUND REFERENCE, use its actual satellite map/cartographic appearance. Critical correction: remove every photoreal cyclist, urban scenery, sky, road-level highway from image1. Replace entire background with a top-down satellite map of the Gahak-dong area as seen in the central app-content area of image2. This product uses actual Mapbox maps, NOT photoreal road simulation. Keep camera top-down in BOTH design variants for a fair comparison.
Produce only one edge-to-edge LANDSCAPE app screenshot, 740:300 aspect, no device frame, no Chrome toolbar, no Android bars. Use just map pixels from the reference, not its old black/orange UI, not clock/coaching slogans/elevation chart. Map route red and claimed road purple like the real app reference; keep meanings rather than recoloring to teal. Small blue rider position dot at center, no huge S/E markers over controls. No need to copy personal user email/name. UI retains only RTW plain wordmark (not new decorative logo), menu at upper left, four-metric opaque white strip: "속도" "18.6 km/h", "거리" "2.4 / 8.6 km", "시간" "12:48", "새 도로" "+0.42 km"; small avatar top right; three vertically stacked camera, map layers, recenter buttons on right; small minimap bottom left; bottom right opaque compact dock showing sensor icon, teal "일시정지", secondary "종료". Panels solid white with deep teal text #203B3C, teal #087F80 accent. No orange/black/navy UI. Ensure a 44px minimum logical touch area for buttons (at image scale 3x about132pixels), but visual icon is smaller. This is an actual shallow landscape phone layout, center unobstructed, constrained whitespace, no arbitrary side panels. Retain map attribution footer appropriate to satellite source "© Mapbox © OpenStreetMap © Maxar". Crisp Korean type and coherent 8px spacing. Visual concept only, no extra labels outside screenshot.
~~~

## B안 — A를 기준으로 스타일 변경

편집 대상: 최종 A 이미지. 전체 프롬프트:

~~~text
Use case: ui-mockup edit. Create palette/composition comparison VARIANT B from the input RTW landscape phone UI. Keep absolutely identical background satellite cartography, map geometry/route red + purple, central blue location dot, minimap, all Korean labels/data, component positions and total component footprint. No features added or removed. Change ONLY the UI visual styling: surfaces cool silver-white #F0F3F8; text deep slate #26334D; primary pause button vivid cobalt #315FE9; secondary button subtle ice-blue; camera selected badge ice-blue. Sharper disciplined panel/button corners about6 logical pixels instead of very rounded shapes. Plain text RTW wordmark, not italic sports-logo lettering. Same restrained shadow, fine gray dividers, aligned typography. Make speed "18.6" slightly stronger in hierarchy than distance "2.4 / 8.6", time "12:48", new road "+0.42 km" without changing layout. The result is a precise, sophisticated sports instrument, NOT a dark dashboard. NO navy/black panels, NO orange. The background must remain a faithful top-down Mapbox-style satellite map, never a photoreal highway/cyclist rendering. Keep one landscape edge-to-edge screenshot aspect 740:300, no device/browser/status bars, no annotations outside the screen. Readable Korean. UI concepts only. Preserve minimap and © Mapbox © OpenStreetMap © Maxar attribution.
~~~
