"""렌더 없이 4위상 접점 좌표를 기록한다. stdout 의 @@POINTS@@ JSON만 소비한다."""
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


def mm(v):
    return [round(float(v.x) * 1000, 3),
            round(float(v.y) * 1000, 3),
            round(float(v.z) * 1000, 3)]


result = {
    "note": "현재 drift 입력 재생 계측. 20260730-070000-final 원본 manifest에 없던 좌표이므로 기존 후보 PASS 근거로 사용 금지.",
    "coordinateSystem": "Blender mm: +x forward, +y lateral, +z up",
    "assumptionsUnconfirmed": {
        "ANKLE_BACK_mm": 149.4,
        "ANKLE_UP_mm": 81.0,
        "hipDrop_mm": 65.0,
    },
    "phases": {},
}
for pkey, deg in (("0.000", 0), ("0.250", 90), ("0.500", 180), ("0.750", 270)):
    apply_phase(pkey)
    d = JD["phases"][pkey]
    phase = {}
    for side in ("L", "R"):
        ankle = eval_tail("SHIN_" + side)
        ball = eval_tail("FOOT_" + side)
        contact = cleat_of(ankle)
        pedal = g2b(d["pedalAxle" + side])
        phase[side] = {
            "ANKLE_CENTER_mm": mm(ankle),
            "BALL_CENTER_mm": mm(ball),
            "CLEAT_CONTACT_mm": mm(contact),
            "PEDAL_AXLE_mm": mm(pedal),
            "ballToPedalErrorMm": round((ball - pedal).length * 1000, 3),
            "cleatContactToPedalErrorMm": round((contact - pedal).length * 1000, 3),
        }
    result["phases"][str(deg)] = phase
print("@@POINTS@@" + json.dumps(result, ensure_ascii=False))
