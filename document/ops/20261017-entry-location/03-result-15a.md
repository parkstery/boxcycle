# 결과15a — 기본 위치 버튼 테두리 색

2026-10-18 Developer Cursor. 지시15에서 지금 허용된 한 선언만 수정했다. 커밋·푸시·배포 없음. 기존 dirty 보존.

## 수정

`apps/web/src/components/auth/EntryLocationDialog.css`의 `.entry-location__button` 기본 `border` 색만 `#cbd5e1` → `#2563eb`. 두께 `1px`·스타일 `solid`와 다른 선언은 그대로다.

HEAD 대비 이 파일 diff에는 이전 작업의 네이티브 위치 컨트롤·힌트 규칙이 이미 포함돼 있다. 이번 추가분은 위 테두리 색 한 줄이다. `.entry-location__button--primary`의 기존 `border-color: #2563eb`는 손대지 않았다. 카드 테두리(같은 파일 다른 규칙)와 `.entry-location__native` 테두리는 `#cbd5e1`로 남았다. TSX·문구·인증·위치 로직은 수정하지 않았다.

## 검증

- `git diff -- apps/web/src/components/auth/EntryLocationDialog.css`: `.entry-location__button`의 `border: 1px solid #cbd5e1` → `border: 1px solid #2563eb` 한 줄이 이번 변경. 그 아래 추가 블록은 작업 전 워킹트리에 있던 이전 diff다.
- `git diff --check -- apps/web/src/components/auth/EntryLocationDialog.css` exit 0.
- 브라우저 계산 스타일과 크기는 지시대로 Supervisor 확인. 이번 결과에서는 실행하지 않았다.

## 미구현

첫 위치 버튼 내부 두 줄 `내 위치 근처에서 시작` / `(위치공유 필요)`와 외부 중복 제거는 하지 않았다. 현재 native `<geolocation>`은 브라우저 고정 문구라 자식 내용을 표시하지 않고, 일반 버튼 대체는 차단 복구 의미가 바뀐다. Chief 답변 후 별도 후속 지시. 기존 기본 위치 문구 유지.

## Git

- branch: `main2`
- HEAD: `0936cfe910c4a826c9b829a529478a2f9950d5f2`
- 커밋·푸시·배포 없음
