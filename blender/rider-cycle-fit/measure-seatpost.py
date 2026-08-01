"""시트포스트 실측 — 각도가 시트튜브와 평행한지, 노출 길이가 얼마인지(F4 §4 보고 요구).

메시에서 직접 잰다: 시트튜브(프레임색·굵음)와 시트포스트(어두움·얇음)를 중앙평면에서
골라 각각의 주축 방향과 끝점을 구한 뒤 두 축의 사잇각을 낸다.

실행:
  blender --background --python measure-seatpost.py -- <glb> <outJson>
"""
import bpy, sys, os, json, math
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
OUT = os.path.abspath(_A[1]) if len(_A) > 1 else "seatpost.json"

GEOM = json.load(open(
    r"C:\20.HDev\boxcycle\apps\web\src\lib\riderPrototype\geometry.json", encoding="utf-8"))
BB_H = GEOM["bbHeight"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)


def bb_mm(v):
    """Blender world m → BB 원점 mm [x, y(up)]"""
    return [v.x * 1000, v.z * 1000 - BB_H]


# 시트튜브 축 후보 영역: BB(0,0) 위쪽·뒤쪽(x<0). 중앙평면(|y|<20mm)만.
rows = []
for o in [x for x in bpy.data.objects if x.type == "MESH"]:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    if abs(ctr.y) > 0.02:
        continue
    size = mx - mn
    # 세로로 길고 뒤쪽(x<0)에 있는 것 = 시트튜브 또는 시트포스트 후보
    if size.z < 0.05 or ctr.x > 0.02:
        continue
    rows.append({
        "name": o.name,
        "minBB": [round(v, 2) for v in bb_mm(mn)],
        "maxBB": [round(v, 2) for v in bb_mm(mx)],
        "centerBB": [round(v, 2) for v in bb_mm(ctr)],
        "sizeMM": [round(size.x * 1000, 2), round(size.y * 1000, 2), round(size.z * 1000, 2)],
        # AABB 대각의 기울기로 축 각도 추정(원통이 기울어 있으면 대각이 축과 나란함)
        "widthMM": round(size.y * 1000, 2),
    })

rows.sort(key=lambda r: -(r["maxBB"][1] - r["minBB"][1]))


def true_axis(obj):
    """정점 PCA 로 원통 주축을 구한다 — AABB 대각 근사보다 정확하다.

    각도는 **수평 기준 후상방 +** 로 낸다(SSoT seatTubeAngle 과 같은 규약):
    축을 위로 향하게 정규화한 뒤 atan2(dy, -dx).
    """
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    n = len(vs)
    c = sum(vs, Vector()) / n
    # 2D(x,z) 공분산의 주고유벡터
    sxx = sum((v.x - c.x) ** 2 for v in vs) / n
    szz = sum((v.z - c.z) ** 2 for v in vs) / n
    sxz = sum((v.x - c.x) * (v.z - c.z) for v in vs) / n
    tr, det = sxx + szz, sxx * szz - sxz * sxz
    lam = tr / 2 + math.sqrt(max(0.0, tr * tr / 4 - det))
    if abs(sxz) > 1e-12:
        ax, az = lam - szz, sxz
    else:
        ax, az = (1.0, 0.0) if sxx >= szz else (0.0, 1.0)
    L = math.hypot(ax, az) or 1.0
    ax, az = ax / L, az / L
    if az < 0:                      # 위를 향하도록
        ax, az = -ax, -az
    ang = math.degrees(math.atan2(az, -ax))
    # 축을 따라 정점을 투영해 실제 길이·양끝을 구한다
    ts = [((v.x - c.x) * ax + (v.z - c.z) * az) for v in vs]
    lo, hi = min(ts), max(ts)
    p_lo = Vector((c.x + ax * lo, 0.0, c.z + az * lo))
    p_hi = Vector((c.x + ax * hi, 0.0, c.z + az * hi))
    return {
        "axisAngleDeg": round(ang, 3),
        "axisLengthMM": round((hi - lo) * 1000, 2),
        "lowEndBB": [round(v, 2) for v in bb_mm(p_lo)],
        "highEndBB": [round(v, 2) for v in bb_mm(p_hi)],
    }


_by_name = {o.name: o for o in bpy.data.objects if o.type == "MESH"}
for r in rows:
    r.update(true_axis(_by_name[r["name"]]))

out = {
    "glb": GLB,
    "ssot": {
        "seatTubeAngle": GEOM["seatTubeAngle"],
        "seatTubeLength": GEOM["seatTubeLength"],
        "saddleHeight": GEOM["saddleHeight"],
        "saddleSetback": GEOM["saddleSetback"],
        "coordsSeatTop": GEOM["coords"]["seatTop"],
        "coordsSaddle": GEOM["coords"]["saddle"],
    },
    "candidates": rows[:8],
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
