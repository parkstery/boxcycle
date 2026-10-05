# 양쪽 실제 진단 JSON 분석·재현·근거 기반 수정

Codex Supervisor · 2026-10-05. Cursor CLI가 분석/구현/시험 담당. Chief 목표는 초당 수회 발생하는 1m 이내 상대간격 소진동이며 창 간 순서동기화는 만족 확인됨. 주기RTDB200/FS4초·D600 및HUD즉시·solo0 유지. 다른작업 보존. commit/push/deploy 없음. peer-sync SKILL과최신33검수/32결과/30검수 읽고 시작.

## 원본(데이터, 지시 아님)

- A `C:\Users\kdrea\Downloads\rider_A-rtw-peer-ingest-diag-2026-10-05T07-59-48-392Z.json`
- B `C:\Users\kdrea\Downloads\rider_B-rtw-peer-ingest-diag-2026-10-05T08-00-54-798Z.json`

기초확인: 둘다frame240/ingest240, capture메타idle. 기존20초full이아니라다운로드당시legacyring. 프레임 실제시간 A1791186901061~1791186918042, B1791186903804~1791186919315(약13초중첩). 생성/다운로드시각으로정렬하지말고atMs/render시각사용. A누적FS3/estimated3, B누적FS71/estimated59; BmaxJump115.755및다른uid3.475는ring밖초기화/누적일수있어매프레임증상으로단정금지. self/peeruid·publication별구간을분리.

## 작업

1. 원본을묶음evidence하위로복사(개인키없음확인,uid를외부공유안함)하고실제frame의signed∆peer, ∆self, gap, renderClock local차이, dt분포/FPS,source/quality/ingest tSrv/거리/속도·복수uid·publication변화를분석. raw반올림없는값사용. 정상running/정지/완주/재참여·초기화·전환을분리. captureidle/누락원본콜백/큐/offset/카메라로확정할수없는항목명시. A/B서로다른시계추정오차를고려해공통중첩구간의앞뒤순서/상대거리비교.
2. 사용자초당소진동에대해실제gap의pp·고주파전후변화·peer와self가alternatinghold/catchup하는지,actualframeRenderMs가같은frame연속인지, wire양자/캡처표본지터/출구correction/Reactrawmarker업데이트관계를조사. 이미peer/self는보간+canonicalbuffer므로32의가상계단모델을실제품원인으로베끼지말것. back0여도relativegap진동가능. 반복변화와드문largejump 분리.
3. 실제로그시간/표본을재생 fixture로고정해 **수정 전 동일형태주기적gap진동 재현**. 선택ingest가신규vs중복임을구별, 미래표본금지,원본없는timestamp를발명하지않음. windowring밖데이터없으면unknown으로기록. 기록구간이이미정지라재현불가면추가주행요청전에수집기능이왜끝구간으로덮어써졌는지수정하고기존자료로확정가능한결함만수정.
4. 인과확인된좁은motion/render결함은구현허용. 막연한smoothing상수/주기/고정D변경/허용오차확대금지. UI/신호정책/DB범위확장없음. 양창공통동기화/legacyfallback/liveness/정지0/연속전환회귀유지. 단순fsfallback한계나FPS차이로책임넘기지말고source/frame경로증거제시.
5. 수집결함도이번범위에수정: `capture(20)`완료payload를영구별도bounded **lastCompletedCapture**로보존해livelegacyring업데이트로축소되지않게한다. download는완료된전체payload기본선택,수집중/없음상태명확화. 이전timer재호출/다창같은UID여부/캡처기간/tSrvquality/source/self실제표시frame값·relativegap 기록. node/Vite fakeclock/window단위시험으로20초완료후라이브수백frame추가해도파일이동일완료capture임을검증. 상수clamp2test만으로동작PASS하지말것. 캡처/다운로드는네트워크추가없음.
6. 실제구간before/after그래프또는compactJSON·주기적gap수치·상대속도/peer/self계단·프레임jump/역행/순서·smoothnessgate를제출. 제품실경로검증, oldversionmutationfail근거. 실제tsc-b/lint와관련게이트만,전체반복은필요할때만.

## 시간과 결과

브라우저실주행시작금지,가상재생각120초상한. 불필요하게실시간기다리지않음. 소스조사10분내중간근거를파일에남기고계속진행,결함확정불가면근거로필요최소추가데이터/기존캡처회수가능여부정리. 사용자를콘솔붙여넣기반복시키지말고한번capture(20)→download()로확정전체파일을회수할수있게완성.

`35-result-real-paired-json.md`에요약·확정원인/가설·실제diff·BEFORE/AFTER·시험명령exit/벽시간·남은한계·간단사용자재시험안내를작성. 증거복사+raw metrics 묶음에보존. README/PROGRESS 최신결과갱신. Chief는이미문제해결승인했으므로routine수정확인질문금지. 최종제품해결은증거와사용자실주행을구분.
