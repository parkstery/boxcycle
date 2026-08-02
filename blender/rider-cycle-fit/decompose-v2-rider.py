"""V2 스킨드 라이더 → 앱 계약(강체 노드 10개) GLB 로 분해·변환한다 (F16 §3).

**왜 필요한가**: 앱(Mapbox model layer)은 glTF 스키닝을 지원하지 않는다
(F15 실측: mapbox-gl 3.23.1 번들에 `skins`·`JOINTS_0`·`WEIGHTS_0` 0건).
대신 `setFeatureState` 로 **명명 노드 10개를 매 프레임 회전**시킨다. 그래서 V2 메시를
본 가중치 기준으로 잘라 각 조각을 그 노드에 강체로 매단다.

**가능한 근거**(F16 §3-1 실측): 5477 정점 중 단일본(w≥0.999) 85.98%,
블렌딩(<0.9) 664개는 전부 인접 관절 이음매. 최대 가중치 본으로 귀속시킨다.

**앱 계약**(`generate-rider-prototype-glb.mjs` legAssembly 주석이 정본):
  · 노드 원점 = 해당 **관절 위치**
  · 로컬 rest 방향 = **-Y(수직 아래)** — 앱 IK 가 rest 를 계산 방향으로 돌린다
  · 좌우 벌림은 노드 position 의 z + 3D 회전이 만든다(로컬 체인은 z=0 직선)
  · 자식 원점: shin = leg 로컬 [0,-thigh,0], fore = arm 로컬 [0,-upper,0]

**좌/우**: 앱 `leg_l` = `RIG_HIP_L` = glTF **+z**. joints `hipL` 도 +z. 그런데 V2 본
`THIGH_L` 은 Blender +y = glTF **−z** 로 **반대**다(커밋 345fdd8). 그래서 앱 `_l` 노드에는
V2 `_R` 본을 붙인다 — `BONE_OF` 와 같은 규칙이다. 여기서 틀리면 다리가 몸을 가로지른다.

실행:
  blender --background --python decompose-v2-rider.py -- \
     <scale> <joints> <cycle> <tilt> <upperArmRest> <outGlb>
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

_A = sys.argv[sys.argv.index("--") + 1:]
SCALE_S, JOINTS, CYCLE_IN, TILT, UARM, OUT_GLB = _A[0], _A[1], _A[2], _A[3], _A[4], _A[5]
RA = r"c:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\render-all.py"

sys.argv = ["blender", "--", SCALE_S, "78", "hip", "DECOMP", os.path.dirname(OUT_GLB),
            "decomp", JOINTS, CYCLE_IN, TILT, UARM]
exec(compile(open(RA, encoding="utf-8").read().split("# ── Static Fit:")[0],
             "render_all_head", "exec"), globals())

PHASE = "0.000"
apply_phase(PHASE)
rotate_cranks(crank_rot(JD["phases"][PHASE]["crankDeg"]))
bpy.context.view_layer.update()
bpy.context.evaluated_depsgraph_get().update()

S = float(SCALE_S)
BL = BONE_OF["L"]          # 앱 _l 노드가 쓸 V2 본 side
BR = BONE_OF["R"]

# ── 앱 노드 ← V2 본 그룹 (§3-2) ────────────────────────────────────────────
GROUPS = {
    "torso":      ["PELVIS", "SPINE_01", "SPINE_02", "CHEST", "NECK", "HEAD",
                   "CLAVICLE_L", "CLAVICLE_R"],
    "leg_l":      ["THIGH_" + BL],
    "leg_l_shin": ["SHIN_" + BL],
    # ⚠ 발은 **별도 노드**다(F26). 예전에는 `leg_*_shin` 에 흡수돼 발목 관절이 없었고,
    #   정강이가 기울면 발도 통째로 기울어 페달면과 어긋났다(F25 §4-2 실측: 접점
    #   오프셋은 2.8mm·1.3mm 로 맞는데 **발바닥 기울기**만 틀렸다).
    "ankle_l":    ["FOOT_" + BL, "TOE_" + BL],
    "leg_r":      ["THIGH_" + BR],
    "leg_r_shin": ["SHIN_" + BR],
    "ankle_r":    ["FOOT_" + BR, "TOE_" + BR],
    "arm_l":      ["UPPER_ARM_" + BL],
    "arm_l_fore": ["FOREARM_" + BL, "HAND_" + BL],
    "arm_r":      ["UPPER_ARM_" + BR],
    "arm_r_fore": ["FOREARM_" + BR, "HAND_" + BR],
}
# 노드별 (피벗 본, 방향 끝 본) — 방향은 head→tail 로 -Y 정렬(§3-3)
PIVOT = {
    "leg_l":      ("THIGH_" + BL, "THIGH_" + BL),
    "leg_l_shin": ("SHIN_" + BL, "SHIN_" + BL),
    "leg_r":      ("THIGH_" + BR, "THIGH_" + BR),
    "leg_r_shin": ("SHIN_" + BR, "SHIN_" + BR),
    "arm_l":      ("UPPER_ARM_" + BL, "UPPER_ARM_" + BL),
    "arm_l_fore": ("FOREARM_" + BL, "FOREARM_" + BL),
    "arm_r":      ("UPPER_ARM_" + BR, "UPPER_ARM_" + BR),
    "arm_r_fore": ("FOREARM_" + BR, "FOREARM_" + BR),
    "torso":      ("PELVIS", None),      # 몸통은 회전 정렬 없음(앱은 롤만 준다)
    # 발목 — **피벗은 FOOT head, 정렬은 부모(SHIN) 방향**이다.
    #   발은 "뻗는 방향"이 아니라 **발바닥 면**이 중요하므로 FOOT 축으로 −Y 정렬하면
    #   발이 아래를 향해 rest 가 쓸모없어진다. 부모와 같은 회전으로 맞추면 ankle 노드가
    #   **부모 로컬에서 identity** 가 되고, rest 에서 발이 원래 world 자세를 유지한다
    #   (부모 회전이 정확히 상쇄). 그래야 앱이 "부모 누적 회전의 역"만 주면 수평이 된다.
    "ankle_l":    ("FOOT_" + BL, "SHIN_" + BL),
    "ankle_r":    ("FOOT_" + BR, "SHIN_" + BR),
}


# ⚠ 좌표 변환을 **직접 하지 마라**. Blender glTF exporter 가 export_yup 으로
#   z-up → y-up (x,y,z)→(x,z,−y) 를 이미 해준다. 여기서 b2g 를 또 적용하면 이중 변환이
#   되어 노드 translation 이 (−205,0,−802) 처럼 높이가 z 로 가고 부호도 뒤집힌다
#   (F16 1차 export 에서 실제로 발생). **Blender 좌표 그대로 두고 exporter 에 맡긴다.**
#   그러면 앱 계약(로컬 rest = glTF −Y)은 Blender 기준 **−Z(수직 아래)** 정렬이 된다.
DOWN_BLENDER = Vector((0.0, 0.0, -1.0))


# ── 정점 → 최대 가중치 본 귀속 ────────────────────────────────────────────
rider = _RIDER_MESH
gname = {g.index: g.name for g in rider.vertex_groups}
owner = {}
for v in rider.data.vertices:
    gs = [(g.weight, gname.get(g.group, "")) for g in v.groups if g.weight > 0]
    if gs:
        gs.sort(reverse=True)
        owner[v.index] = gs[0][1]

bone2node = {}
for node, bones in GROUPS.items():
    for b in bones:
        bone2node[b] = node

me_ev = rider.evaluated_get(_fresh_dg()).data
MW = rider.matrix_world
report = {"phase": PHASE, "boneOf": BONE_OF, "nodes": {}, "unassigned": 0}

# ── 밑창 면 특정 (F31) ────────────────────────────────────────────────────
# ⚠ 발을 **정강이 축으로 정렬하면 좌우가 비대칭이 된다.** 분해는 한 위상(phase 0.000)에서
#   이뤄지는데 그때 좌 BDC · 우 TDC 라 발–정강이 상대각이 46.3° 벌어져 있고, 그 차이가
#   그대로 로컬 자세로 구워졌다(F30 실측: ankle_l 251×92 vs ankle_r 198×243mm).
#   `ankle_*` 은 앱이 **절대 회전**(밑창을 세계 수평으로)을 걸므로 부모 정렬을 물려받을
#   이유가 없다. **밑창 법선을 로컬 −Z(Blender) = −Y(glTF) 로 정렬**하면 좌우가 대칭이 된다.
#
#   법선은 **면(폴리곤) 단위 법선·면적 집계**로 구한다 — 정점 법선 평균은 밑창을 못 잡는다
#   (F30 에서 오른발이 45° 기운 면을 잡아 S 가 −22mm 로 나왔다).
def sole_normal_world(node_name):
    """해당 노드에 귀속된 정점들이 이루는 면 중 **아래쪽 최대 면적 군집**의 법선(world)."""
    idx = set(i for i, b in owner.items() if bone2node.get(b) == node_name)
    buckets = {}
    for poly in me_ev.polygons:
        vs = [v for v in poly.vertices]
        if not all(v in idx for v in vs):
            continue
        n = (MW.to_3x3() @ poly.normal).normalized()
        if n.z >= 0:                      # 아래를 향하는 면만(Blender −Z 가 아래)
            continue
        key = (round(n.x / 0.15), round(n.y / 0.15), round(n.z / 0.15))
        e = buckets.setdefault(key, [0.0, Vector((0, 0, 0))])
        e[0] += poly.area
        e[1] += n * poly.area
    if not buckets:
        return None, 0.0
    best = max(buckets.values(), key=lambda e: e[0])
    return best[1].normalized(), best[0]


# ── 노드별 변환행렬(포즈 world → 노드 로컬) ──────────────────────────────
XF = {}
for node, (pb_name, dir_bone) in PIVOT.items():
    origin_w = eval_head(pb_name)
    if node.startswith("ankle_"):
        # 1) 밑창 법선 → −Z 정렬
        n_sole, area = sole_normal_world(node)
        if n_sole is None:
            raise RuntimeError("%s: 밑창 면을 찾지 못했다" % node)
        rot1 = n_sole.rotation_difference(DOWN_BLENDER).to_matrix()
        # 2) 발끝(FOOT head → TOE tail)을 로컬 +X 로 — 좌우 거울 대칭을 만든다
        toe = GROUPS[node][1]                        # "TOE_*"
        fwd = rot1 @ (eval_tail(toe) - eval_head(pb_name))
        ang = math.atan2(fwd.y, fwd.x)
        rot = Matrix.Rotation(-ang, 3, "Z") @ rot1
        length = 0.0
        report.setdefault("sole", {})[node] = {
            "normalWorld": [round(c, 4) for c in n_sole],
            "areaMm2": round(area * 1e6, 1),
        }
    elif dir_bone is None:
        rot = Matrix.Identity(3)                       # torso: 정렬 없음
        length = 0.0
    else:
        d = (eval_tail(dir_bone) - eval_head(dir_bone))
        length = d.length
        rot = d.normalized().rotation_difference(DOWN_BLENDER).to_matrix()
    XF[node] = {"origin": origin_w, "rot": rot, "lenM": length}

# ── 부위별 메시 생성 — **원본 메시를 복제해 잘라낸다** (F19) ──────────────
# ⚠ `from_pydata` 로 새 메시를 만들면 **커스텀 노멀·셰이딩 정보가 없어** exporter 가
#   face 마다 정점을 쪼갠다. F18 실측: 5,477 → **16,983 (3.10배)**. 그 과정에서 UV 가
#   재생성돼 128×16 팔레트에서 6px 단위 색이 뭉개졌다(전신 살색 단색).
#   → 원본 메시를 **복제한 뒤 불필요한 정점만 지운다.** UV·노멀·인덱스 공유가 보존된다.
import bmesh

# 1) 포즈를 구운 베이스 사본 1개 (Armature modifier apply)
bpy.ops.object.select_all(action="DESELECT")
rider.select_set(True)
bpy.context.view_layer.objects.active = rider
bpy.ops.object.duplicate()
base = bpy.context.object
base.name = "RIDER_BAKED"
for mod in list(base.modifiers):
    if mod.type == "ARMATURE":
        bpy.ops.object.modifier_apply(modifier=mod.name)
    else:
        base.modifiers.remove(mod)
BASE_MW = base.matrix_world.copy()
report["bakedVerts"] = len(base.data.vertices)

made = {}
for node in GROUPS:
    idx = set(i for i, b in owner.items() if bone2node.get(b) == node)
    if not idx:
        report["nodes"][node] = {"verts": 0, "warn": "정점 없음"}
        continue
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.duplicate()
    o = bpy.context.object
    o.name = node

    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    kill = [v for v in bm.verts if v.index not in idx]
    if kill:
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(o.data)
    bm.free()

    # 2) 메시를 노드 로컬 좌표로: R · (world − origin)
    xf = XF[node]
    M = xf["rot"].to_4x4() @ Matrix.Translation(-xf["origin"]) @ BASE_MW
    o.data.transform(M)
    o.matrix_world = Matrix.Identity(4)
    o.data.update()

    made[node] = o
    report["nodes"][node] = {
        "verts": len(o.data.vertices), "faces": len(o.data.polygons),
        "srcVerts": len(idx), "bones": GROUPS[node],
        "pivotWorldMm": [round(c * 1000, 2) for c in xf["origin"]],
        "segmentLenMm": round(xf["lenM"] * 1000, 2),
    }

bpy.data.objects.remove(base, do_unlink=True)

report["vertexSum"] = sum(r.get("verts", 0) for r in report["nodes"].values())
report["srcVertexSum"] = sum(r.get("srcVerts", 0) for r in report["nodes"].values())
report["origVerts"] = len(rider.data.vertices)
report["inflation"] = round(report["vertexSum"] / max(1, report["origVerts"]), 3)

# ── 계층 + 원점 배치 (앱 계약) ────────────────────────────────────────────
root = bpy.data.objects.new("RiderBike", None)
bpy.context.collection.objects.link(root)


def place(node, parent, origin_g, rot=None):
    o = made.get(node)
    if not o:
        return
    o.parent = parent
    o.location = origin_g
    if rot is not None:
        o.rotation_euler = rot


for node in ("torso", "leg_l", "leg_r", "arm_l", "arm_r"):
    if node in XF:
        place(node, root, XF[node]["origin"])
# 자식: 부모 로컬 [0, -부모길이, 0]
for child, parent in (("leg_l_shin", "leg_l"), ("leg_r_shin", "leg_r"),
                      ("arm_l_fore", "arm_l"), ("arm_r_fore", "arm_r"),
                      # 발목 = 정강이 끝. 부모 로컬 [0,0,−SHIN_LEN](Blender z-down)
                      ("ankle_l", "leg_l_shin"), ("ankle_r", "leg_r_shin")):
    if child in made and parent in made:
        place(child, made[parent], Vector((0.0, 0.0, -XF[parent]["lenM"])))

# ── 원본(스킨드) 라이더·아마추어 제거 — 정적 노드만 남긴다 ────────────────
for o in list(bpy.data.objects):
    if o is root or o in made.values():
        continue
    if o.type in ("MESH", "ARMATURE", "EMPTY") and o.name not in ("RiderBike",):
        # 자전거는 별도 GLB(절차적 생성기)가 담당 — 여기선 라이더만 export
        bpy.data.objects.remove(o, do_unlink=True)

bpy.context.view_layer.update()
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB",
                          use_selection=False, export_yup=True,
                          export_apply=False, export_skins=False,
                          export_animations=False)
report["out"] = OUT_GLB
report["outBytes"] = os.path.getsize(OUT_GLB) if os.path.exists(OUT_GLB) else 0
print("@@DECOMP@@" + json.dumps(report, ensure_ascii=False))
