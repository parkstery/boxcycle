"""F8 단계 A — 미확정 가정값 3개를 라이더 GLB 메시에서 **직접 실측**한다.

추정·가정 금지. 대상:
  ANKLE_BACK  발목 관절중심 → 발볼(중족골두) 전방 거리
  ANKLE_UP    발목 관절중심 → 발바닥 최하점 수직 거리 (+ 밑창·클릿 두께)
  hipDrop     HIP joint(THIGH head) → 좌골 최하 지지점 수직 거리

측정은 **rest 자세**(포즈 적용 전)에서, 라이더 로컬 좌표로 한다. 포즈가 걸리면
관절이 회전해 "전방/수직"의 의미가 흔들리기 때문이다.

좌골점 정의는 F2/코덱스가 확정한 것을 그대로 쓴다 — 안장을 읽기 전에 rider local
PELVIS 후하방 지지 밴드의 좌표별 median. 순환 정의(안장 최근접점)를 쓰지 않는다.

실행:
  blender --background --python measure-assumptions.py -- <scale> [jointsPath]
stdout 의 @@ASSUMPTIONS@@ JSON 만 소비한다.
"""
import bpy, sys, os, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SCALE = float(argv[0]) if argv else 0.88
joints_path = argv[1] if len(argv) > 1 else None

WF = r"C:\Users\kdrea\OneDrive\Documents\img\v2_4_cyclefit"
src = open(os.path.join(WF, "fit_ik.py"), encoding="utf-8").read()
if joints_path:
    src = src.replace('JOINTS = WF + r"\\ik-joints-v2.json"',
                      "JOINTS = r%r" % os.path.abspath(joints_path))
sys.argv = ["blender", "--", str(SCALE), "78", "hip", "x"]
exec(compile(src[:src.index("SWEEP = len(_ARG)")], "fit_ik_head", "exec"), globals())

rider = next(o for o in bpy.data.objects
             if o.type == "MESH" and "RIDER" in o.name.upper())
vgi = {g.name: g.index for g in rider.vertex_groups}

# ⚠ fit_ik.py 헤드는 import 후 배치까지만 하고 apply_phase 는 호출하지 않지만,
#   armature 가 이전 포즈를 들고 있을 수 있다. 실측은 반드시 **rest** 에서 한다 —
#   포즈가 걸리면 관절이 회전해 "전방/수직"의 의미가 흔들린다(지시 §2-1).
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = rider.evaluated_get(dg)
me = ev.to_mesh()


def world_pts(bone, thr=0.5):
    gi = vgi.get(bone)
    if gi is None:
        return []
    idx = [v.index for v in rider.data.vertices
           if any(g.group == gi and g.weight > thr for g in v.groups)]
    return [rider.matrix_world @ me.vertices[i].co for i in idx]


out = {
    "scale": SCALE,
    "note": "rest 자세 실측. world(Blender m→mm). +x 전방, +z 상. rest 값은 ÷scale.",
    "coordinateSystem": "Blender world mm: +x forward, +y lateral(+=left), +z up",
}

# ── 1) 발: 발목 = SHIN tail(= FOOT head). 발볼·발바닥을 발 메시에서 실측 ──
foot = {}
for side in ("L", "R"):
    ankle = eval_tail("SHIN_" + side)          # 발목 관절중심
    pts = world_pts("FOOT_" + side)
    if not pts:
        continue
    # 발바닥 최하점: z 최소
    sole = min(pts, key=lambda p: p.z)
    # 발볼(중족골두): 발 메시에서 '앞쪽 아래' 영역의 최전방 하부.
    #   전방 x 상위 25% 중 z 하위 25% 의 median 을 쓴다(단일 정점 노이즈 배제).
    xs = sorted(p.x for p in pts)
    x_cut = xs[int(len(xs) * 0.75)]
    fwd = [p for p in pts if p.x >= x_cut]
    zs = sorted(p.z for p in fwd)
    z_cut = zs[int(len(zs) * 0.25)] if zs else 0.0
    ball_band = [p for p in fwd if p.z <= z_cut] or fwd
    bx = sorted(p.x for p in ball_band)[len(ball_band) // 2]
    bz = sorted(p.z for p in ball_band)[len(ball_band) // 2]
    by = sorted(p.y for p in ball_band)[len(ball_band) // 2]
    ball = Vector((bx, by, bz))
    foot[side] = {
        "ankleWorldMm": [round(c * 1000, 2) for c in ankle],
        "ballWorldMm": [round(c * 1000, 2) for c in ball],
        "soleLowestWorldMm": [round(c * 1000, 2) for c in sole],
        "ankleToBallForwardMm": round((ball.x - ankle.x) * 1000, 2),
        "ankleToSoleVerticalMm": round((ankle.z - sole.z) * 1000, 2),
        "footLengthXMm": round((max(p.x for p in pts) - min(p.x for p in pts)) * 1000, 2),
        "vertexCount": len(pts),
    }
out["foot"] = foot

# ── 2) 골반: HIP joint(THIGH head 중점) → 좌골 최하 지지점 ──
hipL, hipR = eval_head("THIGH_L"), eval_head("THIGH_R")
hip_mid = (hipL + hipR) / 2

# 좌골점: rider local 후하방 PELVIS 지지 밴드 median (F2 정의 승계, 안장 미참조)
pel = vgi.get("PELVIS")
isch = {}
if pel is not None:
    idx = [v.index for v in rider.data.vertices
           if any(g.group == pel and g.weight >= 0.25 for g in v.groups)]
    # rider local 좌표로 판정(월드 포즈 회전의 영향 배제)
    loc = [(i, rider.data.vertices[i].co) for i in idx]
    for side, sign in (("L", 1), ("R", -1)):
        half = [(i, c) for i, c in loc if (c.x * sign) > 0]
        if not half:
            continue
        ys = sorted(c.y for _, c in half)
        y_cut = ys[int(len(ys) * 0.55)]              # 후방 55 percentile
        post = [(i, c) for i, c in half if c.y >= y_cut]
        zs = sorted(c.z for _, c in post)
        z_cut = zs[int(len(zs) * 0.20)]              # 그중 하부 20 percentile
        band = [(i, c) for i, c in post if c.z <= z_cut] or post
        wp = [rider.matrix_world @ me.vertices[i].co for i, _ in band]
        mx = sorted(p.x for p in wp)[len(wp) // 2]
        my = sorted(p.y for p in wp)[len(wp) // 2]
        mz = sorted(p.z for p in wp)[len(wp) // 2]
        isch[side] = {"worldMm": [round(mx * 1000, 2), round(my * 1000, 2),
                                  round(mz * 1000, 2)], "supportCount": len(band)}

pelvis = {
    "hipLWorldMm": [round(c * 1000, 2) for c in hipL],
    "hipRWorldMm": [round(c * 1000, 2) for c in hipR],
    "hipMidWorldMm": [round(c * 1000, 2) for c in hip_mid],
    "ischial": isch,
}
if "L" in isch and "R" in isch:
    iz = (isch["L"]["worldMm"][2] + isch["R"]["worldMm"][2]) / 2
    pelvis["ischialMidZMm"] = round(iz, 2)
    pelvis["hipToIschialVerticalMm"] = round(hip_mid.z * 1000 - iz, 2)
out["pelvis"] = pelvis

# ── 3) 실측 기반 가정값 후보 ──
if "R" in foot:
    ab = foot["R"]["ankleToBallForwardMm"]
    au_sole = foot["R"]["ankleToSoleVerticalMm"]
    out["derived"] = {
        "$note": "현행 상수와 대조용. 코드에는 반영하지 않는다(F8 §4).",
        "ANKLE_BACK_measured_scaled": round(ab, 2),
        "ANKLE_BACK_measured_rest": round(ab / SCALE, 2),
        "ANKLE_UP_soleOnly_scaled": round(au_sole, 2),
        "ANKLE_UP_soleOnly_rest": round(au_sole / SCALE, 2),
        "cleatThicknessAssumedMm": 15.0,
        "$note_cleat": "밑창+클릿 15mm 는 실물 로드 클릿(3~5mm)+밑창(10~12mm) 근거의 가정값. "
                       "GLB 에 클릿 메시가 없어 실측 불가 — 이번에도 가정임을 명시한다.",
        "ANKLE_UP_withCleat_scaled": round(au_sole + 15.0, 2),
        "hipDrop_measured": pelvis.get("hipToIschialVerticalMm"),
    }
    out["current"] = {"ANKLE_BACK": 149.4, "ANKLE_UP": 81.0, "hipDrop": 65.0}

ev.to_mesh_clear()
print("@@ASSUMPTIONS@@" + json.dumps(out, ensure_ascii=False))
