"""
extract-glb-meta — GLB 하나의 AABB·노드/본·단위·축·원점을 추출해 JSON stdout 출력.
register-inputs.mjs 가 rider·cycle 각각에 대해 호출해 manifest 의 riderMeta/cycleMeta 를 채운다.

Blender 스크립트(three 의존 없음) → apps/web 밖에 둔다(스킬 규율).
실행: blender --background --python extract-glb-meta.py -- <glb_path> [preview_out.png]
출력: 마지막 줄에 "@@META@@ <json>" (node 가 이 줄만 파싱).
"""
import bpy, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None

# 씬 클리어
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for c in (bpy.data.meshes, bpy.data.armatures, bpy.data.objects):
    for b in list(c):
        try: c.remove(b)
        except Exception: pass

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
objs = [o for o in bpy.data.objects if o not in before]

# ── AABB (world, glTF축: Blender import 후 z=up). mm 로 리포트 ──
mins = [1e18, 1e18, 1e18]
maxs = [-1e18, -1e18, -1e18]
mesh_count = 0
for o in objs:
    if o.type != "MESH" or not o.data.vertices:
        continue
    mesh_count += 1
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
# Blender world: x=glTF x, y=glTF -z, z=glTF y(up). AABB 를 glTF 규약(x전방,y상,z좌)으로 환산.
def mm(v): return round(v * 1000, 1)
aabb = {
    "blender_min": [mm(x) for x in mins],
    "blender_max": [mm(x) for x in maxs],
    "size_mm": {
        "x": mm(maxs[0] - mins[0]),
        "y": mm(maxs[1] - mins[1]),
        "z_up": mm(maxs[2] - mins[2]),  # z=up in blender
    },
    "note": "Blender world 축(z=up). glTF 원본은 y=up — 결합 스크립트가 축 변환 담당.",
}

# ── 노드/본 목록 ──
nodes = sorted([o.name for o in objs])
armatures = [o for o in objs if o.type == "ARMATURE"]
bones = {}
for arm in armatures:
    bones[arm.name] = sorted([b.name for b in arm.data.bones])

# ── 단위·축·원점 ──
# glTF 는 미터·y-up·오른손. import scale 로 실제 단위 추정.
scene_scale = bpy.context.scene.unit_settings.scale_length
origin_note = "glTF 원점(0,0,0). 라이더/자전거 모델별 원점 위치는 AABB 로 판단(발밑/BB 등)."

meta = {
    "glb": GLB,
    "meshCount": mesh_count,
    "aabb": aabb,
    "nodes": nodes,
    "nodeCount": len(nodes),
    "bones": bones,
    "unit": "meter (glTF 표준)",
    "axis": "glTF y-up 오른손 / Blender z-up (import 변환됨)",
    "sceneScaleLength": scene_scale,
    "originNote": origin_note,
}

# ── 프리뷰 PNG (선택) ──
if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = 480
    sc.render.resolution_y = 480
    w = bpy.data.worlds.new("W"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.12, 0.13, 0.15, 1)
    sc.world = w
    from mathutils import Euler
    for ang, en in [((55, 0, 40), 3.0), ((60, 0, -110), 1.2)]:
        L = bpy.data.lights.new("L", "SUN"); L.energy = en
        lo = bpy.data.objects.new("L", L); bpy.context.collection.objects.link(lo)
        lo.rotation_euler = Euler((math.radians(ang[0]), 0, math.radians(ang[2])), "XYZ")
    # 카메라: AABB 중심을 측면(-y)에서
    cx = (mins[0] + maxs[0]) / 2
    cy = (mins[1] + maxs[1]) / 2
    cz = (mins[2] + maxs[2]) / 2
    span = max(maxs[0] - mins[0], maxs[2] - mins[2], 0.5)
    cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector((cx, cy - span * 2.2, cz))
    d = Vector((cx, cy, cz)) - cam.location; d.normalize()
    cam.rotation_euler = d.to_track_quat("-Z", "Z").to_euler()
    sc.camera = cam
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    meta["previewPng"] = PREVIEW

print("@@META@@ " + json.dumps(meta, ensure_ascii=False))
