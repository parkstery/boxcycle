"""라이더 GLB 머티리얼 목록 — 팬츠(shorts) 머티리얼을 특정한다(F5-1).

실행:
  blender --background --python inspect-rider-materials.py -- <riderGlb> <outJson>
"""
import bpy, sys, os, json

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
OUT = os.path.abspath(_A[1]) if len(_A) > 1 else "rider-materials.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

rows = []
for m in bpy.data.materials:
    base = None
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                c = n.inputs["Base Color"].default_value
                base = [round(c[0], 4), round(c[1], 4), round(c[2], 4)]
                break
    rows.append({
        "name": m.name,
        "baseColorLinear": base,
        "diffuseColor": [round(v, 4) for v in m.diffuse_color],
        "users": m.users,
    })

# 어떤 오브젝트/버텍스그룹이 어떤 머티리얼을 쓰는지
objs = []
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    objs.append({
        "name": o.name,
        "materials": [ms.material.name if ms.material else None for ms in o.material_slots],
        "vertexGroups": [g.name for g in o.vertex_groups],
        "verts": len(o.data.vertices),
    })

out = {"glb": GLB, "materials": rows, "objects": objs}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2)[:4000])
