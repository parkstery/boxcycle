# rider15 앱 통합

- 시작: 2026-11-11 · 수퍼바이저 Claude Code · 구현 DeepSeek(`dsh` headless, 모델 `deepseek-flash`)
- 입력: `C:\Users\kdrea\OneDrive\Documents\img\rider15_model_work\release\V3.0_rider15` (모델 승인 완료, 앱 미통합)
- 후보 ID: `20261111-025600-ad1d669d` → `apps/web/public/rider/preserved/candidates/20261111-025600-ad1d669d/`
- 원칙: 제품 활성 모델은 끝까지 `rider14`. rider15는 DEV의 `?riderModel=rider15`로만 켠다. 각 단계는 화면 확인 뒤 다음으로 간다.

## 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| S1 | 자산 복사(rider.glb·rider-lod2.glb·base-layout.json·candidate.json), 해시 대조, 구조 감사 | 완료 11-11 |
| S2 | 등록 + rider15 전용 리그(Hoods 클립을 페달 위상으로 구동, 바퀴 회전) + 레이어 분기. [01-task](01-task.md) | 완료 11-11, 미커밋 |
| S3 | 지도 위 크기·방향·접지 확인(Chief 화면 확인) | **Chief 확인 대기** |
| S4 | 색상 구분(본인·동행·페이서), 근거리와 원거리 모두. [02-task](02-task.md) | 완료 11-11, 미커밋 — S3과 함께 Chief 화면 확인 |
| S5 | 차체 롤·몸 역위상, 그립 보정. 기존 흔들림과 한 경로로 정리 | 대기 |
| S6 | 자세 팩 → 제스처 팩 지연 로드 | 대기 — 결정 2 |
| S7 | rider14와 같은 조건에서 로드 시간·프레임 비용·메모리 비교 | 대기 |
| S8 | 활성 모델을 rider15로 전환 | Chief 승인 필요 |

## 모델 결함 3건 (Chief 발견 11-11) — 앱 통합 S5 이후는 모델 수정 뒤로 보류

둘 다 앱 연결 문제가 아니라 모델(`rider.glb`) 자체에 있다. 측정은 앱과 같은 Three.js 스키닝으로 했다.

1. **발목(양말)이 가늘어짐** — 정강이와 발목 사이 굽힘을 정점 고리 **1줄(20개)** 이 전부 떠맡는다. 기본 자세에서 이 고리 반지름은 30mm(최소 29mm)인데, 주행 클립에서 발목 본이 기본 자세 대비 40~75° 돌아가면서 고리가 찌그러져 최소 반지름이 2~4mm(위상 0.25·0.75)까지 줄어든다. 스케일 트랙은 전부 1이라 원인이 아니다. 참고: 클립에서 정강이 길이가 430→467mm로 늘어난다.
2. **엉덩이 뒤 선이 수직** — 옆에서 본 뒤쪽 윤곽이 높이 0.96~1.08m(12cm) 구간에서 x=−271~−275mm로 거의 일직선이다. 이 정점들은 골반 본 100%라 위상이 바뀌어도 그대로다. 그 아래 0.94→0.92m에서 허벅지 메시로 넘어가며 5cm 계단(−243→−190mm)이 생긴다.

3. **체인링 이가 빠져 보임** — 크랭크에 묶인 메시(정점 639·삼각형 420)에서 체인링 판(반지름 55~120mm)을 5° 구간 72개로 나눠 재면 17개 구간에 면이 없다. P77·P78·P79·P80 네 단계의 빈 구간 배치가 완전히 같으므로 경량화에서 빠진 것이 아니라 P77 원본부터 비어 있다(그 이전 어느 단계에서 생겼는지는 archive를 봐야 안다).

고칠 곳: 모델 원본 `rider15_model_work\v3.0\build\P77_knee_belly_fix\rider15_p77.blend` → P78→P79→P80 재빌드 → 새 후보 ID로 앱에 복사. 앱 코드(S2·S4)는 본·노드 이름과 팔레트 칸이 유지되면 그대로 쓴다.

수정 주체: **Claude 앱**(Chief 결정 11-11). 넘긴 지시·진단서: `C:\Users\kdrea\OneDrive\Documents\img\rider15_model_work\docs\rider15_V3.0_결함3건_수정_지시.md`. 새 release를 받으면 새 후보 ID 폴더로 복사 → `config.ts` candidateId 교체 → 리그·색상 시험 재실행.

## Chief 결정 대기

1. 색상 슬롯 정보를 어디에 둘지. 권장: 앱 코드에 rider15용 슬롯 표(모델을 다시 굽지 않아도 됨).
2. 앱에서 쓸 자세·제스처 범위. 권장: 자세 4종 전부, 제스처는 만세·파이팅·엄지 척부터(제스처 팩 927KB는 필요할 때만 받음).
3. 한 발 접지 정지·전용 손 흔들기는 rider15에 클립이 없음. 권장: 이번 범위에서 제외.

## S2 기록 (구현 DeepSeek `deepseek-flash` · 감리·검증·이음매 수정 Claude Code)

- 새 파일: `src/lib/riderPrototype/rider15Rig.ts`(AnimationMixer 리그), `preservedRiderHandle.ts`(두 리그 공통 인터페이스), `scripts/rider-preserve/rider15-rig.test.ts`. 수정: `config.ts`·`riderModelProfile.ts`·`preservedRiderRig.ts`·`riderPreservedLayer.ts`·`rider-glb-test-loader.ts`.
- 실측: 클립 65키(1/24s~65/24s), 위상 0→첫 키·1→끝 키로 대응(감리 수정 — 0초부터 재면 회전마다 1.5% 멈칫). 바퀴는 크랭크 1회전당 3.2회전(rider14와 같음). 앞허브 (0.583, 0.336)·뒤허브 (−0.412, 0.336)·타이어 바닥 y=−0.0007m로 rider14와 같아 보정 없음.
- 검증(`apps/web`): rider15 리그 시험 8/8, rider14 관련 4종 22/22, 레이어 계약 6/6, `tsc -b --noEmit` 0, 새 파일 eslint 0. 루트: `check:dep` 통과, `test:quick` 1541/0.
- 미검증: 실제 지도 위 렌더·밝기, 폰 성능. rider14의 위상 0과 rider15 클립 시작의 크랭크 각도가 같은지는 S5(흔들림 연결) 때 맞춘다.
- 지금 상태의 한계: 본인·동행·페이서 색이 같음(S4), 흔들림 없음(S5), 원거리에서도 근거리 모델로 그림(S4).
- DeepSeek 제한: `apps/web`에서 실행하면 자체 셸이 권한 오류(`SetNamedSecurityInfoW … grantWrite`)로 막혀 시험을 못 돌린다. 파일 작성은 정상. 검증 명령은 수퍼바이저가 돌린다.

## S4 기록 (구현 DeepSeek `deepseek-flash` 2회 · 실측·감리·순환 의존 수정 Claude Code)

- Chief 결정(11-11): 색상 슬롯 표는 앱 코드에 둔다(`riderModelProfile.ts`의 rider15 프로필).
- 근거리: 팔레트 그림 64×1024를 다시 칠해 `map`과 `emissiveMap`(라이더 재질은 발광 92.5%라 둘 다 바꿔야 함)을 교체. 저지 = 0번 칸 전체 + 62번 칸 위 절반(0~511행), 헬멧 껍데기 = 1번 칸 전체 + 63번 칸 0~434·589~1023행. 63번 칸의 라임 줄무늬·통풍구, 62번 칸 아래 절반(반바지), 20번 칸(프레임 주황)은 그대로. **02-task의 「모든 줄이 같다」는 틀린 실측이다 — 62·63번 칸은 세로로 색이 바뀐다.**
- 원거리: `rider-lod2.glb` 등록. 정점 색을 종류별로 한 번 만들어 갈아 끼움(`riderVertexColorKit.ts`). 저지 = 주황(`#ff3700`) 중 높이 0.95m 이상, 헬멧 = `#d2d8de` 78정점. 프레임 주황은 바이트 동일.
- 본인은 원본 그대로(흰 헬멧·주황 저지), 동행 청록, 페이서 회청(rider14와 같은 키트 색).
- 검증(`apps/web`): rider15 색상 시험 4/4·리그 8/8, rider14 키트·LOD2 시험 통과, 레이어 계약 6/6, `tsc -b --noEmit` 0, eslint 0. 루트: `check:dep` 통과(DeepSeek가 만든 순환 1쌍은 감리에서 끊음), `test:quick` 1545/0.
- 미검증(브라우저에서만 확인 가능): 실제 텍스처 교체 결과의 색·밝기, 두 재질이 같은 텍스처 객체를 공유한다는 전제(`emissiveMap === map`), 원거리 전환 지점에서 색이 이어지는지.

## S1 기록

구조 감사(`node scripts/rider-preserve/audit-rider-glb-structure.mjs`): 노드 46 · 메시 11 · 재질 2 · 스킨 1 · 관절 33 · 애니메이션 1 · 삼각형 18,868. SHA-256 4개 모두 `candidate.json`과 일치.
