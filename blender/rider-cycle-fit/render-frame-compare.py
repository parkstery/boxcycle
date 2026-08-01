"""
프레임 구조 검증 렌더 — 자전거 단독(Before/After 동일 카메라) + 시트튜브 접합부 확대.

F1-R 지시 §R-2 의 (2)자전거 단독 측면 · (4)Before/After 동일 카메라 · (5)접합부 확대를 굽는다.
라이더 결합 전신은 render-all.py(fit_ik.py 재사용)가 담당한다 — 여기선 프레임 형상만 본다.

실행:
  blender --background --python render-frame-compare.py -- <glbPath> <label> <outDir>

산출: <outDir>/BIKE_<label>_SIDE.png · _SIDE_ORTHO.png · _CU_SEATJUNCTION.png · _Q_FRONT.png
      <outDir>/bike-<label>-measure.json  — 렌더에 쓴 카메라·씬 AABB 실측
"""
import bpy, sys, os, json, math
from mathutils import Vector

_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_ARGV[0])
LABEL = _ARGV[1] if len(_ARGV) > 1 else "unknown"
OUT_DIR = os.path.abspath(_ARGV[2]) if len(_ARGV) > 2 else os.getcwd()
os.makedirs(OUT_DIR, exist_ok=True)

# ── 씬 초기화 ──
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

# GLB(y-up, -z 전방) → Blender(z-up, +x 전방) 는 importer 가 처리한다.
MESHES = [o for o in bpy.data.objects if o.type == "MESH"]
print("메시 %d개 임포트" % len(MESHES))

# ── 씬 AABB 실측(카메라 프레이밍 근거) ──
_pts = []
for o in MESHES:
    for c in o.bound_box:
        _pts.append(o.matrix_world @ Vector(c))
_min = Vector((min(p.x for p in _pts), min(p.y for p in _pts), min(p.z for p in _pts)))
_max = Vector((max(p.x for p in _pts), max(p.y for p in _pts), max(p.z for p in _pts)))
print("씬 AABB min %s max %s" % (tuple(round(v, 4) for v in _min), tuple(round(v, 4) for v in _max)))

# ── 조명·월드 ──
w = bpy.data.worlds.new("W")
bpy.context.scene.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.11, 0.12, 0.14, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0

def add_light(name, loc, energy, size=4.0):
    d = bpy.data.lights.new(name, type="AREA")
    d.energy = energy
    d.size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    tr = o.constraints.new("TRACK_TO")
    tr.target = _target
    return o

# 조명이 바라볼 빈 타깃(씬 중심)
_target = bpy.data.objects.new("LightTarget", None)
_target.location = ((_min.x + _max.x) / 2, 0, (_min.z + _max.z) / 2)
bpy.context.scene.collection.objects.link(_target)

add_light("KeyL", (2.0, -3.0, 3.0), 900)
add_light("FillL", (-2.5, -2.0, 1.6), 400)
add_light("RimL", (-1.0, 2.6, 2.4), 500)

# ── 바닥(그림자 접지감) ──
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
_floor = bpy.context.object
_fm = bpy.data.materials.new("Floor")
_fm.use_nodes = True
_fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.16, 0.17, 0.19, 1)
_fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
_floor.data.materials.append(_fm)

# ── 렌더 설정 ──
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [
    i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
] else "BLENDER_EEVEE"
sc.render.resolution_x = 1400
sc.render.resolution_y = 1000
sc.render.film_transparent = False
sc.render.image_settings.file_format = "PNG"

_cam_data = bpy.data.cameras.new("Cam")
CAM = bpy.data.objects.new("Cam", _cam_data)
sc.collection.objects.link(CAM)
sc.camera = CAM


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def shoot(name, loc, look, lens=50.0, ortho=None, res=(1400, 1000)):
    sc.render.resolution_x, sc.render.resolution_y = res
    CAM.location = Vector(loc)
    if ortho:
        _cam_data.type = "ORTHO"
        _cam_data.ortho_scale = ortho
    else:
        _cam_data.type = "PERSP"
        _cam_data.lens = lens
    look_at(CAM, look)
    p = os.path.join(OUT_DIR, name + ".png")
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    print("렌더 %s" % p)
    return {"file": p, "loc": list(loc), "look": list(look),
            "lens": None if ortho else lens, "ortho": ortho}


# ── 프레이밍: 씬 실측 기준. Before/After 동일 카메라를 쓰기 위해 값은 고정 상수로 둔다. ──
# (AABB 로 자동 맞추면 Before/After 카메라가 달라져 비교가 무의미해진다 — SKILL 승인 규율)
FULL_LOOK = (0.0, 0.0, 0.55)
FULL_DIST = 2.6
ORTHO_SCALE = 1.35

# 시트튜브 접합점(BB 원점 mm → Blender m). BB 는 지면에서 270.5mm.
BB_H = 0.2705
SEAT_JUNCTION = (-0.116446, 0.0, 393.116 / 1000 + BB_H)   # [-116.446, 393.116] mm
SEAT_TOP = (-0.159, 0.0, 536.9 / 1000 + BB_H)
# 헤드튜브 접합부 — 탑튜브·다운튜브가 헤드튜브에서 각을 이루는지(삼각형 판정, F3 §2-2).
# 좌표는 geometry.json SSoT 에서 읽는다(하드코딩 금지). headTop 은 후보마다 달라지므로
# Before/After 비교를 위해 **카메라는 두 좌표의 중점에 고정**하지 않고 각자 SSoT 를 쓴다 —
# 대신 dist 를 같게 두어 배율은 동일하다.
# headTop 은 후보마다 다르므로 인자로 받는다(미지정 시 현재 SSoT). Before 렌더에는 구값을 준다.
_ht_arg = _ARGV[3] if len(_ARGV) > 3 else None
_GEOM_PATH = r"C:\20.HDev\boxcycle\apps\web\src\lib\riderPrototype\geometry.json"
with open(_GEOM_PATH, encoding="utf-8") as _gf:
    _GEOM = json.load(_gf)
_ht = [float(v) for v in _ht_arg.split(",")] if _ht_arg else _GEOM["coords"]["headTop"]
_hb = _GEOM["coords"]["headBot"]
HEAD_TOP = (_ht[0] / 1000, 0.0, _ht[1] / 1000 + BB_H)
HEAD_BOT = (_hb[0] / 1000, 0.0, _hb[1] / 1000 + BB_H)

shots = {}
shots["SIDE"] = shoot("BIKE_%s_SIDE" % LABEL, (0, -FULL_DIST, FULL_LOOK[2]), FULL_LOOK)
shots["SIDE_ORTHO"] = shoot("BIKE_%s_SIDE_ORTHO" % LABEL, (0, -3.0, FULL_LOOK[2]), FULL_LOOK,
                            ortho=ORTHO_SCALE)
shots["Q_FRONT"] = shoot("BIKE_%s_Q_FRONT" % LABEL, (1.9, -1.9, 1.05), FULL_LOOK)
# 접합부 확대 — 탑튜브·시트스테이·시트포스트가 한 점에서 만나는지. 안장 클램프까지 화각에 넣는다.
_cu_look = ((SEAT_JUNCTION[0] + SEAT_TOP[0]) / 2, 0.0, (SEAT_JUNCTION[2] + SEAT_TOP[2]) / 2)
shots["CU_SEATJUNCTION"] = shoot("BIKE_%s_CU_SEATJUNCTION" % LABEL,
                                 (_cu_look[0] + 0.10, -0.62, _cu_look[2] + 0.06), _cu_look,
                                 lens=50.0, res=(1100, 1100))

# 헤드튜브 접합부 확대 — 탑튜브·다운튜브가 헤드튜브에서 각을 이루는지(삼각형 판정).
# 주시점은 헤드튜브 중점. dist 는 Before/After 동일(0.42)로 배율을 맞춘다.
_head_mid = ((HEAD_TOP[0] + HEAD_BOT[0]) / 2, 0.0, (HEAD_TOP[2] + HEAD_BOT[2]) / 2)
shots["CU_HEADTUBE"] = shoot("BIKE_%s_CU_HEADTUBE" % LABEL,
                             (_head_mid[0] + 0.12, -0.40, _head_mid[2] + 0.05), _head_mid,
                             lens=50.0, res=(1100, 1100))
# 정측면 고해상 — 삼각형 형태 판정용 단독 1장(F3 §2-4 (2)).
shots["SIDE_HIRES"] = shoot("BIKE_%s_SIDE_HIRES" % LABEL, (0, -3.0, FULL_LOOK[2]), FULL_LOOK,
                            ortho=ORTHO_SCALE, res=(2000, 1430))

json.dump({
    "label": LABEL,
    "glb": GLB,
    "headTopUsedMm": list(_ht),
    "headBotMm": list(_hb),
    "sceneAabbMin": [round(v, 5) for v in _min],
    "sceneAabbMax": [round(v, 5) for v in _max],
    "meshCount": len(MESHES),
    "seatTubeJunctionBlender": list(SEAT_JUNCTION),
    "seatTopBlender": list(SEAT_TOP),
    "shots": shots,
}, open(os.path.join(OUT_DIR, "bike-%s-measure.json" % LABEL), "w", encoding="utf-8"),
    ensure_ascii=False, indent=2)
print("완료 %s" % LABEL)
