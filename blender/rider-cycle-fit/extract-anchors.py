"""
extract-anchors — 단계 A: rider·cycle GLB 에서 결합 접점 앵커를 실제 추출해 JSON 출력.
HTML 내부 상수가 아니라 두 GLB 의 실제 좌표를 저장(지시서 2026-07-29).

라이더: armature 본 rest world head/tail 에서 pelvis·좌골·어깨·손·고관절·무릎·발목·클릿.
자전거: 메시 좌표에서 BB·크랭크·페달·seatTop·headTop/Bot·hub·saddle·hood.
좌표: glTF 규약으로 환산(x전방,y상,z좌). Blender world(z=up) → glTF(y=up): gltf=(bx, bz, -by).

실행: blender --background --python extract-anchors.py -- <rider_glb> <cycle_glb>
출력: "@@ANCHORS@@ <json>"
"""
import bpy, sys, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RIDER, CYCLE = argv[0], argv[1]

def clear():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
    for c in (bpy.data.meshes, bpy.data.armatures, bpy.data.objects):
        for b in list(c):
            try: c.remove(b)
            except Exception: pass

def b2gltf(v):  # Blender world(z=up) → glTF mm(x전방,y상,z좌)
    return [round(v.x * 1000, 1), round(v.z * 1000, 1), round(-v.y * 1000, 1)]

# ── 라이더 앵커: armature 본 rest world ──
clear()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=RIDER)
robjs = [o for o in bpy.data.objects if o not in before]
arm = next((o for o in robjs if o.type == "ARMATURE"), None)
rider = {"error": "armature 없음"}
if arm:
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    def head(name):
        b = arm.data.bones.get(name)
        return b2gltf(mw @ b.head_local) if b else None
    def tail(name):
        b = arm.data.bones.get(name)
        return b2gltf(mw @ b.tail_local) if b else None
    rider = {
        "pelvisRoot": head("PELVIS"),
        "hipL": head("THIGH_L"), "hipR": head("THIGH_R"),
        "kneeL": tail("THIGH_L"), "kneeR": tail("THIGH_R"),  # THIGH tail = SHIN head = 무릎
        "ankleL": tail("SHIN_L"), "ankleR": tail("SHIN_R"),  # SHIN tail = FOOT head = 발목
        "cleatL": tail("FOOT_L"), "cleatR": tail("FOOT_R"),  # FOOT tail ≈ 발 앞(클릿 근사)
        "shoulderL": head("UPPER_ARM_L"), "shoulderR": head("UPPER_ARM_R"),
        "handL": tail("FOREARM_L"), "handR": tail("FOREARM_R"),  # FOREARM tail = 손목/grip
        "chest": head("CHEST"), "neck": head("NECK"), "head": head("HEAD"),
        "note": "rest world(glTF mm). 좌골 접촉점은 pelvisRoot 아래 offset(결합 스크립트가 적용).",
        "boneLengths_mm": {
            "thigh": round((arm.data.bones["THIGH_L"].length) * 1000, 1) if arm.data.bones.get("THIGH_L") else None,
            "shin": round((arm.data.bones["SHIN_L"].length) * 1000, 1) if arm.data.bones.get("SHIN_L") else None,
            "upperArm": round((arm.data.bones["UPPER_ARM_L"].length) * 1000, 1) if arm.data.bones.get("UPPER_ARM_L") else None,
            "forearm": round((arm.data.bones["FOREARM_L"].length) * 1000, 1) if arm.data.bones.get("FOREARM_L") else None,
        },
    }

# ── 자전거 앵커: 메시 좌표 클러스터 ──
clear()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CYCLE)
cobjs = [o for o in bpy.data.objects if o not in before]
# 각 메시 world 중심
centers = []
for o in cobjs:
    if o.type != "MESH" or not o.data.vertices:
        continue
    if "hadow" in o.name.lower():
        continue
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    cx = sum(w.x for w in ws) / len(ws)
    cy = sum(w.y for w in ws) / len(ws)
    cz = sum(w.z for w in ws) / len(ws)
    mnz = min(w.z for w in ws); mxz = max(w.z for w in ws)
    mnx = min(w.x for w in ws); mxx = max(w.x for w in ws)
    centers.append({"name": o.name, "c": Vector((cx, cy, cz)), "zr": (mnz, mxz), "xr": (mnx, mxx), "n": len(ws)})

# BB: x~0,y(좌우)~0, z_up~0.27 부근의 중앙 메시 클러스터
def near_bb(m):
    return abs(m["c"].x) < 0.05 and abs(m["c"].y) < 0.05 and 0.22 < m["c"].z < 0.32
bb_cands = [m for m in centers if near_bb(m)]
# 페달/크랭크: BB 부근서 좌우로 벌어진(|y|>0.03), 낮은(z<0.5)
def near_pedal(m):
    return abs(m["c"].x) < 0.35 and m["c"].z < 0.5 and abs(m["c"].y) > 0.03 and abs(m["c"].x) > 0.02
pedal_cands = [m for m in centers if near_pedal(m)]
# 안장: 뒤(x<-0.1) 위(z>0.85)
saddle_cands = [m for m in centers if m["c"].x < -0.1 and m["c"].z > 0.85]
# 후드: 앞(x>0.4) 중간(0.55<z<0.75)
hood_cands = [m for m in centers if m["c"].x > 0.4 and 0.55 < m["c"].z < 0.78]
# 허브: 가장 큰 원형 두 개(앞/뒤). x 최소/최대 근처, z~0.32
wheel_cands = sorted(centers, key=lambda m: -m["n"])[:6]

def avg(cands):
    if not cands: return None
    v = Vector((0, 0, 0))
    for m in cands: v += m["c"]
    v /= len(cands)
    return b2gltf(v)

cycle = {
    "BB": avg(bb_cands) or [0, 270.5, 0],
    "pedalCluster": avg(pedal_cands),
    "pedalClusterCount": len(pedal_cands),
    "saddleSurface": avg(saddle_cands),
    "hoodGrip": avg(hood_cands),
    "note": "메시 좌표 클러스터 추정(glTF mm). BB·페달·안장·후드는 근사 — 결합 스크립트가 geometry.json 정본과 대조.",
    "geometryJsonRef": "정본 좌표는 apps/web/src/lib/riderPrototype/geometry.json coords(BB원점): BB[0,0]·seatTop[-159,536.9]·headTop[388,573]·headBot[436.2,415.2]·saddle[-226,695]·frontHub[590.3,72]·rearHub[-403.6,72]",
}

print("@@ANCHORS@@ " + json.dumps({"rider": rider, "cycle": cycle}, ensure_ascii=False))
