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
    "leg_l_shin": ["SHIN_" + BL, "FOOT_" + BL, "TOE_" + BL],
    "leg_r":      ["THIGH_" + BR],
    "leg_r_shin": ["SHIN_" + BR, "FOOT_" + BR, "TOE_" + BR],
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

# ── 노드별 변환행렬(포즈 world → 노드 로컬) ──────────────────────────────
XF = {}
for node, (pb_name, dir_bone) in PIVOT.items():
    origin_w = eval_head(pb_name)
    if dir_bone is None:
        rot = Matrix.Identity(3)                       # torso: 정렬 없음
        length = 0.0
    else:
        d = (eval_tail(dir_bone) - eval_head(dir_bone))
        length = d.length
        rot = d.normalized().rotation_difference(DOWN_BLENDER).to_matrix()
    XF[node] = {"origin": origin_w, "rot": rot, "lenM": length}

# ── 부위별 메시 생성 ──────────────────────────────────────────────────────
made = {}
for node in GROUPS:
    idx = [i for i, b in owner.items() if bone2node.get(b) == node]
    if not idx:
        report["nodes"][node] = {"verts": 0, "warn": "정점 없음"}
        continue
    remap = {vi: k for k, vi in enumerate(idx)}
    xf = XF[node]
    verts = []
    for vi in idx:
        w = MW @ me_ev.vertices[vi].co
        local = xf["rot"] @ (w - xf["origin"])
        verts.append(local)
    faces, mats = [], []
    for p in me_ev.polygons:
        vs = [v for v in p.vertices]
        if all(v in remap for v in vs):
            faces.append([remap[v] for v in vs])
            mats.append(p.material_index)
    m = bpy.data.meshes.new(node + "_mesh")
    m.from_pydata([tuple(v) for v in verts], [], faces)
    m.update()
    for ms in rider.data.materials:
        m.materials.append(ms)
    for k, p in enumerate(m.polygons):
        if k < len(mats):
            p.material_index = mats[k]
    # UV 복사(텍스처 팔레트 유지)
    if me_ev.uv_layers.active and m.polygons:
        src = me_ev.uv_layers.active.data
        dst = m.uv_layers.new(name="UVMap").data
        li = 0
        for p, sp in zip(m.polygons, [q for q in me_ev.polygons
                                      if all(v in remap for v in q.vertices)]):
            for k in range(len(p.vertices)):
                dst[p.loop_start + k].uv = src[sp.loop_start + k].uv
            li += 1
    o = bpy.data.objects.new(node, m)
    bpy.context.collection.objects.link(o)
    made[node] = o
    report["nodes"][node] = {
        "verts": len(idx), "faces": len(faces),
        "bones": GROUPS[node],
        "pivotWorldMm": [round(c * 1000, 2) for c in xf["origin"]],
        "segmentLenMm": round(xf["lenM"] * 1000, 2),
    }

report["unassigned"] = len(rider.data.vertices) - sum(
    r.get("verts", 0) for r in report["nodes"].values())

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
                      ("arm_l_fore", "arm_l"), ("arm_r_fore", "arm_r")):
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
