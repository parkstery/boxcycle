"""Rider GLB의 골반/좌골 후보와 Cycle GLB 안장 메시를 수정 없이 조사한다."""
import bpy, sys, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
rider_path, cycle_path = argv[0], argv[1]


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


clear()
bpy.ops.import_scene.gltf(filepath=rider_path)
arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
mesh = next((o for o in bpy.data.objects if o.type == "MESH" and "RIDER" in o.name.upper()), None)
groups = {g.name: g.index for g in mesh.vertex_groups}
pelvis_names = [n for n in groups if "PELVIS" in n.upper() or "HIP" in n.upper()]
pelvis_indices = []
for v in mesh.data.vertices:
    if any(g.group in {groups[n] for n in pelvis_names} and g.weight > 0.25 for g in v.groups):
        pelvis_indices.append(v.index)
pelvis_world = [mesh.matrix_world @ mesh.data.vertices[i].co for i in pelvis_indices]
pelvis_world.sort(key=lambda p: p.z)
lowest = pelvis_world[:max(1, min(80, len(pelvis_world)))]


def xyz(v):
    return [round(v.x * 1000, 3), round(v.y * 1000, 3), round(v.z * 1000, 3)]


def avg(points):
    return sum(points, Vector()) / len(points) if points else None


bone_points = {}
if arm:
    for name in ("PELVIS", "SADDLE_CONTACT", "THIGH_L", "THIGH_R"):
        b = arm.data.bones.get(name)
        if b:
            bone_points[name] = {
                "headMm": xyz(arm.matrix_world @ b.head_local),
                "tailMm": xyz(arm.matrix_world @ b.tail_local),
            }
rider = {
    "mesh": mesh.name,
    "pelvisVertexGroups": pelvis_names,
    "pelvisVertexCount": len(pelvis_indices),
    "pelvisLowestBandCount": len(lowest),
    "pelvisLowestBandCentroidMm": xyz(avg(lowest)) if lowest else None,
    "pelvisLowestMm": xyz(lowest[0]) if lowest else None,
    "pelvisLowestLeftCentroidMm": xyz(avg([p for p in lowest if p.y < 0])) if any(p.y < 0 for p in lowest) else None,
    "pelvisLowestRightCentroidMm": xyz(avg([p for p in lowest if p.y >= 0])) if any(p.y >= 0 for p in lowest) else None,
    "bones": bone_points,
}

clear()
bpy.ops.import_scene.gltf(filepath=cycle_path)
cycle_meshes = []
for o in bpy.data.objects:
    if o.type != "MESH" or not o.data.vertices:
        continue
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws)))
    hi = Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws)))
    center = sum(ws, Vector()) / len(ws)
    if center.x < -0.1 and hi.z > 0.85:
        cycle_meshes.append({
            "name": o.name,
            "vertices": len(ws),
            "centerMm": xyz(center),
            "minMm": xyz(lo),
            "maxMm": xyz(hi),
        })
print("@@SADDLE_INSPECT@@" + json.dumps({
    "rider": rider,
    "cycleSaddleCandidates": cycle_meshes,
}, ensure_ascii=False))
