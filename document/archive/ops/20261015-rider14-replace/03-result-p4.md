# 결과 P4 — 실제 지도 위 s5 ↔ rider14 나란히 캡처

| 항목 | 내용 |
|---|---|
| 지시 | [02-task-p4-r1.md](02-task-p4-r1.md) (원 지시 [02-task-p4.md](02-task-p4.md)) |
| 작업자 | Developer (Cursor). 캡처 20장·`capture-p4.mjs`·`pair.py` 는 Supervisor 대행분 |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |
| 일자 | 2026-10-15 |
| dev 서버 | `http://localhost:5040` 기존 프로세스만 사용. 새로 띄우거나 끄지 않음 |

## 합본

`apps/web` 에서 `python scripts/rider-preserve/.out/rider14/p4/pair.py` (종료 코드 0). 좌 s5 / 우 rider14, 위 이름표. 이름 10개 모두 출력됐다. 원 지시의 9컷(near-side, near-persp, shoe, phase 4개, mid, far)에 Supervisor 가 더한 `rider-close` 가 더해져 10장이다.

| 이름 | 합본 크기(px) |
|---|---|
| near-side | 2812×436 |
| near-persp | 1932×576 |
| rider-close | 1212×557 |
| shoe | 804×336 |
| phase-0 | 1084×538 |
| phase-90 | 1084×538 |
| phase-180 | 1084×538 |
| phase-270 | 1084×538 |
| mid | 2812×931 |
| far | 2812×931 |

## 캡처·합본 경로

디렉터리: `C:\20.HDev\boxcycle-rider14\apps\web\scripts\rider-preserve\.out\rider14\p4\`

캡처 (Supervisor 대행, 다시 찍지 않음):

- `near-side-s5.png` · `near-side-rider14.png`
- `near-persp-s5.png` · `near-persp-rider14.png`
- `rider-close-s5.png` · `rider-close-rider14.png`
- `shoe-s5.png` · `shoe-rider14.png`
- `phase-0-s5.png` · `phase-0-rider14.png`
- `phase-90-s5.png` · `phase-90-rider14.png`
- `phase-180-s5.png` · `phase-180-rider14.png`
- `phase-270-s5.png` · `phase-270-rider14.png`
- `mid-s5.png` · `mid-rider14.png`
- `far-s5.png` · `far-rider14.png`

합본:

- `pair-near-side.png`
- `pair-near-persp.png`
- `pair-rider-close.png`
- `pair-shoe.png`
- `pair-phase-0.png`
- `pair-phase-90.png`
- `pair-phase-180.png`
- `pair-phase-270.png`
- `pair-mid.png`
- `pair-far.png`

로그: `captures.json`

## 컬러 키트 픽셀

`near-persp-s5.png` · `near-persp-rider14.png` 는 둘 다 960×520. 격자 크롭을 보고 점을 골랐다. 세 라이더는 화면 왼쪽부터 pacer(슬레이트), peer(청록), self(주황)이다. 헬멧은 정수리 밝은 면, 저지는 등판의 단색 면이다. 같은 좌표를 양쪽에서 읽었다. 조명이 들어간 화면색이라 키트 원색과 같지 않다.

| 라이더 | 부위 | x | y | s5 RGB | rider14 RGB | dR | dG | dB |
|---|---|---:|---:|---|---|---:|---:|---:|
| pacer 슬레이트 | 헬멧 윗면 | 178 | 78 | 177, 188, 202 | 175, 187, 200 | −2 | −1 | −2 |
| pacer 슬레이트 | 저지 등판 | 156 | 116 | 149, 161, 177 | 152, 164, 180 | +3 | +3 | +3 |
| peer 청록 | 헬멧 윗면 | 358 | 171 | 158, 190, 182 | 156, 188, 181 | −2 | −2 | −1 |
| peer 청록 | 저지 등판 | 320 | 212 | 90, 182, 181 | 92, 183, 181 | +2 | +1 | 0 |
| self 주황 | 헬멧 윗면 | 792 | 198 | 233, 127, 55 | 250, 135, 51 | +17 | +8 | −4 |
| self 주황 | 저지 등판 | 750 | 236 | 245, 135, 62 | 246, 137, 65 | +1 | +2 | +3 |

여섯 점 모두 배경(보도 224,224,209 / 도로 242,242,242)이 아니다. self 헬멧 윗면만 채널 차가 두 자릿수다. 둘 다 주황 줄무늬 정수리이고, 청록·슬레이트로 바뀌지는 않았다. 같은 라이더의 저지 등판은 채널당 3 이내다.

## 조명 조절판

뜨지 않았다. 추가 캡처 없음.

연 URL (near-persp 구도 + `lightlab=1`):

`http://localhost:5040/scripts/rider-preserve/rider-perf-bench.html?animate=0&riderModel=s5&zoom=22&pitch=67&bearing=-32&riders=3&lightlab=1`

로드 `ready` 후 1.5초, headless Chromium 1280×800, deviceScaleFactor 2, 브라우저 1개 후 종료.

| 확인 | 결과 |
|---|---|
| `.light-lab` 개수 | 0 |
| 본문에 `조명 조절판` | 없음 |
| `[class*=light-lab]` | 없음 |
| 화면에 있는 패널 | 벤치 상태판 `RIDER PERF BENCH` (candidate s5, riders=3, phase 45°) |
| 이 페이지 콘솔 error | 0 |

조절판 컴포넌트는 `App.tsx` 에만 붙어 있고, 벤치 HTML 은 `rider-perf-bench.ts` 만 불러 그 패널을 마운트하지 않는다. 앱 코드는 수정하지 않았다.

## 관찰

합본 10장을 보고, 발이 있는 컷은 원본을 확대해 다시 봤다. `animate=0` 정지 화면이라 깜빡임은 이 캡처로 보지 못한다. 네 위상에서 부품이 빠지거나 위상마다 사라지는 구멍은 보이지 않았다.

| 합본 | 보이는 차이 |
|---|---|
| near-side | 세 라이더 위치·키트(슬레이트/청록/주황)가 같다. s5 저지·반바지는 면이 갈라져 보이고, rider14 는 매끈하다. |
| near-persp | 위와 같다. 헬멧 줄무늬(주황/검, 청록, 회색)는 양쪽에 있다. |
| rider-close | 저지 등·소매의 평면 결이 rider14 에서 매끈해진다. s5 신발은 안쪽이 어둡게 비치고, rider14 갑피는 닫혀 있다. 손·무릎·발의 자리는 같다. |
| shoe | 갑피 차이가 가장 크다. s5 오른발 갑피가 열려 안쪽이 보이고, rider14 는 닫힌 면이다. 페달·크랭크 원반·양말·체인스테이는 같은 자리다. |
| phase-0 | 한 발은 앞쪽 위, 한 발은 바텀브라켓 아래. 양쪽이 같다. 무릎 선이 어긋나 보이지 않는다. 차이는 갑피와 종아리 음영이다. |
| phase-90 | 한 발은 앞, 한 발은 뒤. 양쪽이 같다. 갑피만 닫혀 있다. |
| phase-180 | phase-0 과 발이 바뀐 자세가 양쪽 모두 같다. 아래 신발의 갑피 면이 rider14 에서 닫혀 있다. 페달이 발에서 떨어져 있지 않다. |
| phase-270 | 한 발은 앞으로 뻗고 한 발은 뒤아래. 양쪽이 같다. 갑피 차이 외에는 크랭크·체인스테이가 겹친다. |
| mid | 줌 19. 세 라이더가 같은 도로 위치에 있고, 슬레이트/청록/주황이 남는다. 이 크기에서는 면 결이 읽히지 않는다. |
| far | 줌 17. 같은 자리에 점 셋. 주황·청록·회색이 남고, 빠지거나 늘어난 라이더는 없다. |

계획서 F8·D4 로 예상된 두 가지(저지 셰이딩이 매끈해짐, 신발 갑피가 닫힘)가 근접 컷에서 그대로 보인다. 그 밖에 페달·발·무릎이 위상과 어긋나거나, 몸에 구멍이 나거나, 키트 색이 뒤바뀐 곳은 보이지 않았다. 스포크·프레임 가장자리는 확대 차영상에서 가는 선으로 남는데, 합본에서 바퀴가 돌아가 있거나 프레임이 밀려 있지는 않다.

## 콘솔 오류

`captures.json` 20건의 `errors` 는 전부 `[]` 이다. 캡처 스크립트는 재시도할 때 `errors` 를 비우므로, 재시도로 사라진 일시 실패가 있었는지는 이 파일에 남아 있지 않다. 저장된 최종 기록은 오류 없음. Mapbox 스타일 fetch 실패 문구는 이 로그에 없다.

조명 조절판 확인 페이지의 콘솔 error 도 0건이었다.

## 변경 파일

이번 지시에서 `src/**` 를 수정하지 않았다. 조명값도 바꾸지 않았다. commit · push · `npm install` 없음.

이번 실행으로 다시 쓴 파일은 합본 10개뿐이다 (`pair.py`). `capture-p4.mjs`, `pair.py`, `captures.json`, 캡처 PNG 20장은 Supervisor 대행으로 이미 있던 것이다. 조절판이 뜨지 않아 lightlab 캡처 항목은 넣지 않았다.
