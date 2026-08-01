"""라이더 분절 길이 실측 — 스케일 후보 비교용(지시: 각 그림에 수치 표기).

지시가 요구한 5개 항목을 렌더와 **같은 씬**에서 잰다:
  신장 · 고관절–무릎 · 무릎–발목 · 어깨–팔꿈치 · 팔꿈치–손목

기존 manifest 의 jointDistancesMm 는 thigh/shin/foot/torso 만 있어 팔·신장이 빠져 있었다.
신장은 본 길이 합이 아니라 **평가된 메시 AABB 의 z 범위**로 잰다(발바닥~머리끝, 실제 외형).

실행:
  blender --background --python measure-segments.py -- <scale> [jointsPath]
stdout 의 @@SEGMENTS@@ JSON 만 소비한다.
"""
import bpy, sys, os, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
scale = argv[0] if argv else "0.88"
joints_path = argv[1] if len(argv) > 1 else None

wf = r"C:\Users\kdrea\OneDrive\Documents\img\v2_4_cyclefit"
src = open(os.path.join(wf, "fit_ik.py"), encoding="utf-8").read()
if joints_path:
    src = src.replace(
        'JOINTS = WF + r"\\ik-joints-v2.json"',
        "JOINTS = r%r" % os.path.abspath(joints_path))
sys.argv = ["blender", "--", scale, "78", "hip", "x"]
exec(compile(src[:src.index("SWEEP = len(_ARG)")], "fit_ik_head", "exec"), globals())

# rest 자세(포즈 전)에서 분절을 잰다 — 포즈에 따라 관절 간 거리는 변하지 않지만,
# 신장은 라이딩 자세에서 웅크리므로 rest 기준이 비교에 적합하다.
rider = next((o for o in bpy.data.objects
              if o.type == "MESH" and "RIDER" in o.name.upper()), None)


def dist_mm(a, b):
    return round((a - b).length * 1000, 1)


def head_of(bone):
    return eval_head(bone)


def tail_of(bone):
    return eval_tail(bone)


segments = {}
for side in ("L", "R"):
    segments["hipToKnee" + side] = dist_mm(head_of("THIGH_" + side), tail_of("THIGH_" + side))
    segments["kneeToAnkle" + side] = dist_mm(head_of("SHIN_" + side), tail_of("SHIN_" + side))
    segments["shoulderToElbow" + side] = dist_mm(
        head_of("UPPER_ARM_" + side), tail_of("UPPER_ARM_" + side))
    segments["elbowToWrist" + side] = dist_mm(
        head_of("FOREARM_" + side), tail_of("FOREARM_" + side))

# 신장: 평가된 라이더 메시의 z 범위(발바닥~머리끝). 헬멧 포함.
stature = None
if rider is not None:
    dg = bpy.context.evaluated_depsgraph_get()
    ev = rider.evaluated_get(dg)
    me = ev.to_mesh()
    zs = [(rider.matrix_world @ v.co).z for v in me.vertices]
    stature = round((max(zs) - min(zs)) * 1000, 1)
    ev.to_mesh_clear()

out = {
    "scale": float(scale),
    "note": "rest 자세 실측. 신장은 메시 AABB z범위(헬멧 포함), 분절은 본 head→tail.",
    "statureMm": stature,
    "segmentsMm": segments,
    # 좌우 평균 — 종합판 표기용(좌우 대칭이므로 한 값으로 충분)
    "displayMm": {
        "stature": stature,
        "hipToKnee": segments.get("hipToKneeL"),
        "kneeToAnkle": segments.get("kneeToAnkleL"),
        "shoulderToElbow": segments.get("shoulderToElbowL"),
        "elbowToWrist": segments.get("elbowToWristL"),
    },
}
print("@@SEGMENTS@@" + json.dumps(out, ensure_ascii=False))
