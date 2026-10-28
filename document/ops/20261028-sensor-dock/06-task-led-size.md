# 접힌 LED 지름 3배 — Chief 후속 지시

구현 Cursor AI / 감리 Codex. 단순 CSS 수정, 즉시 수행. 당신은 혼자 작업하지 않으며 기존 dirty를 보존한다.

`apps/web/src/components/route-dock/RouteDock.css`의 `.route-dock__led` width/height 현재8px를 **24px로 변경**한다(보이는 지름3배). `.route-dock__led-toggle`28px터치영역은 이미24pxLED를포함하므로 유지. 펼친패널안7px센서LED/기존접기버튼/위치/색/점멸변경금지. 제품수정은 이CSS2줄만. UI고정45의최신지시이며 문서는Codex소유.

커밋푸시배포·restore/clean/stash/worktree·다른dirty수정·기존증거덮어쓰기금지. 새시험코드작성/전수탐색/전체빌드/전체회귀불필요. CSS diff와기존5031응답확인후 `07-result-led-size.md`에변경/검증/미실행간단히기록하고종료. 감리는Codex가기존sensor-dock시험과실제24pxDOM실측을수행한다. 3분내완료목표.
