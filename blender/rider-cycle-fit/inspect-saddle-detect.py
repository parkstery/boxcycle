"""안장 메시 검출 진단 — render-saddle-evidence.py 의 필터가 무엇을 고르는지 실측한다.

F2-1 에서 안장 표면이 SSoT(coords.saddle [-226,695] = world z 0.9655)와 162mm 어긋나게
계측된 원인을 가른다. 필터 `center.x < -0.1 and max z > 0.85` 가 안장 외 메시(시트포스트·
시트튜브 상단 등)를 끌어들이는지 본다.

실행:
  blender --background --python inspect-saddle-detect.py -- <cycleGlb> <outJson>
"""
import bpy, sys, os, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1]) if len(argv) > 1 else "saddle-detect.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

BB_H = 0.2705


def bb_mm(v):
    return [round(v.x * 1000, 2), round(v.y * 1000, 2), round((v.z - BB_H) * 1000, 2)]


rows = []
for o in [x for x in bpy.data.objects if x.type == "MESH"]:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    ctr = sum(pts, Vector()) / len(pts)
    zmax = max(p.z for p in pts)
    zmin = min(p.z for p in pts)
    passes = (ctr.x < -0.1) and (zmax > 0.85)
    rows.append({
        "name": o.name,
        "centerWorldMm": [round(ctr.x * 1000, 2), round(ctr.y * 1000, 2), round(ctr.z * 1000, 2)],
        "centerBBmm": bb_mm(ctr),
        "zMaxWorldMm": round(zmax * 1000, 2),
        "zMinWorldMm": round(zmin * 1000, 2),
        "zMaxBBmm": round((zmax - BB_H) * 1000, 2),
        "passesCurrentFilter": passes,
    })

selected = [r for r in rows if r["passesCurrentFilter"]]
# 실제 안장이어야 하는 것: SSoT saddle world z = 695+270.5 = 965.5mm 부근 최상단
top = sorted(rows, key=lambda r: -r["zMaxWorldMm"])[:12]

out = {
    "glb": GLB,
    "ssotSaddleWorldZmm": 695 + BB_H * 1000,
    "currentFilter": "center.x < -0.1 and zMax > 0.85(m)",
    "selectedByCurrentFilter": selected,
    "top12ByZmax": top,
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
