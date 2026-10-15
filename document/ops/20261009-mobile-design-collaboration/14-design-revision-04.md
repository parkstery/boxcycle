# 수정안 04 — 작은 기호 주행 제어

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Chief 피드백·Muse 검토·시각 감리 |
| 최초 작성 | 2026-10-09 |
| 상태 | 초안 — 시각 수정, 구현 미승인 |
| 독자 | chief · AI |
| 연결 문서 | [입구](README.md) · [이전안](11-design-revision-03.md) · [Muse 지시](12-task-icon-controls.md) · [Muse 결과](13-result-icon-controls.md) |

## 요구·산출물

Chief: 시작/일시정지/종료 텍스트 불필요, 기호만 표시. 큰 버튼 덩어리와 통짜 배경 제거, 지도 가림 최소화. 배경이 필요해도 각 조작에만 절제된 디자인 적용.

[수정 시안](previews/ride-v4-icon-controls-forward.png)

제목 옆 단위·RTW 오른쪽 계기·배경 없는 HUD·전방 노선 시야는 유지. 우하단 큰 상자를 없애고 센서 아이콘·일시정지·종료를 독립 요소로 표현했다. 지도는 버튼 사이에도 보인다. 주행 중이라 일시정지 기호를 표시했으며 시작/재개 상태의 기호는 별도 상태 설계 대상이다.

시각 후보: 주 조작 청록 원형, 종료 옅은 중성 원형. 각 버튼에만 짧고 절제된 그림자, 연결된 배경/패널/캡슐 없음. 지름36~40 CSS px 후보, 터치 영역44×44 이상·중심간격52 이상은 실제 측정 전 설계 목표다. 최종 치수로 채택하지 않는다.

## Muse Free 검토

모델 opencode/muse-spark-1.3-contributor-free, 읽기 전용 실행 exit0. RouteDock.tsx와 RouteDock.css를 부분 검색/읽기, 코드·테스트·서버 실행 없음.

- 기존 실제 앱은 이미 svg 기호와 aria-label을 사용한다. 이번 시안의 텍스트는 기존 앱 기능이 아니라 초기 생성 시안에서 추가한 것이므로 제거한다.
- onStartRide/restartFromZero, onResumeRide, onPauseRide, onEndRide 및 paused/riding/isActiveRide 의미 보존. 시작과 재개의 의미를 기호 하나로 뭉뚱그려 핸들러 변경하지 않는다.
- 실제 앱은 disabled 상태와 고정 순서를 사용한다. 새 상태별 표시를 구현할 때는 이 동작과의 차이를 별도 검토한다. 이번 단일 정지 이미지로 상태 전환 변경을 확정하지 않는다.
- 접근성 이름·키보드 초점·센서 연결 신호 보존. 표시 텍스트가 없다는 이유로 aria-label도 삭제하지 않는다.
- 기존 2.1rem 버튼·gap0.3rem에 히트44px를 덧대는 것만으로는 영역 겹침 위험이 있어 위치·간격 실측 필요.

## Supervisor 검수·제한

시각 확인: 일시정지/종료 글자와 큰 우하단 상자 없음, 기호 두 개·개별 원형·센서 표시 있음, 지도 노출 증가 방향과 일치. 카메라·미니맵·상단 계기는 이번 수정 대상이 아니다.

이미지 생성 편집 컨셉, 실제 앱 렌더·지오메트리 동일성·CSS 치수·색 대비·터치·전체 카메라·실기기 미검증. 실제 앱 기능 품질 PASS로 보고하지 않는다. 기존 소스를 독립 검색해 기호/접근성·상태 핸들러 존재를 대조한다.

코드·커밋·푸시·배포·운영 데이터 변경 없음. 문서 검사와 diff 검사는 별도 실행.

## 생성 프롬프트

built-in image_gen.imagegen, CLI fallback 없음. 입력 이전 수정안 이미지, 출력 새 파일명으로 보존. 기존 시안 보존.

~~~text
Use case: ui-mockup precise edit. Edit ONLY BOTTOM-RIGHT ride controls of this RTW landscape phone app UI. Keep upper compact text HUD with title units, RTW/menu, entire plain vector map, forward red road, rider, minimap, right vertical camera/layers/recenter, profile, attribution unchanged. Do not alter map camera or typography.
USER CORRECTION: huge bottom-right rectangular container is ugly and hides map. REMOVE the ENTIRE enclosing WHITE ROUNDED RECTANGLE, remove teal rectangular button and pale rectangular button, and REMOVE text "일시정지" and "종료" completely. Restore the map behind its entire old footprint.
Replace with 3 visually independent SMALL ROUND icon controls arranged at extreme bottom right in a single row, floating directly above map, no shared rail/card/pill/backdrop:
- At logical x584,y272 a small Bluetooth/sensor line icon and tiny green status dot, no enclosing card; crisp deep teal with a very fine light halo.
- At x638,y272 a 38 CSS px diameter circular pause button, muted teal solid disc (#087F80), centered white PAUSE TWO VERTICAL BARS symbol only, symbol about18px.
- At x690,y272 a 36 CSS px diameter circular stop button, delicate pale porcelain disc (#F7F9F8) with fine 1px outline and restrained short shadow, centered dark teal SQUARE STOP symbol only, symbol about14px. NO words.
Concept logical canvas740x300 at roughly3x scale. Center spacing52px, reserve nonoverlapping44px invisible touch targets; visible controls smaller than reserved touch region. The new group occupies only bottom-right ~140x48 logical pixels, compared to original giant244x48 panel. Three isolated objects with clearly visible MAP GAPS between, no light panel connecting them. Use modest shadow just enough to distinguish each tiny disc from terrain, no exaggerated bevel, glow, frosted-glass capsule, dark background, orange accent, ornamental rings, icons with text or extra buttons. Never show play and pause simultaneously; this screenshot is running so pause only. Keep everything else pixel-faithful as possible. Landscape app screenshot only, no annotations outside screenshot.
~~~
