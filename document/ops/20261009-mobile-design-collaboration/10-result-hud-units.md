# TASK-02 Muse Free 결과

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Developer 응답 보존 |
| 최초 작성 | 2026-10-09 |
| 상태 | DEVELOPMENT_DONE — 읽기 전용 |
| 독자 | chief · AI |
| 연결 문서 | [지시](09-task-hud-units.md) · [검수·시안](11-design-revision-03.md) · [원본 로그](muse-task-02-output.log) |

실행 모델: opencode/muse-spark-1.3-contributor-free. 실행 종료코드:0.
실행: opencode-cli.exe run --model opencode/muse-spark-1.3-contributor-free --title "RTW HUD title units read-only review" --file document/ops/20261009-mobile-design-collaboration/09-task-hud-units.md (stdout 보고 요청).
자동 권한승인 미사용. 앱 코드·파일을 수정하지 않도록 지시했다. Supervisor가 stdout 보존.

## 최종 응답 원문

~~~text
TASK-02 읽기 전용 검토 결과 (코드 변경 없음)

모델: OpenCode Muse Spark 1.3 Free(opencode/muse-spark-1.3-contributor-free)
읽은 파일 4개:
- document/ops/20261009-mobile-design-collaboration/09-task-hud-units.md, README.md, 07-design-revision-02.md
- document/reference/product/260924-RTW-UI-공간밀도-원칙.md D1·D9
- apps/web/src/components/maphud/MapHud.tsx:153-187,360-415
- apps/web/src/components/maphud/MapHud.css:860-1018
명령 종료코드: `rg --files apps/web/src`=0, `rg -l -i hud|km/h...`=0, read 전부 성공.

기존 근거: `HudMetricCell`은 라벨 위·값 아래, 단위는 값 옆 `hud-metrics__cell-unit`(0.55rem)이다. 값 0.95rem(hero 1.25rem, `var(--rtw-font-num)`+tabular-nums), 고정폭 distance 6.45rem/time 3.25rem/speed 2.9rem/conquest 3.65rem으로 자리이동 방지. 현재 `평균·속도`에 `km/h` 중복 표기 있음.

D1 대조: 제안(제목+단위 위, 숫자만 아래, 자간 없음)은 D1 「단위는 그룹당 한 번, 제목에」 방향과 적합. 시간 무단위도 정상. D9 대조: 큰 배경판 없음·중앙 경로 비침범·높이44는 D9 의도와 일치하나 카메라별 글자 겹침 확인은 별도 필요.

후보 배치 위험: x100..326(48/70/48/48,간격4)은 초안이며 기존 CSS 확인 전 수치. 특히 `속도 km/h`·`새 도로 km` 제목+단위가 48px에, `2.4/8.6` 장거리 숫자가 70px에 들어갈지 미검증. 기존 distance 고정폭 6.45rem(약87px@13.5px)보다 후보 70px가 작아 잘림·이웃밀림 위험. fit PASS 주장 불가. 권장 정렬: 기존 중앙정렬 유지(넘쳐도 간격 안쪽으로만, 이웃 미침).

미검증: 실DOM/실측 폭, 루트13.5px 환산, 740×300/667×300 렌더, 카메라별 전방노선 겹침, halo 대비, 평균 필드 취급(삭제·축소 임의제안 안함).

~~~

