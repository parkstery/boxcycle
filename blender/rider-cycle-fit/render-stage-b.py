"""단계 B 렌더 — 후보 GLB 를 세 자세로, s5 원본과 같은 카메라로 대조한다.

  A. rest        un-pose 결과 그대로 (사지가 −Y)
  B. 원본자세복원 각 노드에 R⁻¹(un-pose 의 역)을 걸면 s5 조각 자세가 되돌아와야 한다
  C. sway ON     B + torso 로컬 X 롤 — torso 원점을 고관절로 옮긴 결정의 검증

  그리고 s5 원본을 같은 카메라로 찍어 짝으로 낸다. 강체 분해가 연속 표면 대비
  **얼마나 나쁜지**를 눈으로 보는 것이 이 단계의 목적이다.

실행:
  blender --background --factory-startup --python render-stage-b.py -- <candidate.glb> <s5.glb> <anchors.json> <outDir> [sway_deg]
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

_A = sys.argv[sys.argv.index("--") + 1:]
CAND, S5, ANCHORS, OUT = _A[0], _A[1], _A[2], _A[3]
SWAY = float(_A[4]) if len(_A) > 4 else 5.0
os.makedirs(OUT, exist_ok=True)
anchors = json.load(open(ANCHORS, encoding="utf-8"))
_ur = os.path.join(os.path.dirname(CAND), "unpose-report.json")
UNPOSE_REPORT = json.load(open(_ur, encoding="utf-8")) if os.path.exists(_ur) else None
G2B = lambda p: Vector((p[0], -p[2], p[1]))
DOWN = Vector((0.0, 0.0, -1.0))

AXIS_CHILD = {"leg_l": "leg_l_shin", "leg_l_shin": "ankle_l", "leg_r": "leg_r_shin",
              "leg_r_shin": "ankle_r", "arm_l": "arm_l_fore", "arm_r": "arm_r_fore"}
WRIST = {"arm_l_fore": anchors["supplementary"]["wrist"]["R"],
         "arm_r_fore": anchors["supplementary"]["wrist"]["L"]}


def aw(n):
    a = anchors["anchors"][n]
    return G2B(a.get("worldOrigin") or a.get("localTranslation"))


def unpose_rot(node):
    o = aw(node)
    if node in AXIS_CHILD:
        d = aw(AXIS_CHILD[node]) - o
    elif node in WRIST:
        d = G2B(WRIST[node]) - o
    else:
        return None
    return d.normalized().rotation_difference(DOWN)


# ── 카메라 ────────────────────────────────────────────────────────────────
VIEWS = {  # name: (dir, ortho_scale, target)
    "01-side":        ((0, -1, 0), 2.0, (0.08, 0, 0.85)),
    "02-front":       ((1, 0, 0), 2.0, (0.08, 0, 0.85)),
    "03-back":        ((-1, 0, 0), 2.0, (0.08, 0, 0.85)),
    "04-side-right":  ((0, 1, 0), 2.0, (0.08, 0, 0.85)),
    "05-top":         ((0, 0, 1), 2.0, (0.08, 0, 0.85)),
    "06-threequarter": ((0.8, -1, 0.45), 2.0, (0.08, 0, 0.85)),
}
CLOSEUPS = {  # 확대 — glTF 앵커를 Blender 로 환산해 target 으로
    "10-shoulder-l": ("arm_l", (0.6, -0.9, 0.35), 0.40),
    "11-shoulder-r": ("arm_r", (0.6, 0.9, 0.35), 0.40),
    "12-elbow-l":    ("arm_l_fore", (0.5, -1.0, 0.2), 0.32),
    "13-elbow-r":    ("arm_r_fore", (0.5, 1.0, 0.2), 0.32),
    "14-knee-l":     ("leg_l_shin", (0.3, -1.0, 0.1), 0.42),
    "15-knee-r":     ("leg_r_shin", (0.3, 1.0, 0.1), 0.42),
    "16-neck-collar": (None, (0.9, -0.8, 0.25), 0.34),
    "17-foot-pedal": ("ankle_l", (0.3, -1.0, 0.15), 0.34),
    # 7번째 절단면(고관절) 확인 — 절단 뚜껑이 골반 밖으로 드러나는가
    "18-hip-l": ("leg_l", (0.2, -1.0, 0.45), 0.36),
    "19-hip-l-rear": ("leg_l", (-0.9, -0.6, 0.4), 0.36),
}
NECK_TARGET = Vector((0.20, 0.0, 1.34))   # Blender — 칼라 Mesh_58/59 위치


# 단계 0 기준선 렌더(inspect-modelling-baseline.py:37-64)와 **동일한 스튜디오**.
# 색이 다르면 승인 자료로 쓸 수 없다 — view_transform·배경·조명을 그대로 옮긴다.
STUDIO_TARGET = (0.08, 0, 0.85)


def studio():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 900, 760
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX"
    sc.world = bpy.data.worlds.new("Baseline studio")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.16, 0.18, 0.21, 1)
    bg.inputs[1].default_value = 0.5
    for pos, power, size in [((3, -4, 5), 450, 4), ((-2, 3, 3), 350, 3)]:
        bpy.ops.object.light_add(type="AREA", location=pos)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (Vector(STUDIO_TARGET) - light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    sc.camera = cam
    return sc, cam


def shoot(sc, cam, name, direction, scale, target):
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * 5.0
    cam.data.ortho_scale = scale
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("  saved", name)


def load(path, pose):
    """pose: 'rest' | 'restore' | 'sway'"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    if pose in ("restore", "sway"):
        for node in list(AXIS_CHILD) + list(WRIST):
            ob = bpy.data.objects.get(node)
            if not ob:
                continue
            q = unpose_rot(node)
            ob.rotation_mode = "QUATERNION"
            ob.rotation_quaternion = q.inverted()
        # 발목 — 부모 누적 회전을 상쇄해 밑창을 세계 수평으로 (앱이 하는 일)
        bpy.context.view_layer.update()
        for node in ("ankle_l", "ankle_r"):
            ob = bpy.data.objects.get(node)
            if not ob or not ob.parent:
                continue
            pw = ob.parent.matrix_world.to_quaternion()
            ob.rotation_mode = "QUATERNION"
            ob.rotation_quaternion = pw.inverted()
        # 크랭크 — 굽기 회전의 역을 걸어 s5 위상으로 되돌린다. 페달은 그 누적을 상쇄해
        # 플랫폼을 세계 수평으로 유지한다(앱의 pedalLRotationDeg 가 하는 일).
        if UNPOSE_REPORT:
            bq = UNPOSE_REPORT.get("unpose", {}).get("crank", {}).get("bakeQuatBlender")
            ck = bpy.data.objects.get("crank")
            if bq and ck:
                from mathutils import Quaternion
                ck.rotation_mode = "QUATERNION"
                ck.rotation_quaternion = Quaternion(bq).inverted()
                bpy.context.view_layer.update()
                for pn in ("pedal_l", "pedal_r"):
                    po = bpy.data.objects.get(pn)
                    if po and po.parent:
                        po.rotation_mode = "QUATERNION"
                        po.rotation_quaternion = po.parent.matrix_world.to_quaternion().inverted()
        bpy.context.view_layer.update()
        if pose == "sway":
            t = bpy.data.objects.get("torso")
            if t:
                t.rotation_mode = "XYZ"
                t.rotation_euler = (math.radians(SWAY), 0, 0)
    bpy.context.view_layer.update()
    return studio()


def run(path, pose, prefix, full=True):
    sc, cam = load(path, pose)
    if full:
        for name, (d, s, tg) in VIEWS.items():
            shoot(sc, cam, f"{prefix}-{name}", d, s, tg)
        for name, (node, d, s) in CLOSEUPS.items():
            tg = NECK_TARGET if node is None else (bpy.data.objects[node].matrix_world.translation
                                                  if bpy.data.objects.get(node) else NECK_TARGET)
            shoot(sc, cam, f"{prefix}-{name}", d, s, tg)
    else:
        for name in ("01-side", "06-threequarter"):
            d, s, tg = VIEWS[name]
            shoot(sc, cam, f"{prefix}-{name}", d, s, tg)
        shoot(sc, cam, f"{prefix}-16-neck-collar", *CLOSEUPS["16-neck-collar"][1:], NECK_TARGET) \
            if False else shoot(sc, cam, f"{prefix}-16-neck-collar", CLOSEUPS["16-neck-collar"][1], CLOSEUPS["16-neck-collar"][2], NECK_TARGET)


print("=== B. 원본자세 복원 (후보) ===")
run(CAND, "restore", "B-restore", full=True)
print("=== S. s5 원본 (대조) ===")
run(S5, "rest", "S-original", full=True)
print("=== A. rest (후보) ===")
run(CAND, "rest", "A-rest", full=False)
print("=== C. sway ON (후보) ===")
run(CAND, "sway", "C-sway", full=False)
print("STAGE_B_RENDERS_COMPLETE")
