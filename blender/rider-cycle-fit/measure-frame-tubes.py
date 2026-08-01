"""
프레임 튜브 실측 — 렌더 육안 판정을 수치로 뒷받침한다(F1-R §R-3 보강).

cycle GLB 의 메시 노드 중 시트튜브·탑튜브·시트스테이 후보를 AABB 로 골라
접합점 좌표(BB 원점 mm)를 뽑는다. "그림에서 짧아 보인다"를 착시/실제로 가른다.

실행:
  blender --background --python measure-frame-tubes.py -- <glbPath> <label> <outJson>
"""
import bpy, sys, os, json
from mathutils import Vector

_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_ARGV[0])
LABEL = _ARGV[1] if len(_ARGV) > 1 else "unknown"
OUT = os.path.abspath(_ARGV[2]) if len(_ARGV) > 2 else "measure.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

BB_H = 0.2705  # 지면→BB (m)


def to_bb_mm(v):
    """Blender world (m, z-up, 지면 z=0) → BB 원점 mm [x, y]"""
    return [round(v.x * 1000, 3), round((v.z - BB_H) * 1000, 3)]


MESHES = [o for o in bpy.data.objects if o.type == "MESH"]

# 중앙평면(|y| 작음) 메시만 = 프레임 주삼각. 시트스테이는 ±0.028 로 벌어져 있다.
records = []
for o in MESHES:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    size = mx - mn
    records.append({
        "name": o.name,
        "minBB": to_bb_mm(mn),
        "maxBB": to_bb_mm(mx),
        "centerBB": to_bb_mm(ctr),
        "yCenter": round(ctr.y * 1000, 2),
        "sizeMM": [round(size.x * 1000, 2), round(size.y * 1000, 2), round(size.z * 1000, 2)],
        "diagMM": round(size.length * 1000, 2),
    })

# 시트튜브 후보: 중앙평면(|yCenter|<5), 세로로 길고(z>300mm), x 가 음수 영역
seat_tube = [r for r in records
             if abs(r["yCenter"]) < 5 and r["sizeMM"][2] > 300 and r["centerBB"][0] < 0]
# 탑튜브 후보: 중앙평면, 가로로 길고(x>400mm), 위쪽(centerY>250)
top_tube = [r for r in records
            if abs(r["yCenter"]) < 5 and r["sizeMM"][0] > 400 and r["centerBB"][1] > 250]
# 시트스테이 후보: 좌우로 벌어짐(|yCenter|>20), 뒤쪽(centerX<-150)
seat_stay = [r for r in records if abs(r["yCenter"]) > 20 and r["centerBB"][0] < -150
             and r["sizeMM"][0] > 200]

out = {
    "label": LABEL,
    "glb": GLB,
    "meshCount": len(MESHES),
    "seatTubeCandidates": sorted(seat_tube, key=lambda r: -r["diagMM"])[:4],
    "topTubeCandidates": sorted(top_tube, key=lambda r: -r["diagMM"])[:4],
    "seatStayCandidates": sorted(seat_stay, key=lambda r: -r["diagMM"])[:4],
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
print("실측 저장 %s" % OUT)
