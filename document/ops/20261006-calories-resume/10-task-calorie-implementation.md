# 칼로리 계산 개선 구현

담당 Cursor CLI. 02-audit·03-calorie-proposal 읽고 구현. Chief 2026-10-06 '계속해. 칼로리 계산 변경해'로변경승인. 칼로리scope만, 코드필요부분조사/토큰절약, 결과11-result-calories.md. 커밋/push/배포/production기록수정금지. 새외부API/Rules권한확대없음.

## 확정 계산/UX

가상km×30을신규세션에서폐기. gross kcal = MET × weightKg × 실제활동seconds/3600. 정수표시,중간계산은누적float. 체중+강도없으면숫자추정값은null, UI '—'+'체중·강도 설정' 진입(기존 주행설정/사용자설정 중 적합한표면1개). 체중임의70kg가정금지. 범위30~300kg 숫자검증, 강도가벼움4/보통6/강함8MET(사용자선택, 실제watts측정주장금지). '추정 kcal' 표기·총 운동 에너지/활동시간·선택강도 근거 짧은설명. 체중·강도설정은uid별기존client persistence, 인증전영속금지, user切替섞임금지. 체중cloud저장은이번불필요(민감정보최소화).

실제활동시간: 기존cadence>0 pedalSec와동일한신호policy우선재사용. pause·센서없음/수동가상속도주행은소모열량측정으로간주하지않음(칼로리'—'; 센서페달신호·체중·강도필요). 신호연결후RPM0은0증가,센서일시끊김도증가중단·구간누락표시. 연결한것과실페달초를구분. 기존conquest계산/인정변경금지. session 시작에체중/METsnapshot고정, 중간설정변경다음주행부터, 재개offset미포함, pause제외, user변경reset. 실제기존pedalSec가유효running만누적되는지확인. cadence만으로강도자동추정금지.

## 저장/일치

계산 pure helper를single SoT, HUD/App/RideSummary/rideend persistence가동일session snapshot/활동초결과사용. 신규caloriesEstimate:number|null 허용(UI/aggregate/Firestore route읽기/legacy서버backfill일치수정). null을0kcal로표시/진짜측정0로통계오인금지. metadata 버전'MET-gross-v1',weightKg/MET/activeSec/inputMethod(cadence)/estimated/신호누락가부를snapshot. clientlocal에weight보관; ridemetadata클라우드에는weight를기록하지않아도원본 kcal/MET/activeSec/method 충분하므로체중cloud불필요, 로컬재계산원본과식별구분. 기록에개인체중가급적남기지않음. 과거legacy number그대로표시/집계하고 method없는옛기록은거리환산legacy임을도움말에구분. 기존기록소급변경없음. functions가calorie미재계산인지검증만. 통계unknown count가있으면'추정값있는주행합계/미산정N회'를표시할수있는최소확장, null->0coercion으로모든주행총칼로리라고과장금지.

## 동시작업/ownership

동일workspace다른Cursor가resume재작업중. ownership: caloriepurehelper/settingshook/UI/metadata, RideSettingsSheet 또는적합settings컴포넌트, RideSummarySheet, rideSessionsStorage/firestoreRides/rideStatsAggregate의칼로리부분, App칼로리·session snapshot·표시배선, UserInfoSheet칼로리통계부분, useRideEndAndPersistence의칼로리부분. resume관련영역파일은변경금지. App/UserInfoSheet최신기준partialpatch, 다른변경revert금지. 필요공통type도최소. main변경종료직전다른work와tsc대조.

## 검증

70kg30min6MET=210;pause/virtualdistance/profile변화불변;offset재개이번활동초만;weight/강도미설정null;manualnull;rpm0증가없음;센서disconnect구간미산정/가정금지;session설정snapshot;HUD/summary/stored일치;legacy숫자유지/newnullreaderaggregate;user切替. meaningful pure+핵심배선시험. tsc·lints·selectors,관련기존ride-result/statisticstests. 설정UI740×300캡처간격·줄넘침, Browser인증우회/실데이터변경금지. 실패/미실행구분.
