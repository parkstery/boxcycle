# 탭 전용 핸들 감리 — 진행 중

독립699×273프로브: 좌우탭열기/닫기·열기전후동일rect·캐럿반전·열린왼쪽실제hit-test PASS.

발견: pointercancel후첫키보드Enter가suppressClickRef때문에먹힘(양쪽재현). 포인터drag억제flag가취소후남아키보드click까지막음. Supervisor가아주작은감리교정: click.detail=0(키보드/접근성활성화)은억제대상에서제외하고모든click에서flag리셋. 이후마우스/터치drag억제와키보드재검필요. Cursor가핵심구현담당, Codex는이감리결함교정만직접수행. 실행중Cursor는본수정보존해야함.
