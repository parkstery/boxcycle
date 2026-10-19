# 결과28 — 위치창 중앙·나침반·폭20%축소

2026-10-20 Codex직접. EntryLocationDialog CSS/제목·CSS단위계약만변경. fullviewport flex center/12px안전여백,🧭aria-hidden제목13px한줄. 기존버튼186→148.8px(-20%),카드220→182.8px,좌우padding16px·border1px·높이44px유지. 내부여백은확대/축소하지않았다.

검증: `.out/location-design-preview.mjs` 실제React 667×300/844×390/1366×768 ×4상태총12 exit0. 중심오차1px미만,버튼148.796875×44/카드182.796875,기본높이162·차단안내246,overflow없음·각callback1회. `.out/location-design` PNG직접확인. fixture는중립배경이며실지도화면합격으로보고하지않음.

단위26/selector19/전체web1295 PASS,변경lint·build·diff검사exit0. build의기존riderRig/bundle경고,시험동시실행중ViteHMR24678사용중경고는있었으나시험완료exit0. 실폰미검증. 인증/서버/Rules/계정데이터변경없음. 기존다른dirty보존.

커밋06ae57ca→main2병합87ab273f·원격반영. 커밋사본 `.out/release26` 빌드후hosting만배포exit0. 운영200/JS index-CEkhRptq.js·CSS index-B9O5gLrU.css일치. 로그 `.out/location28-{push,deploy,release-build}.log`.
