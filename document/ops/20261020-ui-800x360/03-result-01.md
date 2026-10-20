# 지시01 결과 — 계기판·주행 제어·센서 (800×360)

- 날짜: 2026-10-20. 담당: OpenCode **GLM-5.3-Flash** (`opencode/glm-5.3-flash-free`) — Chief 명시 승인 모델.
- 세션: OpenCode 본 세션(GLM-5.3-Flash). 하위 세션·다른 모델 호출 없음. (세션 ID는 하네스 세션 메타에서 별도 확인 필요 — 본 세션 작성 시점에 ID를 코드로 읽을 수 없어 기재하지 않는다. 필요하면 Supervisor가 세션 목록에서 이 날짜 GLM 세션으로 대조.)
- 금지 준수: `.env`·인증정보·`private/`·`evidence/` 접근 없음. 커밋·푸시·배포·다른 에이전트 호출 없음. 운영 데이터 수정 없음.
- 기존 dirty 보존: 작업 시작 시 dirty(App.tsx·MapHud.tsx·RouteMinimap.*·문서 계열 등)를 **되돌리지 않았고** 병합·대체하지 않았다. 작업 중 다른 세션의 dirty가 변한 파일(예: `apps/web/dev-tools.json`, 신규 `e2e/ui-800x360.spec.ts`·`scripts/ui-800x360/`)도 손대지 않고 남겼다.

## 1. 실행 기록 (branch/HEAD/dirty)

- branch: `main2` / HEAD: `6cd54e27` (Merge latest-day new road display fixes) — 묶음 README가 가리킨 진입 HEAD와 동일.
- 본 작업의 쓰기 파일(6개 + 결과 1개):
  - `apps/web/src/tokens.css` — light UI 역할 토큰 **추가만**(`--rtw-ui-surface/-mute/-soft/-primary-soft`, `--rtw-ui-ink/-ink-strong`, `--rtw-ui-muted`, `--rtw-ui-primary/-strong`, `--rtw-ui-border/-border-soft`). trace 골드·보라 `--rtw-trace-owned`·Mapbox 색은 건드리지 않았다(diff +27/-0 순수 추가).
  - `apps/web/src/components/maphud/MapHud.css` — 계기판 규격(글자 크기·고정폭)과 코칭 글자 크기, 색 리터럴 → 역할 토큰 치환.
  - `apps/web/src/components/maphud/CadenceHudChip.css`·`.tsx` — 칩 44px·11px, 「SENSOR→센서」 표시 매핑, 토큰 치환.
  - `apps/web/src/components/route-dock/RouteDock.css`·`.tsx` — 주행 제어 44×44, 캐럿 실제 44px, 주소 행 44px/주소 11.5px, Go 보이는 텍스트(시작/재개), 토큰 치환.
- 읽기만: `App.tsx`·`MapHud.tsx`·`RouteMinimap.*`·`lib/route/sensorChipSlot.ts`·`lib/sensor/cadenceSensorUi.ts` 등 — 변경 없음.

## 2. 구현 내역 (지시01 항목별)

### §1 계기판(HUD 지표 캡슐) — `MapHud.css` `@media (max-height:560px)` 블록

두 뷰포트(800×360·667×300)는 모두 `max-height:560px`에 든다(루트 13.5px, 변경 없음).

| 요소 | 변경 전(폰 가로 기준) | 변경 후 |
|---|---|---|
| 라벨(거리/시간/평균/속도/새 도로) | 0.52rem ≈ **7.0px** ❌ | **11px** |
| 일반 값(시간/평균/새 도로) | 0.82rem ≈ 11.1px ❌ | **18px** |
| 히어로(거리 누적)·속도 | 0.92rem ≈ 12.4px ❌ | **22px** |
| 「/ 총거리」 표기 | 0.95rem ≈ 12.8px ❌ | **18px** |
| 단위(km·km/h) | 0.55rem ≈ 7.4px ❌ | **10px** |
| 고정 셀 폭 | 87/44/39/49px(rem) | **152/68/80/84px(px 고정)** |

- 고정 폭 근거 = 최악값(「99.99 / 99.99 km」·「999:59」·「99.9 km/h」·「+12.34 km」)을 새 글자 크기로 담는 최소폭. 내용이 넘쳐도 캡슐 gap 안쪽으로만 넘친다(기존 가운데 정렬 계약 유지 — 이웃 셀을 밀지 않는다).
- 색 표기는 리터럴 헥스를 `tokens.css` 역할 토큰으로 **현 규칙 자리에서** 치환(override append 아님). 파랑 강조(#2563EB→`--rtw-ui-primary`)는 trace 골드와 나뉜 UI 역할로만 쓴다.
- 코칭(hud-coach)·R1 칩: 0.78/0.70rem(≈10.5/9.5px) → **11px**. 배경 없는 D9 계약·키라인·색 유지.
- **상단 전체를 패널로 덮지 않음**: 흰 캡슐 형태 유지, 배경 확대 없음. 거리/시간/평균/속도/새 도로 의미·순서 불변. 캡슐 폭 ≈ 402px + Spinatlas 칩 ≈ 85px → 667 폭에서도 겹침 없음(계산 근거, 실측은 Supervisor — §4).

### §2 RouteDock 주행 제어 — `RouteDock.css`/`.tsx`

- 네 컨트롤 모두 **실제 44×44px**(이전 2.1rem=28.35px·폰 미디어 1.8rem=24.3px ❌).
- **시작·재개** — 기존 아이콘 Go 버튼에 보이는 텍스트 `<span class="route-dock__go-label">시작|재개</span>` 추가(11px, bold). `aria-label={paused ? "재개" : "주행 시작"}` 계약(entry-contract start-ride 앵커) **그대로 유지** — 접근성 분기는 그대로, 화면 텍스트만 짧게. 버튼은 `width:auto; min-width:44px; padding:0 10px` — D2(44px는 높이로, 폭은 내용+최소 패딩).
- **순서·위치·disabled 계약 보존**: 세 버튼이 항상 같은 자리·같은 순서로 disabled로 그려지는 DOM 계약, `onAnimationEnd` setup-cue 구조, e2e가 `isEnabled()`로 보는 앵커 전부 무변.
- dock 전체 폭: anchor 상한 `min(21.6rem)→min(22rem,…)`(=297px@루트13.5) — 44px 컨트롤 행을 담기 위함. 펼침 총폭 ≈ 캐럿44 + 행(칩≈68 + Go≈72 + 일시정지44 + 종료44 + 간격·패딩) ≈ **289px ≤ 300px 목표**(계산값, 실측은 Supervisor).
- 주소와의 조화: 첫 행(칩+제어) 높이 44px + 패딩 ≈ 50px, 주소 행 44px와 같은 세로 축.

### §3 센서 칩 — `CadenceHudChip.css`/`.tsx`

- 높이 **44px 실제**(이전 HUD 2.2rem≈29.7px·dock 1.5rem/미디어 1.3rem≈17.5~20.3px ❌). dock 변형도 44px — 일시정지·종료 버튼과 같은 축.
- 글자 **11px**(이전 0.76/0.70/0.64rem ≈ 10.3/9.5/8.6px ❌). 560px 미디어의 폰 축소 규칙(0.64rem)은 미달이라 제거 — 패딩만 조임.
- 「SENSOR」 → **「센서」**: 화면 표시만. `lib/sensor/cadenceSensorUi.ts`의 `CHIP_IDLE_TEXT="SENSOR"`는 **건드리지 않았다**(`sensor-ui-contract.test.ts`가 그 문자열을 계약으로 본다). 대신 칩 컴포넌트에 표시 전용 매핑(`view.text === "SENSOR" → "센서"`)과 근거 주석을 뒀다. aria 계약(`view.ariaLabel` 「케이던스 센서: …」)·LED 초록/흰·수동 모드 기능 무변.
- 칩 텍스트 min-width: 텍스트 폭 흔들림 방지용을 40px로 통일(「NN rpm」 11px 최악값).

### §4 캐럿·주소/삭제 행 — `RouteDock.css`

- 캐럿: 폭 0.93rem(12.55px) → **실제 44px**. pseudo 확장 없음(이웃 칩을 안 덮고 `overflow:hidden` 잘림 없음 — touch-targets-44의 「캐럿이 옆 센서 칩 탭을 가로채면 안 된다」 계약도 실제 폭에서 그대로 성립). 높이 44px 기존 계약 유지. 이전 「별건(Chief 판단 대기)」은 지시01 승인으로 해소.
- 주소/삭제 행: `.route-dock__stops > li { height: 44px }` **실제 높이**, 주소 0.66rem(8.9px)/미디어 0.6rem(8.1px) → **11.5px**. 삭제 버튼은 44px 높이에 stretch로 채워짐(폭은 내용 짧은 ✕ 유지 — D2 폭 확장 금지 준수, ✕ 글자 11px).
- stops 목록 max-height: 7.5rem → 10rem(베이스), 5rem → 8.5rem(폰 미디어) — 44px 주소 행 2~3행이 스크롤 없이 보이도록(패널 max-height min(52vh,11rem)=148.5px에 맞춤).
- 이어달리기 UI 글자: 선택 라디오 0.72rem→11.5px, 「이어달리기 종료」 0.62rem→11.5px(min-height 44px 기존 유지). **diet·접힘·이어달리기 로직·DOM 불변.**

### §5 토큰

- `tokens.css`에 light UI **공용 역할 토큰 11개** 추가 — 3개 CSS(MapHud/CadenceHudChip/RouteDock)에서 기존 리터럴을 규칙 자리에서 치환. 소스 구조 변화 없음. **골드/보라 trace·Mapbox 색 미변경.**

### §6 미니맵·상하관계

- `RouteMinimap.css/.tsx` **무변**(기존 dirty 그대로). 최신 24px 캐럿·RouteDock 상하관계 계약 무변. 모바일 항목 임시숨김으로 통과한 곳 없음.

## 3. 명령·종료코드 (cwd: `C:\20.HDev\boxcycle\apps\web`)

| 항목 | 명령 | 종료코드 | 판정 |
|---|---|---|---|
| 셀렉터 계약 | `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS — 19단계 전부 유효(start-ride·cadence-chip·ride-end-control 앵커 무변 확인) |
| 타입 | `npx tsc -b --pretty false` | 0 | PASS |
| lint | `npx eslint src/components/route-dock/RouteDock.tsx src/components/maphud/CadenceHudChip.tsx` | 0 | PASS |
| 부가 | `npm run test:sensor-cadence` | 0 | PASS — 46/46, 칩 lib 계약(「SENSOR」 표기 계약 포함) 살아 있음 |

- 실행 위치/명령(Chief 화면 확인용): `Set-Location C:\20.HDev\boxcycle` → `npm run dev:localhost` → `http://localhost:5000` 브라우저 800×360(devtools device toolbar, 강력 새로고침). 순서: ① 게스트 진입 → ② 입문 코스 선택 → ③ RouteDock 캐럿·시작 버튼 확인·펼침 → ④ 667×300 재확인.

## 4. 미실행·위험 (Supervisor 검수 대상)

1. **브라우저 실측 미실행** — 지시서 §검증대로 브라우저·전체 e2e는 Supervisor 담당. 아래는 계산 근거만 있는 것:
   - 계기판 캡슐 ≈ 402px(+브랜드 칩 ≈ 85px) — 800·667 폭 모두 수긍하나 실측 필요.
   - dock 펼침 ≈ 289px — 300px 목표 이내(계산값).
   - 667×300에서 TR 카메라 행의 2행 이동(기존 지시67/68 규칙)과 계기판 동시 화면에서의 겹침 재확인 필요.
2. **dock 폭 상한 관계**: 첫 행(칩+44px×3 제어)이 패널 폭(폰 미디어 13.32rem≈180px)보다 넓어 body가 ≈245px로 넓어진다 — anchor 상한 22rem(297px)이 이를 담지만, 일시정지·종료의 반투명 disabled 상태에서 「잘리지 않는지」 화면 확인 권장.
3. **고정 px 규격의 이식성**: 560px 미디어에서 글자/폭을 px로 고정했다(루트 13.5px 전제). 루트 정책이 바뀌면 본 블록이 재계산 대상 — 지시01의 「루트 font-size 불변」 조건과 일치하며, 별도 결정 사항으로 남긴다.
4. **표기 소유 이동 미결**: 화면 칩은 「센서」지만 lib 상수와 `sensor-ui-contract.test.ts` 계약은 여전히 "SENSOR". lib 쪽 문구를 「센서」로 옮기는 것은 lib 계약 시험 갱신을 동반하는 별도 결정(이번 쓰기 범위 밖 — 보고로 대신).
5. **좁은 폭 미디어 블록 잔존**: `MapHud.css`의 `@media (max-width:640px)` 계기 축소 블록(0.82rem 등)은 800·667 어느 쪽 뷰포트에도 불치(640 초과)라 건드리지 않았다 — 규격 일원화는 별도 라운드 제안.
6. **작업 중 실수(기록용)**: 색상 치환을 PowerShell `Get-Content|Set-Content`로 실행했다가 RouteDock.css의 UTF-8 한글 주석 일부가 손상됐다. `git checkout -- RouteDock.css`로 복원 후 **edit 도구 + Node(utf8) 치환**으로 재적용해 최종 파일의 한글 주석 손상 없음을 확인했다(읽기 재검증). Supervisor 검수 시 `git diff`에서 RouteDock.css 주석 대조를 한 번 더 권장 — 복원·재적용 이력이 있어 diff가 info와 섞여 있다.
7. **빌드·e2e 미실행** — `npm run build`, Playwright 전체는 Supervisor 구간(지시서 §검증과 결과 문서 §3 명시). touch-targets-44 계약(캐럿 실제 44px·옆 칩 탭 미가로챔)을 실측으로 확인하라.

## 5. 요청 후속 (Supervisor)

- 800×360·667×300 캡처 전/후 비교(계기판 + RouteDock 펼침/접힘, 센서 칩, Go 텍스트).
- `npm run build` + `test:e2e:touch-targets` + `test:e2e:sensor-chip` + ride 계열 핵심 e2e.
- 검수 완료 후 `04-review-01.md` 작성.
