"""헤드튜브 노출 구간 실측 — 삼각형 판정(F3 §2-2)을 육안이 아니라 수치로 가른다.

"탑튜브·다운튜브 사이에 헤드튜브가 얼마나 드러나는가"를 메시에서 직접 잰다.
드러난 구간이 길수록 사각형처럼 보이고, 0 에 가까울수록 두 관이 각을 이룬다(삼각형).

방법: 헤드튜브 축(headBot→headTop) 위 샘플점마다, 그 점이 탑튜브/다운튜브 메시 AABB
안에 들어가는지 본다. 어느 쪽에도 안 덮이는 연속 구간의 길이 = 노출 길이.

실행:
  blender --background --python measure-headtube-exposure.py -- <glb> <headTopMm "x,y"> <outJson>
"""
import bpy, sys, os, json
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
HEAD_TOP_MM = [float(v) for v in _A[1].split(",")]
OUT = os.path.abspath(_A[2]) if len(_A) > 2 else "headtube.json"

GEOM = json.load(open(
    r"C:\20.HDev\boxcycle\apps\web\src\lib\riderPrototype\geometry.json", encoding="utf-8"))
BB_H = GEOM["bbHeight"] / 1000.0
HEAD_BOT_MM = GEOM["coords"]["headBot"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)


def to_world(p_mm):
    return Vector((p_mm[0] / 1000.0, 0.0, p_mm[1] / 1000.0 + BB_H))


top = to_world(HEAD_TOP_MM)
bot = to_world(HEAD_BOT_MM)
axis = top - bot
L_mm = axis.length * 1000
axis_n = axis.normalized()

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
boxes = []
for o in meshes:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    size = mx - mn
    boxes.append({"name": o.name, "min": mn, "max": mx, "center": ctr, "size": size})

# 탑튜브: 중앙평면·가로로 김·헤드튜브보다 뒤에서 옴. 다운튜브: 중앙평면·BB 쪽에서 옴.
# 이름이 없으므로 기하로 고른다. 헤드튜브 자신은 축과 거의 평행하고 짧다.
def covers(box, p, pad=0.0):
    return all(box["min"][i] - pad <= p[i] <= box["max"][i] + pad for i in range(3))


SAMPLES = 400
samples = []
for i in range(SAMPLES + 1):
    t = i / SAMPLES
    p = bot + axis * t
    # 헤드튜브 자체(축을 따라 길고 얇은 중앙 메시)는 제외해야 "드러남"을 잴 수 있다.
    hits = []
    for b in boxes:
        if abs(b["center"].y) > 0.02:      # 좌우로 벌어진 것(포크·스테이) 제외
            continue
        if not covers(b, p):
            continue
        # 축 방향으로 길쭉하고 폭이 좁으면 헤드튜브 자신 → 제외
        along = abs((b["size"].x * axis_n.x) + (b["size"].z * axis_n.z))
        if b["size"].x < 0.07 and b["size"].z < 0.16 and along > 0.05:
            continue
        hits.append(b["name"])
    samples.append({"t": round(t, 4), "posMm": [round(p.x * 1000, 2), round(p.z * 1000 - BB_H * 1000, 2)],
                    "covered": len(hits) > 0, "by": hits})

uncovered = [s for s in samples if not s["covered"]]
# 최장 연속 미덮임 구간
best = cur = 0
for s in samples:
    cur = 0 if s["covered"] else cur + 1
    best = max(best, cur)
exposed_mm = best / SAMPLES * L_mm

out = {
    "glb": GLB,
    "headTopMm": HEAD_TOP_MM,
    "headBotMm": HEAD_BOT_MM,
    "headTubeLengthMm": round(L_mm, 3),
    "samples": SAMPLES,
    "uncoveredSamples": len(uncovered),
    "longestExposedRunMm": round(exposed_mm, 2),
    "exposedRatio": round(len(uncovered) / (SAMPLES + 1), 4),
    "verdict": ("TRIANGLE(각을 이룸)" if exposed_mm <= 8 else
                "NEAR_TRIANGLE" if exposed_mm <= 25 else "SQUARE(헤드튜브 드러남)"),
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
