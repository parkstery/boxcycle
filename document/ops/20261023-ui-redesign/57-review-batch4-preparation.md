# 감리57 — 묶음4 준비 조사

2026-10-24 23:14 KST · Chief 「작업 다음 계속」 · 조사·계획·HTML: **Cursor CLI**, 범위 설정·감리·기존 시안 눈검: **Codex 직접**. 새 캡처·제품 구현 없음.

## 판정

**PREPARED / AWAITING_CHIEF**. 묶음3은 전체 연속 주행7/7 PASS까지 완료했으나 화면 확인 대기라는 기존 조건은 유지한다. 이번에는 묶음4 구현 전 준비만 완료했다. 커밋·푸시·배포 없음.

## 실제 대조

- `RideSettingsSheet`→`RideSettingsPanel` calorie props와 `App.tsx` 결선을 Codex가 확인했다. 체중·강도 편집은 `ProfileEditSheet`에 이미 있고 주행 설정에도 남아 있다. README의 「입력은 프로필 수정에만」 결정에 따라 중복 편집을 정리할 수 있다.
- `ProfileEditSheet`의 게스트 닉네임 제한·30일 잠금·저장·탈퇴 동작은 표현 변경과 분리해 보존해야 한다.
- `MapViewSheet`와 시안14 PNG를 직접 확인했다. 도로망/3D/노선/고급 주행 카메라 거리 기능이 있다. 고정9에 따라 맵 뷰에 스타일·시점·줌을 복원하지 않는다. 주행 카메라 거리는 현재 기능을 유지하고 임의 제거하지 않는다.
- `RideSummarySheet.onOpenCalorieSettings`는 현재 주행 설정으로 연결된다. 입력을 프로필로 모으는 작업 때 같은 프로필 진입 함수를 연결하는 최소 결선을 검토한다. 데이터 모델·저장 콜백·계산 상수 변경 근거가 아니다.
- Cursor의 「미해결 결정」 여섯 가지는 모두 Chief에게 재질문할 항목이 아니다. 이미 승인한 시안·기존 동작·현재 고정 목록으로 해결할 통상 구현 선택이 포함돼 있다. 실제 구현 지시에서는 센서 버튼을 준비 상태별 기존 콜백에 매핑하고, 이동수단·주행 자동 시작 같은 새 의미를 만들지 않는다. 강도 id·MET는 그대로, 시안 문구와 실제 라벨 차이는 표시 계층에서만 다룬다.
- 계획56의 오래된 「오늘 변경 위 재시험 선행」은 지시50·52에서 이미 완료했다. 묶음3 추가 재시험을 같은 이유로 반복할 필요 없다. 남은 것은 Chief의 화면 확인이다.

## 보존과 범위

새로 관측한 `document/archive/ride-verify-evidence/`의 PNG3장 dirty는 이번 시작 때 이미 있었다. 원인을 추정하거나 되돌리지 않고 시작 SHA256에 포함해 보존했다. 이번에는 제품·시험·기존 시안·기존 캡처를 변경하지 않았다. 지시55 시작 대비 해시 검증 및 문서 링크·HTML 이미지 존재 검사를 수행한다. 제품 변경이 없어 타입·단위·실앱 재시험은 미실행.

## Chief 검토 화면

- 묶음3 최신 비교: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-instruction50.html`
- 다음 묶음4 기존 시안·준비 내용: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-plan.html`

```powershell
cd C:\20.HDev\boxcycle
Start-Process 'C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-instruction50.html'
Start-Process 'C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch4-plan.html'
```

서버·접속 주소 불필요. 새로 열기 때문에 새로고침 불필요. 묶음3 결과·다음 주행을 먼저 확인하고 묶음4 센서·설정·맵 뷰·프로필 시안을 본다. 묶음별 화면 확인 후 다음 단계로 진행하는 근거는 이 묶음 README의 「각 묶음」 절과 Chief의 시안→선택→Supervisor 직접 구현 지시다. 이번 계속 지시를 묶음3 최종 승인으로 기록하지 않는다.
