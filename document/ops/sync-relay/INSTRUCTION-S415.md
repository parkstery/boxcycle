# 감리 → 개발팀장 지시서 (활성) — S4-15 좌표 변환 구간 3분기 계측

> S4-14 는 `INSTRUCTION-S414.md` 로 보존했다(감리가 옮겨 둠. 문서 커밋에 담아라).
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-15 (displayDistM → lngLat → project → DOM 중 어디인지 가른다)
- **발신**: 클로드감리0821 · **일시**: 2026-08-21 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-read-amplification` · worktree `C:/20.HDev/rtw-sync-s4-2/repo` (현재 `ade8da9`)

---

## 0. S4-14 판정 — 증상 재현 PASS. 다만 감리 표현을 철회한다

```
확정   증상이 계측으로 재현됐다
확정   기존 replay 가 왜 못 잡았는지 증명됐다 (displayDistM 만 보면 완벽하다)
확정   **문제 구간 = displayDistM 이후부터 최종 DOM 까지**
```

**감리가 쓴 아래 표현을 철회한다.**

```
철회   「peer DOM 에서 원인 확정」      — DOM 은 체인의 끝이다. 그 앞 어디서 들어왔는지 모른다
철회   「카메라와 self 무죄」            — 후보에서 배제할 근거가 아직 없다
```

**이번에 그 구간을 셋으로 가른다. 그 전에는 아무것도 고치지 마라.**

---

## 1. 동일 프레임에 추가 계측할 것

S4-14 의 체인에 **좌표 변환 중간 단계**를 넣는다. 전부 **같은 rAF·같은 시계**다.

```
① peer displayDistM                       (기존)
② getPointOnRouteByDistance() 가 만든 **실제 peer lng/lat**     ← 신규
③ map.project(peerLngLat) 결과                                  ← 신규
④ 실제 self lng/lat  와  map.project(selfLngLat)                ← 신규
⑤ projected peer − self 상대좌표                                ← 신규
⑥ peer / self **DOM** 상대좌표                    (기존 relAnchor)
⑦ 카메라 center · bearing · pitch · zoom  +  **Mapbox render 시점**  ← 시점 추가
```

**②를 반드시 그 프레임에 실제로 쓰인 값으로 기록하라.** 따로 다시 계산하지 마라 —
렌더가 쓴 값과 계측이 쓴 값이 다르면 판정이 무의미해진다.

**⑦의 render 시점**은 카메라 값이 어느 시점 기준인지 가르는 데 필요하다.
`map.on("render")` 시각과 rAF 시각의 차이를 남겨라.

---

## 2. 판정 — 이 분기표대로

```
② lng/lat 부터 왕복한다
   →  **경로 거리 → 좌표 변환 문제**  (getPointOnRouteByDistance)

② 는 정상인데 ③ projected 가 왕복한다
   →  **카메라 · 지도 투영 문제**

③⑤ projected 상대좌표는 정상인데 ⑥ DOM 만 왕복한다
   →  **Marker / Mapbox DOM 갱신 문제**
```

**셋 중 하나로 지목하라.** 어느 것도 아니거나 섞여 보이면 **그렇게 적어라.** 억지로 고르지 마라.

`self` 계열(④)도 같은 분기로 함께 보라 — self 가 어느 단계에서 흔들리는지도 기록에 남는다.

---

## 3. 계측 조건 — 두 가지를 고쳐라

### 3-1. 기록 주기

S4-14 는 111 ms(2인) · 78 ms(단독)로 기록됐다. **약 9~13 Hz 다. rAF 가 아니다.**

```
문제   더 빠른 진동이 에일리어싱된다. 관측된 반전은 유효하나 상한을 모른다
요구   **매 rAF(60 fps)** 기록으로 올려라
       못 올리면 왜 못 올리는지(예: map render tick 에 묶여 있음) 적고
       실제 달성 주기를 명시하라
```

### 3-2. Chief 조건을 실제로 성립시켜라

```
두 라이더 **근접** · **같은 속도** 를 실제로 만들어라
매 프레임 gapDistM 을 기록해 창 전체에서 성립했음을 보여라
```

지금까지 여러 번 어긋났다. **「같은 속도니까 근접」으로 간주하지 마라.**
못 맞추면 실제 간격을 적고 그 사실을 결론에 반영하라.

---

## 4. 표기 정정 — 「회귀 replay」가 아니다

기록된 `relX/relY` 를 다시 검사하는 현재 스크립트는 **캡처를 재검사하는 것**이지
알고리즘을 재생하는 것이 아니다.

```
표기   ❌ 회귀 replay        ✅ **실패 trace**
```

**S414 산출물과 문서의 표기를 고쳐라.** 진짜 회귀 replay 는
알고리즘을 다시 돌려 같은 실패가 나오는 것이고, 아직 그 단계가 아니다.

---

## 5. 금지

- **제품 수정** — 분기가 확인되기 전에는 전부 금지
- **보간 상수 · 마커 로직 수정** (§2 분기 확정 전)
- 카메라 코드 수정 · `publish self vs rAF` 수정
- self 주황 픽셀·무게중심 측정 (폐기된 자다)
- ②를 렌더와 별개로 재계산해 기록 (§1 — 그 프레임에 실제로 쓰인 값이어야 한다)
- 단계마다 다른 프레임의 값을 섞기
- 「peer DOM 원인 확정」·「카메라·self 무죄」 재인용 (§0 — 철회됨)
- 현재 스크립트를 「회귀 replay」로 표기 (§4)
- 적응 발행·흡수(S4-9~S4-13) 혼입 — Firebase 비용 연구선이다
- A·B 모드를 증상 후보로 재인용 — 탈락
- **S4-5 ~ S4-14 를 main2 에 병합** — 금지
- 기존 산출물 덮어쓰기 (`S44-*` ~ `S414-*`)
- `9f3d5e9` ~ `ade8da9` 커밋 reset·revert·amend
- `git add -A` · `commit -a` · `--no-verify` · force · rebase · reset · amend · `python -c`·`sed` 우회 편집
- `C:/20.HDev/rtw-routes/repo` · `C:/20.HDev/rtw-hud-h1/repo` 접촉

---

## 6. 검증

| | 항목 | 기준 |
|---|---|---|
| D0 | 동일 프레임 | ①~⑦ 이 같은 rAF·같은 시계 · 구조로 보장 |
| D1 | ② 실사용 값 | 렌더가 실제로 쓴 lngLat 인가 (재계산 아님) |
| D2 | 기록 주기 | rAF 60 fps 달성 · 못 하면 사유와 실제 주기 |
| D3 | Chief 조건 | 근접·같은 속도가 창 전체에서 성립 · 매 프레임 gap 기록 |
| D4 | 단계별 왕복 | ②③⑤⑥ 각각 반전 횟수·최대·p2p (peer·self 모두) |
| D5 | 분기 판정 | §2 셋 중 하나 · 근거 · 아니면 「미분기」 |
| D6 | render 시점 | `map.on("render")` 와 rAF 시각차 |
| D7 | 표기 정정 | 「실패 trace」로 변경 (§4) |
| D8 | 제품 무변경 | `git diff` · `tsc -b` · 변경 파일 eslint 0 |

**D0·D1 이 깨지면 D5 를 쓰지 마라.**
**D2·D3 이 미달이면 그 한계를 결론에 함께 적어라.** 감추지 마라.

---

## 7. 커밋 · 보고

```
커밋 1  좌표 변환 중간 단계 계측 추가 (동일 프레임 · rAF 주기)
커밋 2  캡처 — S415-chain.json · 분기 분석
커밋 3  표기 정정 (실패 trace) + 문서 — INSTRUCTION · INSTRUCTION-S414.md · REPORT.md
경로 지정 stage. push 후 보고
```

보고 형식.

```
[S4-15 결과]
- 동일 프레임·실사용 값 (D0·D1):
- 기록 주기 (D2): 달성 —
- Chief 조건 (D3): gap 최소/최대/중앙값 —
- 단계별 왕복 (D4):
    ② lngLat      peer / self
    ③ projected   peer / self
    ⑤ projected 상대
    ⑥ DOM 상대
- 분기 판정 (D5): 거리→좌표 / 카메라·투영 / Marker DOM / 미분기 —
- render 시점차 (D6):
- 표기 정정 (D7):
- NEXT:
```

---

## 8. 확정으로 쓰지 말 것

```
「peer DOM 원인 확정」        철회 (§0)
「카메라·self 무죄」          철회 (§0)
확정된 범위                  displayDistM 이후 ~ 최종 DOM. 그 안은 미분기
A · B 모드 · 적응 발행+흡수   증상 후보 아님
S4-5 완료                    금지
S4-4                        **미해결**
```

---

[S4-15 결과]

- 동일 프레임·실사용 값 (D0·D1): 정본 `performance.now()` (MapView rAF `now`). ①~⑦ 한 틱. ② lngLat 은 `syncPeerDomMarkers`에 넘긴 `fc.features` 좌표와 live `sampled`(setLngLat 값). 경로 함수 재실행 없음. `lngLatSource=render-setLngLat`.
- 기록 주기 (D2): 달성 — **아니오. 11.5 Hz** (dt 87 ms, 93프레임). 예약은 `requestAnimationFrame`이다. tickBody 작업 중앙값 55 ms(35–83). e2e 2-browser + Mapbox 비용으로 프레임이 길다. 상한은 이 주기로만 안다.
- Chief 조건 (D3): gap 최소/최대/중앙값 — **2.03 / 2.34 / 2.19 m**. 창 전체 |gap|≤4 m. local 5 km/h 고정 · peer newest 1.39 m/s 고정. `aligned=true`.
- 단계별 왕복 (D4):
    ② lngLat      peer 깨끗(vs display 잔차 max 6e-8 m) / self 깨끗(vs local 잔차 max 5e-8 m)
    ③ projected   peer x 왕복 26 · max 7.88 px · ptp 26.2 px (first i=8) / self x ptp 6e-6 px (팔로우로 화면 중앙 고정)
    ⑤ projected 상대  x 왕복 12 · max 7.88 px · ptp 26.2 px (first i=8) — self proj 가 고정이라 peer ③과 같다
    ⑥ DOM 상대     x 왕복 12 · max 8.0 px · ptp 26.5 px (first i=9)
- 분기 판정 (D5): 거리→좌표 / 카메라·투영 / Marker DOM / 미분기 — **카메라·투영** (② 정상 · ③ peer projected 왕복). self ③은 깨끗해서 self 분기는 **미분기**. ③·⑤·⑥이 같은 크기라 Marker 단독은 아니다.
- render 시점차 (D6): `map.on("render")` 가 rAF now 보다 **뒤**다. raf−render 중앙값 −53 ms (−79 ~ −34). 카메라 적용 후 Mapbox 가 그린다.
- 표기 정정 (D7): `s414-rel-anchor` · `S414-pre-fix-fail.json` · `S414-summary.json` 을 **실패 trace** 로 표기. 회귀 replay 가 아니다.
- NEXT: 제품은 아직 고치지 않는다. 다음 지시는 ②가 깨끗한 채 ③ peer project 만 왕복하는 이유(bearing·지형·좌측 카메라 기하)를 이 반례 위에서 판다. A·B·적응발행은 증상 후보 아님. S4-4 미해결. S4-5~S4-14 main2 병합 금지.

D2 미달(11.5 Hz)은 에일리어싱 상한을 모른다. D3 는 성립했다. 둘 다 감추지 않는다.
