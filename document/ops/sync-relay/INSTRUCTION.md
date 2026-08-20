# 감리 → 개발팀장 지시서 (활성) — S4-14 전체 체인 동일 프레임 계측 (증상 라인 복귀)

> S4-13 은 `INSTRUCTION-S413.md` 로 보존했다(감리가 옮겨 둠. 문서 커밋에 담아라).
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-14 (local rAF → peer buffer → displayDistM → 카메라 → DOM marker 를 한 시계로)
- **발신**: 클로드감리0821 · **일시**: 2026-08-21 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-read-amplification` · worktree `C:/20.HDev/rtw-sync-s4-2/repo` (현재 `14cbae8`)

---

## 0. S4-13 결과를 정식 증거로 기록한다

**Chief 실주행 판정**

```
OFF / A / B  세 모드 모두 톡톡 튐이 보였고, 체감 차이를 분간할 수 없었다
```

**A·B 는 S4-4 해결 후보에서 탈락한다.**

### 0-1. 탈락 사유 — Cursor 구현 실패가 아니다

**감리 설계 오류다.** S4-13 §2-1 에서 「적응 발행은 켜지 마라」고 지시했는데,
그것이 **흡수가 없앨 대상 자체를 제거했다.**

```
S4-12 후보     적응 발행(71→38건) + 흡수     점프 최대 7.73 → 1.51 px
S4-13 노브     발행 10 Hz 유지 + 흡수만      원래 불연속이 작아 흡수할 것이 없다
               → OFF 와 구별 불가. 평가한 적 없는 조합을 시험한 것이다
```

**Cursor 는 지시대로 만들었다. 배선도 확인했다**(매 rAF 모드 판독 · live peer 에 흡수 적용 · 렌더가 그 `displayDistM` 사용).

### 0-2. S4-5 도 증상을 해결하지 못했다

**OFF 에는 이미 S4-5 의 송신 시간축 변경이 들어 있다.** 그 OFF 에서 증상이 보였다.

```
금지   recvAtMs 를 증상의 단독 원인으로 확정하는 것
금지   S4-5 를 「완료」로 선언하는 것
```

S4-5 는 **도착 지터를 줄인 개선**이고, 그것으로 증상이 사라지지 않았다는 사실을 기록한다.

### 0-3. 기준 관찰 재고정

```
단독 주행은 매끄럽다. 동시 주행에서 **peer 만** 튄다.
```

**「내 라이더가 흔들린다」로 되돌아가지 마라.** 카메라·local 시간축 불일치는 **후보로 유지**할 수 있으나,
**self 주황 픽셀 측정으로 검증하지 마라** — R7 의 자전거 무게중심 측정기는
**애니메이션·경로선 혼입으로 폐기된 자**다.

---

## 1. 이번에 할 일 — 계측뿐이다

```
새 노브 · 새 상수 · 새 예측 알고리즘 금지
제품 수정 금지 — **처음 이상해지는 단계가 확인되기 전에는 아무것도 고치지 마라**
```

동일 프레임에서 전체 체인을 한 시계로 묶는다.

### 1-1. 한 프레임에 기록할 것

```
① local 실제 rAF 거리        sampleVirtualDistanceM() / virtualDistanceRef 의 그 프레임 값
② peer buffer                newest 스냅샷 — distM · speedMps · serverAtMs · recvAtMs · seq
                             + 버퍼 길이 · 사용 축(server/recv)
③ peer displayDistM          integrator 출력
④ 카메라 transform           center · bearing · pitch · zoom (그 프레임에 실제 적용된 값)
⑤ peer DOM marker root       `peerDomMarkersRef` 의 marker element 의 **실제 transform**
                             (mapbox 가 쓴 translate px 를 읽는다)
⑥ self anchor                live rider marker root 의 같은 방식 transform
⑦ **peerAnchor − selfAnchor**  ← Chief 증상의 정의. 이것이 주지표다
```

**시계는 하나다.** `performance.now()` 를 정본으로 쓰고 `Date.now()` 를 함께 남겨라.
**단계마다 다른 프레임의 값을 섞지 마라** — 같은 rAF 안에서 읽어야 한다.

### 1-2. 픽셀 분석을 쓰지 마라

⑤⑥ 은 **DOM element 의 transform 을 직접 읽는다.** 스크린샷 픽셀 군집을 세지 마라.
mapbox 가 마커에 쓴 좌표가 곧 그려진 위치이고, 애니메이션·경로선이 섞이지 않는다.

---

## 2. 판정 — 어느 단계에서 처음 어긋나는가

```
①  local rAF 거리        단조 전진인가
②  peer 원본 패킷        단조 전진인가 (distM · serverAtMs)
③  peer displayDistM     여기서 처음 왕복이 생기는가
④  카메라               center·bearing 이 프레임마다 떠는가
⑤⑥ DOM transform        ③④ 가 깨끗한데 여기서 처음 떠는가
⑦  peerAnchor−selfAnchor 최종 증상. 위 어느 단계와 상관이 있는가
```

**「처음 이상해지는 단계」를 하나로 지목하라.** 그 앞이 깨끗하면 그 뒤를 본다.
**단정하지 말고 관측으로 지목하라.** 지목이 안 서면 관측한 것만 적어라.

### 2-1. 조건

```
2인 동시 주행 · Chief 가 실제로 보는 화면 설정
샷 간격이 아니라 **매 rAF 기록** (60 fps)
증상이 보이는 구간을 포함해야 한다 — 안 보이는 구간만 찍고 「재현 실패」로 적지 마라
단독 주행도 같은 계측으로 한 번 — **매끄럽다는 관찰을 계측으로 확인한다** (대조군)
```

산출: `S414-chain.json` · `S414-summary.json` · 증상 구간 표시

---

## 3. 반례 고정 — 이것이 있기 전에는 어떤 수정도 없다

```
3-1  캡처 로그를 replay 시나리오로 고정하라
3-2  기존 replay 는 displayDistM 만 검사한다. 그것만으로 통과한다면
     **화면 상대좌표 계층을 확장하라** — peerAnchor−selfAnchor 를 검사하는 층을 추가한다
3-3  그 시나리오가 **수정 전에 실패**해야 한다
```

**3-3 이 성립하기 전에는 새 해결 구현을 시작하지 마라.**
수정 전에 실패하지 않는 시험은 회귀 가드일 뿐 증명이 아니다.

---

## 4. 연구선 분리

```
적응 발행 + 흡수 (S4-9 ~ S4-13)   →  **Firebase 비용 연구선**으로 보존
                                      현재 증상과 섞지 마라. 이번 지시에서 손대지 마라
```

산출물·커밋은 그대로 두되, **증상 해결의 후보로 인용하지 마라.**

---

## 5. 금지

- **제품 수정** — 처음 이상해지는 단계 확인 전에는 전부 금지 (§1)
- 새 노브 · 새 상수 · 새 예측/보간 알고리즘
- self 주황 픽셀·무게중심 측정 (§0-3 — 폐기된 자다)
- 「내 라이더가 흔들린다」를 전제로 한 계측 설계
- `recvAtMs` 단독 원인 확정 · S4-5 「완료」 선언 (§0-2)
- A·B 모드를 증상 해결 후보로 재인용 (§0-1 — 탈락)
- 적응 발행·흡수를 증상 라인에 혼입 (§4)
- 단계마다 다른 프레임의 값을 섞기 (§1-1)
- 반례(§3) 없이 해결 구현 착수
- **S4-5 ~ S4-13 을 main2 에 병합** — 금지다
- 기존 산출물 덮어쓰기 (`S44-*` ~ `S413-*`)
- `9f3d5e9` ~ `14cbae8` 커밋 reset·revert·amend
- `git add -A` · `commit -a` · `--no-verify` · force · rebase · reset · amend · `python -c`·`sed` 우회 편집
- `C:/20.HDev/rtw-routes/repo` · `C:/20.HDev/rtw-hud-h1/repo` 접촉

---

## 6. 검증

| | 항목 | 기준 |
|---|---|---|
| C0 | 동일 프레임 | ①~⑦ 이 같은 rAF 에서 읽혔음을 구조로 보장 · 시계 정본 명시 |
| C1 | 계측 생존 | 각 항목이 비-0 으로 변화 · 상수·센티넬 0 건 |
| C2 | DOM transform | 픽셀 분석 아님 · marker element 의 실제 transform |
| C3 | 증상 구간 포함 | 튐이 보이는 구간이 로그에 들어 있음을 제시 |
| C4 | 단독 대조군 | 단독 주행 같은 계측 · 매끄러움이 수치로 확인되는가 |
| C5 | 단계 지목 | 처음 이상해지는 단계 하나 · 근거 |
| C6 | 반례 고정 | replay 시나리오 · **수정 전 실패** 로그 |
| C7 | 계층 확장 | displayDistM 만으로 통과하면 화면 상대좌표 층 추가 |
| C8 | 제품 무변경 | `git diff` · `tsc -b` · 변경 파일 eslint 0 |

**C0·C1 이 깨지면 C5 를 쓰지 마라.**
**C4 가 「단독도 튄다」로 나오면 즉시 멈추고 보고하라** — 기준 관찰과 어긋나므로 계측을 의심해야 한다.

---

## 7. 커밋 · 보고

```
커밋 1  전체 체인 계측 (동일 프레임 · DOM transform)
커밋 2  캡처 — S414-chain.json · 단독 대조군
커밋 3  반례 시나리오 + 화면 상대좌표 계층 확장 (수정 전 실패 상태)
커밋 4  문서 — INSTRUCTION · INSTRUCTION-S413.md · REPORT.md
경로 지정 stage. push 후 보고
```

보고 형식.

```
[S4-14 결과]
- 동일 프레임 보장 (C0): 시계 정본 · 구조 —
- 계측 생존 (C1):
- 증상 구간 (C3): 어디인가 —
- 단독 대조군 (C4): 매끄러움이 수치로 확인되는가 —
- 단계별 관측: ①local ②패킷 ③displayDistM ④카메라 ⑤⑥DOM ⑦anchor차
- 처음 이상해지는 단계 (C5): —
- 반례 고정 (C6): 수정 전 실패 로그 —
- 계층 확장 (C7):
- NEXT:
```

---

## 8. 확정으로 쓰지 말 것

```
A · B 모드                  탈락 (§0-1). 증상 후보로 인용 금지
recvAtMs 단독 원인          금지 (§0-2)
S4-5 완료                   금지 (§0-2)
「내 라이더가 흔들린다」      기준 관찰과 어긋난다 (§0-3)
적응 발행 + 흡수             Firebase 비용 연구선. 증상과 별개 (§4)
S4-5 ~ S4-13 main2 병합      금지
S4-4                        **미해결**
```

---

[S4-14 결과]

- 동일 프레임 보장 (C0): 시계 정본 · 구조 — 정본 `performance.now()` (MapView rAF `now`). `Date.now()` 동반. ①~⑦ 은 `tickRideCameraFollow` → `syncPeerDomMarkers` → `notePeerChainFromMapTick` 한 틱에서 한 객체로 묶인다. `sameRaf: true`.
- 계측 생존 (C1): 상수·센티넬 0 아님. pair 73프레임 localDistM≈233 m 전진, gap 4.93–5.35 m, selfAnchor≈(652,369), peerAnchor≈(207,365), 축 **server**, buf 16.
- 증상 구간 (C3): pair `pair-chief-left-16m-5kmh` 전체. 좌측·`rideCam=16`·5 km/h. display 간격 ~5.1 m (나란히 창). relX 왕복 13회 · 최대 19 px · ptp 39 px. (hold 플래그 `aligned=false` 는 |gap|≤4 m 1초 미달. 측정 간격은 5 m 창이다.)
- 단독 대조군 (C4): 매끄러움이 수치로 확인되는가 — **예.** local 역행 0. peer 없음. self DOM x ptp 7 px. pair 의 peer DOM x ptp 37 px 와 대비. 「단독도 튄다」가 아니므로 계측을 버리지 않음.
- 단계별 관측: ①local 단조(역행 0) · ②패킷 dist·serverAtMs 단조 · ③displayDistM 역행 0 · ④카메라 bearing ptp 1.4° 왕복 0 · ⑤peer DOM x 왕복 19회 max 19 px · ⑥self DOM x ptp 10 px(게이트 미달) · ⑦relAnchor x 왕복 13회 max 19 px 같은 프레임(i=3)부터.
- 처음 이상해지는 단계 (C5): **⑤ peer DOM transform** (⑦ 상대좌표도 같은 프레임에서 깨진다). ③ displayDistM 은 깨끗하다. recvAtMs 단독 원인으로 쓰지 않는다. 축은 server 였다.
- 반례 고정 (C6): 수정 전 실패 로그 — `S414-pre-fix-fail.json`. displayDistM replay **통과**. relAnchor 층 **실패**(x 왕복 13, 예: i=10 Δ−19.1 px). `preFixFail=true`.
- 계층 확장 (C7): 기존 replay 는 displayDistM 만 봐서 통과 → `s414-rel-anchor.mjs` 가 peerAnchor−selfAnchor DOM translate 를 검사. 시나리오 `S414-scenario.json`.
- NEXT: 제품 수정은 아직 하지 않는다. 다음 지시는 ⑤ DOM/투영이 왜 왕복하는지(카메라 미세 요동과의 결합 포함)를 그 반례 위에서 파야 한다. A·B·적응발행은 증상 후보가 아니다. S4-4 미해결. S4-5~S4-13 main2 병합 금지.

e2e 부하에서 MapView rAF 는 ~9 Hz(dt≈111 ms) 였다. 프레임을 섞지는 않았다. 스크린샷 픽셀·무게중심은 쓰지 않았다.
