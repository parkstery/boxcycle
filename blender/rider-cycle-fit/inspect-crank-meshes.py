"""크랭크 회전 대상 메시 진단 — CRANKSYNC 렌더에 크랭크암이 안 보이는 원인을 가른다(F5 §1).

fit_ik.py 의 rotate_cranks 필터:
    abs(cx) < 0.35 and cy < 0.5 and abs(cz) > 0.03 and abs(cx) > 0.02
(cx=전후, cy=상하, cz=좌우; 전부 메시 정점 평균)

이 필터가 페달만 잡고 **크랭크암을 놓치면** 페달은 위상대로 돌고 크랭크암은 rest(수평)에
남아, 렌더에서 크랭크가 사라지거나 위상이 어긋나 보인다.

실행:
  blender --background --python inspect-crank-meshes.py -- <cycleGlb> <outJson>
"""
import bpy, sys, os, json
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
OUT = os.path.abspath(_A[1]) if len(_A) > 1 else "crank-meshes.json"

GEOM = json.load(open(
    r"C:\20.HDev\boxcycle\apps\web\src\lib\riderPrototype\geometry.json", encoding="utf-8"))
BB_UP = GEOM["bbHeight"] / 1000.0
CRANK = GEOM["crankLength"]
PEDAL_OFF = GEOM["pedalOffset"]
SPINDLE = GEOM["bbSpindleHalf"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

rows = []
for o in bpy.data.objects:
    if o.type != "MESH" or not o.data.vertices:
        continue
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    n = len(ws)
    cx = sum(w.x for w in ws) / n          # 전후
    cy = sum(w.z for w in ws) / n          # 상하(up)
    cz = sum(w.y for w in ws) / n          # 좌우
    selected = (abs(cx) < 0.35 and cy < 0.5 and abs(cz) > 0.03 and abs(cx) > 0.02)
    # BB 근방(크랭크 회전 반경 안)에 있는가 — 필터와 무관한 "진짜 크랭크계" 판정
    near_bb = (abs(cx) < 0.30 and abs(cy - BB_UP) < 0.30 and abs(cz) > 0.02)
    rows.append({
        "name": o.name,
        "centerMM": {"fwd": round(cx * 1000, 2),
                     "up": round(cy * 1000, 2),
                     "lat": round(cz * 1000, 2)},
        "upFromBBmm": round((cy - BB_UP) * 1000, 2),
        "verts": n,
        "selectedByFilter": selected,
        "nearBB": near_bb,
        "reasonIfRejected": None if selected else "; ".join(
            r for r, ok in [
                ("abs(fwd)>=350", not (abs(cx) < 0.35)),
                ("up>=500", not (cy < 0.5)),
                ("abs(lat)<=30", not (abs(cz) > 0.03)),
                ("abs(fwd)<=20", not (abs(cx) > 0.02)),
            ] if ok) or None,
    })

selected = [r for r in rows if r["selectedByFilter"]]
missed = [r for r in rows if r["nearBB"] and not r["selectedByFilter"]]

out = {
    "glb": GLB,
    "filter": "abs(fwd)<350 and up<500 and abs(lat)>30 and abs(fwd)>20  (mm)",
    "ssot": {"crankLength": CRANK, "pedalOffset": PEDAL_OFF, "bbSpindleHalf": SPINDLE,
             "bbHeightMM": GEOM["bbHeight"]},
    "selectedCount": len(selected),
    "selected": sorted(selected, key=lambda r: (r["centerMM"]["lat"], r["centerMM"]["fwd"])),
    "nearBBButRejected": sorted(missed, key=lambda r: -abs(r["centerMM"]["lat"])),
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
