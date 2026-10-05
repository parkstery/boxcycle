# 실행 계획

1. 기존 AGENTS·Claude·Cursor·ops·Git·CLI를 조사하고 충돌을 기록한다.
2. 공통 역할, Cursor 실행 규칙, ops 프로토콜과 전체 상태판을 최소 변경으로 정리한다.
3. 아래의 문서 전용 harmless 지시를 Cursor CLI에 전달한다. 실제 결과를 읽고 범위·정확성을 검수한다.
4. Git diff와 충돌 여부를 확인하고 완료 보고서를 `document/archive/`에 작성한다.

이번 계획은 기능 코드, Firebase, 패키지, 배포를 건드리지 않는다. 단일 작업 폴더의 지시·결과·검수 파일은 덮어쓰지 않고 순서대로 추가한다.
