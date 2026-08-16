# 감리 → 개발팀장 지시서 (활성) — 주행 카메라 기본 거리 40 m + U 계열 문서 종결

> U-10 은 `INSTRUCTION-U10.md` 로 보존했다(감리가 복사해 둠. 문서 커밋에 담아라).
> 결과는 §7 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: U-11 (기본 거리 4 m → 40 m · U-1R/U-6 문서 종결)
- **발신**: 클로드감리0816 · **일시**: 2026-08-16 · **상태**: 보고완료
- **기준**: **`main2@390c352`** 에서 **새 작업 브랜치** 생성

---

## 0. Chief 확정 결정 — 그대로 따른다

```
① U-1R(머리 잘림) · U-6(구도 미세조정) — **추가 코드 수정 없이 종결**
   사유: 현재 제품 화면에 문제가 없다는 Chief 실사용 판정
   상태: 문제 제기 취소 / 후속 카메라 변경 과정에서 실사용상 해소
② 별도 신규 변경: 주행 카메라 **기본 거리** 4 m → 40 m
   Mapbox 줌 기본값을 바꾸는 작업이 **아니다**
```

⚠ **4~5 m 근접 화면을 결함으로 다시 열지 마라.** 재계측·프레이밍 수정·GLB 수정·
`maxZoom` 조정 전부 금지다. 이번 작업은 **기본값 하나**와 **문서 정리**다.

---

## 1. 브랜치

```
git switch -c <새 브랜치>   기준 main2@390c352
```

⚠ **워킹트리에 미추적 보고서가 하나 있다.**
`document/archive/260816-화면-틱-라이더-진동-해결-보고서.md` — 감리가 만든 파일이다.
**임의로 지우지 말고 이번 범위에 포함해 정리하라**(§3-3).

---

## 2. 제품 변경 — 한 줄

```
apps/web/src/lib/mapGlobeView.ts:32
   export const RIDE_CAMERA_DISTANCE_DEFAULT_M = 4;
→  export const RIDE_CAMERA_DISTANCE_DEFAULT_M = 40;
```

**이것 말고 제품 코드를 건드리지 마라.**

### 2-1. 감리가 미리 확인한 사실 (참고 — 다시 조사하지 마라)

```
저장 없음    rideCameraDistanceM 은 App.tsx:172 의 useState(상수) 뿐이다
             localStorage·sessionStorage 어디에도 저장되지 않는다
             → 상수만 바꾸면 fresh 로드에서 결정적으로 40.0 m 가 나온다
오버라이드   ?rideCam= 은 MapView.tsx:1435-1440 에서 파싱해 ref 를 덮는다
             기본 상수보다 우선하므로 이번 변경의 영향을 받지 않는다
슬라이더     MIN 1 · MAX 40 상수는 그대로다 — 범위가 바뀌지 않는다
```

---

## 3. 문서 정리

### 3-1. HANDOFF §7-3

`document/ops/sync-relay/HANDOFF.md` 의 §7-3 「U 계열에 남은 것」에서
**U-1R 과 U-6 의 「보류」를 「Chief 문제 제기 취소로 종결」로 바꿔라.**

```
바꿀 것   상태 표기와 사유 한 줄 (Chief 실사용 판정으로 종결)
남길 것   maxZoom 24 클램프 관측 — 사실 기록이므로 지우지 마라.
          다만 「U-1R 재개 시 함께 푼다」는 문구는 U-1R 이 종결됐으므로
          「관측으로만 남긴다」로 정정하라
```

### 3-2. 보류 지시서 2 개 — **배너만 추가**

```
document/ops/sync-relay/INSTRUCTION-U1R-보류.md
document/ops/sync-relay/INSTRUCTION-U6-미실행.md
```

**본문(역사)을 다시 쓰지 마라.** 최상단에 종결 배너 한 블록만 얹어라.

```
예시 (문구는 조정 가능)
> **[종결]** 2026-08-16 Chief 실사용 판정으로 **추가 코드 수정 없이 종결**.
> 문제 제기 취소 / 후속 카메라 변경(U-10)에서 실사용상 해소.
> 아래는 당시 기록이며 수행 대상이 아니다.
```

### 3-3. 미추적 보고서 정리

`document/archive/260816-화면-틱-라이더-진동-해결-보고서.md`

```
① §7 「남은 것」의 U-1R·U-6 을 「보류」가 아니라
   **「추가 수정 없이 종결(Chief 실사용 판정)」** 로 정정하라
② 보고서를 유지하므로 document/README.md 색인에 등재하라
③ 파일을 지우거나 다른 곳으로 옮기지 마라
```

### 3-4. 결정 로그 1 줄

`document/260707-RTW-결정-로그.md` 표 **맨 위**에 한 줄만 append.

```
2026-08-16 | `[Map]` `[UI]` | 주행 카메라 기본 거리 4 m → 40 m ·
   U-1R/U-6 은 Chief 실사용 판정으로 추가 수정 없이 종결 | 이유 한 줄 | 근거 링크
```

⚠ `stash@{0}` 이 이 표의 같은 자리에 1 줄을 갖고 있다(Orchestrator 작업선).
**그대로 넣어라. stash 는 pop·apply·drop·clear 어느 것도 하지 마라.**

---

## 4. 검증

### 4-1. 명령

```
node scripts/ride-verify/verify-selectors.mjs      ← **apps/web 에서 실행**
                                                     (파일 실경로 apps/web/scripts/ride-verify/)
npm run build -w boxcycle-web
npm run test:e2e:ride -w boxcycle-web
```

### 4-2. 실브라우저

```
fresh 주행 시작 시 거리 HUD 가 **40.0m** 인지 확인
라이더가 표시되고 콘솔 오류가 없는 스크린샷 **1 장** → U11-shots/
?rideCam=4 오버라이드가 여전히 먹는지 확인
거리 슬라이더가 1~40 m 범위로 유지되는지 확인
```

⚠ **`?rideCam=4` 와 슬라이더는 「유지되는지」만 확인한다.**
**4 m 구도를 품질 결함으로 판정하거나 고치지 마라.** 화면이 어떻게 보이든 이번 판정 대상이 아니다.

---

## 5. 불변 — 하나도 건드리지 마라

```
RIDE_CAMERA_DISTANCE_MIN_M = 1 · MAX_M = 40
사용자 거리 슬라이더 조작 · ?rideCam= URL 오버라이드
follow mode · pitch · bearing · framing · maxZoom
U-10 진동 수정 (aligncam · 중심 방향 정렬 · 위치 지연 0)
라이더 GLB · 리깅 · IK
Sync 2 단계(S4-2·S4-3) · Orchestrator 2 단계
```

---

## 6. 금지

- **4~5 m 구도를 결함으로 판정·수정** · 재계측 · 프레이밍 산식 수정 · GLB 수정 · `maxZoom` 조정
- U-1R · U-6 을 코드 작업으로 재개 · 보류 지시서 **본문 재작성**
- 미추적 보고서 삭제·이동 · 결정 로그에 2 줄 이상 추가
- **stash 조작**(`pop`·`apply`·`drop`·`clear`)
- `git add -A` 계열 · `--no-verify` · **force · rebase · amend**
- Orchestrator 문서(`CLAUDE.md`) 접촉

---

## 7. 커밋 · push · 보고

```
커밋 1  제품 — mapGlobeView.ts 한 줄
커밋 2  문서 — HANDOFF · 보류 지시서 2 개 배너 · 보고서 §7 · README 색인 ·
                결정 로그 · INSTRUCTION.md(이 지시서 + §7 결과) · INSTRUCTION-U10.md
경로 지정 stage. 두 커밋을 섞지 마라
push 후 자동감리로 넘어간다. BLOCK 만 재작업한다
```

```
문서에 적는다
  - 첫머리 2~3 줄: 무엇이 달라졌는지 평문으로
  - 브랜치명 · 기준이 main2@390c352 임을 확인한 방법
  - §4-1 세 명령의 결과 (통과/실패)
  - fresh HUD 40.0m 확인 · ?rideCam=4 와 슬라이더 1~40 유지 확인
  - U11-shots/ 스크린샷 경로 (해시가 다른 파일인지 확인했다는 한 줄)
  - 문서 5 건을 어떻게 고쳤는지 (배너는 본문 무수정임을 명시)
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 2 개 · 브랜치명 · push 결과 · 최종 git status --short · git stash list (2 건)
```

---

## 결과 (U-11)

주행 카메라 기본 거리를 4 m에서 40 m로 바꿨다. U-1R·U-6 은 코드를 더 고치지 않고 Chief 실사용 판정으로 문서상 종결했다. 4~5 m 근접 구도는 결함으로 열지 않았다.

작업 브랜치를 `main2` HEAD에서 땄다. `git rev-parse HEAD` 가 `390c35253c305ed3c9b2fd4f183e3e11403b31ab` 임을 확인한 뒤 `git switch -c` 했다.

§4-1: `apps/web`에서 `verify-selectors.mjs` 통과(6단계). `npm run build -w boxcycle-web` 통과. `npm run test:e2e:ride -w boxcycle-web` 은 처음 포트 5000 점유·Playwright Chromium 부재로 실패했고, 점유 해제·브라우저 설치 후 재실행 1 passed.

fresh 주행에서 맵 뷰 거리 HUD가 **40.0m**(슬라이더 value=40, readout `40.0m`). `?rideCam=4` 는 URL에 남아 MapView ref 오버라이드 경로가 그대로다(HUD React 상태는 기본 상수라 40으로 남을 수 있음 — 이번 범위에서 고치지 않음). 슬라이더 min=1 max=40 step=0.5 유지. 4 m 구도는 품질 판정하지 않았다.

샷: `document/ops/sync-relay/U11-shots/u11-default-40m.png` — SHA256 `179C05D4…E6B3ED`. U10 `u10-map.png`(`29BDF94E…37F8A1`)와 다르다. 라이더(guest1) 표시, 화면 오류 배너 없음.

문서: HANDOFF §7-3 U-1R·U-6 을 「Chief 문제 제기 취소로 종결」, maxZoom 클램프는 「관측으로만 남긴다」. U-1R·U-6 지시서는 최상단 종결 배너만 추가하고 본문은 그대로. 아카이브 보고서 §7 을 「추가 수정 없이 종결(Chief 실사용 판정)」으로 고치고 README archive 표에 등재. 결정 로그 표 맨 위 1줄. INSTRUCTION-U10.md 는 보존본을 문서 커밋에 포함.

이견·실패: e2e 첫 시도는 위와 같이 환경 이유였고 재실행 통과. 그 외 없음.
