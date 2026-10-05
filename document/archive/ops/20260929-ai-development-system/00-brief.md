# 요구 요약

Chief 요구: Codex Supervisor가 `document/ops`에 작업지시를 남기고 Cursor CLI Developer가 이를 읽어 수행 결과를 남기는 운영체계를 세운다. Chief의 복사·붙여넣기 중계를 없애고 기존 Claude 기록과 도메인 지침을 보존한다. 이번 작업에서는 애플리케이션 소스·의존성·Firebase 설정을 수정하지 않는다.

완료 조건: 공통·Cursor 규칙의 역할과 범위가 일치하고, ops 상태와 지시→결과→검수가 추적되며, Windows에서 Cursor CLI 파일 왕복이 실제로 작동한다.
