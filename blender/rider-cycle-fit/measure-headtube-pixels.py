"""헤드튜브 노출을 **렌더 픽셀**로 실측한다(F3 §2-2 삼각형 판정).

AABB 방식은 축정렬 박스가 헤드튜브 전 구간을 덮어 항상 0 을 내므로 쓸 수 없다(실측 확인).
여기서는 정직교 측면 렌더를 굽되 **탑튜브·다운튜브만 색을 입히고** 헤드튜브 축을 따라
스캔해, 두 색 사이에 몇 mm 가 비어 있는지 센다. 렌더가 곧 사용자가 보는 그림이므로
"사각형처럼 보이는가"를 가장 직접적으로 재는 방법이다.

실행:
  blender --background --python measure-headtube-pixels.py -- <glb> <headTopMm "x,y"> <outDir> <label>
"""
import bpy, sys, os, json
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = os.path.abspath(_A[0])
HEAD_TOP_MM = [float(v) for v in _A[1].split(",")]
OUT_DIR = os.path.abspath(_A[2])
LABEL = _A[3] if len(_A) > 3 else "x"
os.makedirs(OUT_DIR, exist_ok=True)

GEOM = json.load(open(
    r"C:\20.HDev\boxcycle\apps\web\src\lib\riderPrototype\geometry.json", encoding="utf-8"))
BB_H_M = GEOM["bbHeight"] / 1000.0
HEAD_BOT_MM = GEOM["coords"]["headBot"]
JUNCTION_MM = [-116.446, 393.116]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

W = lambda p: Vector((p[0] / 1000.0, 0.0, p[1] / 1000.0 + BB_H_M))
top, bot = W(HEAD_TOP_MM), W(HEAD_BOT_MM)
junc = W(JUNCTION_MM)
bb = W([0, 0])
axis = top - bot
L_mm = axis.length * 1000

meshes = [o for o in bpy.data.objects if o.type == "MESH"]


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


# 각 메시를 중심선 근접도로 분류: 탑튜브(junction→headTop), 다운튜브(bb→headBot)
def classify(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    ctr = sum(pts, Vector()) / len(pts)
    if abs(ctr.y) > 0.02:
        return None
    dt = seg_dist(ctr, junc, top)
    dd = seg_dist(ctr, bb, bot)
    dh = seg_dist(ctr, bot, top)
    best = min(dt, dd, dh)
    if best > 0.05:
        return None
    return "TOP" if best == dt else ("DOWN" if best == dd else "HEAD")


groups = {"TOP": [], "DOWN": [], "HEAD": []}
for o in meshes:
    k = classify(o)
    if k:
        groups[k].append(o)

# 색 입히기: 탑=빨강, 다운=파랑, 헤드=초록, 나머지 숨김
def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = False
    m.diffuse_color = (*rgb, 1)
    return m


COL = {"TOP": mat("T", (1, 0, 0)), "DOWN": mat("D", (0, 0, 1)), "HEAD": mat("H", (0, 1, 0))}
for o in meshes:
    k = classify(o)
    if not k:
        o.hide_render = True
        continue
    o.data.materials.clear()
    o.data.materials.append(COL[k])

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "FLAT"
sc.display.shading.color_type = "MATERIAL"
sc.render.film_transparent = True
RES = 2400
sc.render.resolution_x = RES
sc.render.resolution_y = RES

cam_d = bpy.data.cameras.new("C")
cam = bpy.data.objects.new("C", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
cam_d.type = "ORTHO"
mid = (top + bot) / 2
SPAN = 0.42
cam_d.ortho_scale = SPAN
cam.location = Vector((mid.x, -2.0, mid.z))
cam.rotation_euler = (Vector((0, 0, 0)) - Vector((0, -1, 0))).to_track_quat("-Z", "Y").to_euler()
cam.rotation_euler = (1.5707963, 0, 0)

png = os.path.join(OUT_DIR, "HEADTUBE_SCAN_%s.png" % LABEL)
sc.render.filepath = png
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(png)
px = list(img.pixels)
w, h = img.size


def sample(p):
    """world → 픽셀 색 분류"""
    u = (p.x - (mid.x - SPAN / 2)) / SPAN
    v = (p.z - (mid.z - SPAN / 2)) / SPAN
    if not (0 <= u < 1 and 0 <= v < 1):
        return "OUT"
    xi, yi = int(u * w), int(v * h)
    i = (yi * w + xi) * 4
    r, g, b, a = px[i], px[i + 1], px[i + 2], px[i + 3]
    if a < 0.5:
        return "BG"
    if r > 0.5 and g < 0.4:
        return "TOP"
    if b > 0.5 and r < 0.4:
        return "DOWN"
    if g > 0.5 and r < 0.4:
        return "HEAD"
    return "OTHER"

# 헤드튜브 축을 따라 스캔하되, 각 지점에서 축의 **좌우 수직 방향**으로도 훑어
# 탑/다운 튜브가 그 높이에 존재하는지 본다(축 위 한 점만 보면 헤드튜브 색만 나온다).
axis_n = (top - bot).normalized()
perp = Vector((-axis_n.z, 0, axis_n.x))
N = 600
rows = []
for i in range(N + 1):
    t = i / N
    p = bot + (top - bot) * t
    seen = set()
    for k in range(-60, 61):
        q = p + perp * (k * 0.0008)
        seen.add(sample(q))
    rows.append({
        "t": round(t, 4),
        "mm": round(t * L_mm, 2),
        "hasTop": "TOP" in seen,
        "hasDown": "DOWN" in seen,
    })

# 탑튜브가 붙는 최저 지점, 다운튜브가 붙는 최고 지점 사이 = 노출 구간
top_lo = next((r["mm"] for r in rows if r["hasTop"]), None)
down_hi = next((r["mm"] for r in reversed(rows) if r["hasDown"]), None)
exposed = None
if top_lo is not None and down_hi is not None:
    exposed = top_lo - down_hi

out = {
    "label": LABEL,
    "glb": GLB,
    "headTubeLengthMm": round(L_mm, 3),
    "groups": {k: [o.name for o in v] for k, v in groups.items()},
    "topTubeLowestOnAxisMm": top_lo,
    "downTubeHighestOnAxisMm": down_hi,
    "exposedHeadTubeMm": None if exposed is None else round(exposed, 2),
    "verdict": None if exposed is None else (
        "TRIANGLE(두 관이 각을 이룸)" if exposed <= 8 else
        "NEAR_TRIANGLE" if exposed <= 25 else "SQUARE(헤드튜브가 드러남)"),
    "scanPng": png,
}
json.dump(out, open(os.path.join(OUT_DIR, "headtube-pixels-%s.json" % LABEL), "w",
                    encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
