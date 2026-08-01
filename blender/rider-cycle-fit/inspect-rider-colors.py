"""라이더 색 출처 진단 — 팬츠만 RED 로 바꾸려면 색이 어디서 오는지 알아야 한다(F5-1).

머티리얼이 RTW_PBR_PALETTE 하나뿐이므로 색은 (a) 텍스처+UV 팔레트 (b) 정점 색 중 하나다.
어느 쪽인지, 그리고 팬츠 영역을 어떻게 특정할 수 있는지 조사한다.

실행:
  blender --background --python inspect-rider-colors.py -- <riderGlb> <outJson>
"""
import bpy, sys, os, json

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
OUT = os.path.abspath(_A[1]) if len(_A) > 1 else "rider-colors.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

obj = bpy.data.objects["RTW_RIDER_LOD0"]
me = obj.data

mat = me.materials[0]
nodes = []
if mat.use_nodes:
    for n in mat.node_tree.nodes:
        entry = {"type": n.type, "name": n.name}
        if n.type == "TEX_IMAGE" and n.image:
            entry["image"] = n.image.name
            entry["size"] = list(n.image.size)
            entry["filepath"] = n.image.filepath
        nodes.append(entry)

# 정점 색 레이어
color_layers = [a.name for a in me.color_attributes] if hasattr(me, "color_attributes") else []
uv_layers = [l.name for l in me.uv_layers]

out = {
    "glb": GLB,
    "object": obj.name,
    "verts": len(me.vertices),
    "polys": len(me.polygons),
    "materialNodes": nodes,
    "colorAttributes": color_layers,
    "uvLayers": uv_layers,
}

# 정점 색이 있으면 실제 값 분포를 본다(어떤 색들이 쓰이는가 = 옷 구분 가능성)
if color_layers:
    ca = me.color_attributes[color_layers[0]]
    out["colorAttributeDomain"] = ca.domain
    buckets = {}
    for i, d in enumerate(ca.data):
        c = d.color
        key = (round(c[0], 2), round(c[1], 2), round(c[2], 2))
        buckets.setdefault(key, 0)
        buckets[key] += 1
    top = sorted(buckets.items(), key=lambda kv: -kv[1])[:20]
    out["topVertexColors"] = [{"rgb": list(k), "count": v} for k, v in top]

# UV 가 팔레트 방식이면 UV 좌표가 소수의 점에 뭉쳐 있다
if uv_layers:
    uvl = me.uv_layers[0].data
    ub = {}
    for d in uvl:
        key = (round(d.uv[0], 2), round(d.uv[1], 2))
        ub.setdefault(key, 0)
        ub[key] += 1
    top = sorted(ub.items(), key=lambda kv: -kv[1])[:20]
    out["topUVs"] = [{"uv": list(k), "count": v} for k, v in top]
    out["distinctUVCount"] = len(ub)

json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2)[:4000])
