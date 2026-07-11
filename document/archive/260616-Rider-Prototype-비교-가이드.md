# Rider 프로토타입 비교 가이드

입문·동행(L3) 라이더 표현 A/B용 에셋과 전환 방법.

## 에셋

| 경로 | 설명 |
|------|------|
| `apps/web/public/rider/prototype/iso-self-e.svg` | 본인 — 동쪽 진행 |
| `apps/web/public/rider/prototype/iso-self-s.svg` | 본인 — 남쪽 진행 |
| `apps/web/public/rider/prototype/iso-peer-e.svg` | 동행 — 동쪽 |
| `apps/web/public/rider/prototype/iso-peer-s.svg` | 동행 — 남쪽 |
| `apps/web/public/rider/prototype/rider-lowpoly.glb` | 저폴리 3D (자전거+라이더+지면 그림자) |

GLB 재생성:

```bash
cd apps/web
npm run gen:rider-glb
```

## 모드 전환

`apps/web/.env.local` (또는 배포 env):

```env
# legacy — 기존 pedal-sprite (기본값)
# VITE_RIDER_PROTOTYPE=legacy

# isometric 2D SVG + 닉네임 DOM
VITE_RIDER_PROTOTYPE=iso2d

# Mapbox Model layer + GLB
VITE_RIDER_PROTOTYPE=glb
```

변경 후 dev 서버 재시작.

## 비교 시 체크리스트

- pitch 45~60° 위성+3D 건물 주행 화면
- 동행 2~3명 + 본인
- 줌 14~17
- 진행 방향 전환 시 스프라이트/모델 방향
- 모바일 WebGL (GLB 모드)

## 한계 (프로토타입)

- **iso2d**: 동·남 2종 + 반전으로 8방향 근사. 완전한 8방향 아트 아님.
- **glb**: Mapbox Model layer + GLB, **크랭크·2-bone IK 페달링** (속도 연동). 상세: [GLB 라이더 형상·색상·다리 페달링 보고서](260616-GLB-라이더-형상-색상-다리-페달링-보고서.md).
- **glb**: Mapbox `model` 레이어 미지원 스타일/토큰에서는 자동 실패 → 콘솔 경고.

## 다음 단계 (선택)

1. 비교 후 승자 모드만 남기고 legacy 제거
2. iso2d 승리 시 8방향 일러스트 외주/에셋팩
3. glb 승리 시 Meshy/Blender 저폴리 개선 또는 스켈레톤 페달
