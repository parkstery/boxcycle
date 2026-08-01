"""라이더 팬츠(shorts) 색을 판정용 RED 로 바꾼다(F5-1).

**판정용 표식이지 최종 디자인이 아니다.** 목적: 팬츠(검정)와 안장(검정)이 렌더에서 구분되지
않아 사용자가 착좌 위치를 육안으로 볼 수 없었다. 팬츠만 RED 로 바꿔 대비를 만든다.

구조(실측 2026-08-01): 라이더는 머티리얼 1개(RTW_PBR_PALETTE) + 128x16 팔레트 텍스처를
`UVMap.001` 로 찍는다. 그 레이어의 고유 UV 는 8개뿐이고 각 셀이 한 색을 뜻한다:

  uv[0.06,0.5] 피부   uv[0.44,0.5] **검정(팬츠+장갑 공유)**  uv[0.69,0.5] 신발·머리카락
  uv[0.31,0.5] 저지   uv[0.94,0.5] 고글                      uv[0.81,0.5] 헬멧
  uv[0.56,0.5] 신발밑창 uv[0.19,0.5] 입

⚠ **팬츠와 장갑이 같은 셀을 공유한다**(둘 다 검정이었으므로). 팔레트 픽셀만 바꾸면
장갑까지 빨개진다 — 실제로 첫 시도에서 그렇게 됐다. 따라서:

  1) 팔레트의 **빈 셀**에 RED 를 쓰고
  2) **팬츠 폴리곤의 UV 만** 그 빈 셀로 옮긴다(장갑 UV 는 그대로 둔다).

팬츠와 장갑은 지배 vertex group 으로 가른다: 팬츠 = PELVIS/THIGH_*, 장갑 = HAND_*.
형상·치수·자세·본은 전혀 건드리지 않는다 — UV 와 팔레트 픽셀만 바뀐다.

색: 헬멧이 이미 red(linear 0.722,0.141,0.161 — 밝고 연함)이므로 팬츠는 명도·채도를 달리한
deep red(linear 0.55,0.02,0.04 = sRGB 196,39,56)를 써서 헬멧·저지(파랑)·안장(검정)과 구분한다.
"""
import bpy

RIDER_OBJ = "RTW_RIDER_LOD0"
SHARED_BLACK_UV = (0.44, 0.5)          # 팬츠+장갑이 공유하는 검정 셀
SHORTS_RED_LINEAR = (0.55, 0.02, 0.04)  # 판정용 deep red
# 팬츠를 옮겨 담을 빈 셀 — 팔레트 128x16 에서 쓰이지 않는 v 행을 쓴다.
# 기존 셀은 전부 v=0.5(중간 행)이므로 v=0.15 는 비어 있다.
SHORTS_NEW_UV = (0.44, 0.15)
SHORTS_GROUPS = ("PELVIS", "THIGH_L", "THIGH_R")
HAND_GROUPS = ("HAND_L", "HAND_R")


def _palette_image(mat):
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and "basecolor" in n.image.name:
            return n.image
    raise RuntimeError("basecolor 팔레트 텍스처를 찾지 못했다")


def recolor_shorts(obj_name=RIDER_OBJ, rgb=SHORTS_RED_LINEAR, verbose=True):
    """팬츠 폴리곤만 새 팔레트 셀로 옮기고 그 셀을 RED 로 칠한다.

    반환: (옮긴 폴리곤 수, 칠한 픽셀 수). 둘 중 하나라도 0 이면 예외 — 조용한 실패 금지.
    """
    obj = bpy.data.objects.get(obj_name)
    if obj is None:
        raise RuntimeError("라이더 오브젝트 없음: %s" % obj_name)
    me = obj.data
    if "UVMap.001" not in me.uv_layers:
        raise RuntimeError("팔레트 UV 레이어(UVMap.001)가 없다")
    lay = me.uv_layers["UVMap.001"].data

    vg = [g.name for g in obj.vertex_groups]
    idx = {n: i for i, n in enumerate(vg)}
    shorts_ids = {idx[n] for n in SHORTS_GROUPS if n in idx}
    hand_ids = {idx[n] for n in HAND_GROUPS if n in idx}
    if not shorts_ids:
        raise RuntimeError("팬츠 vertex group 을 찾지 못했다: %s" % (SHORTS_GROUPS,))

    def dominant(vi):
        best, bw = None, 0.0
        for g in me.vertices[vi].groups:
            if g.weight > bw:
                bw, best = g.weight, g.group
        return best

    moved = 0
    for poly in me.polygons:
        us = [lay[li].uv for li in poly.loop_indices]
        cu = sum(u[0] for u in us) / len(us)
        cv = sum(u[1] for u in us) / len(us)
        # 공유 검정 셀을 쓰는 폴리곤만 대상
        if abs(cu - SHARED_BLACK_UV[0]) > 0.02 or abs(cv - SHARED_BLACK_UV[1]) > 0.02:
            continue
        doms = [dominant(vi) for vi in poly.vertices]
        n_short = sum(1 for d in doms if d in shorts_ids)
        n_hand = sum(1 for d in doms if d in hand_ids)
        if n_short > n_hand:                 # 팬츠 쪽이 우세한 폴리곤만 옮긴다
            for li in poly.loop_indices:
                lay[li].uv = SHORTS_NEW_UV
            moved += 1

    if moved == 0:
        raise RuntimeError("팬츠 폴리곤을 하나도 옮기지 못했다 — 메시/UV 구조 변경 의심")

    # 새 셀에 RED 를 칠한다(기존 검정 셀은 그대로 → 장갑 색 유지)
    img = _palette_image(me.materials[0])
    W, H = img.size
    px = list(img.pixels)
    x = min(W - 1, max(0, int(SHORTS_NEW_UV[0] * W)))
    y = min(H - 1, max(0, int(SHORTS_NEW_UV[1] * H)))
    painted = 0
    for dy in (-1, 0, 1):                    # 셀 중심 주변까지 칠해 샘플링 흔들림 방지
        for dx in (-1, 0, 1):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H:
                i = (yy * W + xx) * 4
                px[i], px[i + 1], px[i + 2] = rgb
                painted += 1
    img.pixels[:] = px
    img.update()

    if verbose:
        print("팬츠 recolor: 폴리곤 %d개를 uv%s 로 이동, 팔레트 %d픽셀 RED%s (장갑 UV 유지)"
              % (moved, list(SHORTS_NEW_UV), painted, list(rgb)))
    return moved, painted


if __name__ == "__main__":
    import sys
    _A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if _A:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=_A[0])
        recolor_shorts()
