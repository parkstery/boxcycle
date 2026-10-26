# 지시 82 — 인트로 Spinatlas 심벌 3회 역회전

## Chief 요구

- 인트로 상단 Spinatlas 심벌의 회전 방향을 현재와 반대로 바꾼다.
- 정확히 세 바퀴를 돌고 멈춘다.
- `prefers-reduced-motion` 사용자는 기존처럼 애니메이션을 보지 않는다.

## 범위

- `apps/web/src/components/auth/AppIntroScreen.css`의 심벌 애니메이션과 키프레임
- 위 계약을 잠그는 정적 회귀시험
- Chief 지정 디자인 고정 목록과 ops 기록

## 금지

- 심벌 SVG, 워드마크, 인트로 레이아웃·버튼·배경 변경
- 다른 화면의 로고 동작 변경
- 기존 dirty 파일·실행 중인 `localhost:5000` 서버 변경

## 완료 조건

1. 기존 `-180deg → 0deg`와 반대 방향이다.
2. 각도 변화량이 정확히 1080도이고 최종 상태가 정지한다.
3. 3.3초·기존 easing·`both`를 유지한다.
4. reduced-motion은 `animation: none`이다.
5. 관련 시험과 `git diff --check`가 통과한다.
