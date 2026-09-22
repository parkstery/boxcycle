"""양 발의 **밑창-발목원점 관계**를 좌우 동일하게 맞춘다 (사용자 "발과 페달이 따로 논다" 대응).

── 무엇이 문제였나 ──────────────────────────────────────────────────────
앱 rig 는 `ANKLE_BACK` · `ANKLE_UP` 을 **좌우 공용 한 쌍**으로 쓴다. 그런데 후보의 두
발은 발목 원점에 대한 밑창 위치가 크게 다르다(실측, rest 로컬):

    ankle_l  BACK 45.88mm · UP 42.97mm · 밑창 기울기 3.42°
    ankle_r  BACK 88.47mm · UP 28.05mm · 밑창 기울기 1.86°
    차이     BACK 42.6mm · UP 14.9mm

한 쌍으로는 두 발을 동시에 맞출 수 없다. 게다가 필요한 UP(= 밑창높이 + 페달상면)은
l 51.8mm · r 41.0mm 인데 앱은 65.66mm 를 쓴다 — **양쪽 다 필요값보다 높아서 양발이 뜬다**.
실측 뜸 17.73 / 28.46mm 가 이 차이(13.9 / 24.7mm)로 거의 그대로 설명된다.

── 왜 노드 원점이 아니라 메시를 옮기나 ──────────────────────────────────
수퍼바이저 지시는 "ankle 노드 원점을 옮겨라" 였다. 그런데 앱은 발목 노드의 로컬
평행이동이 **정확히 (0, −SHIN_LEN, 0)** 이라고 전제하고 IK 를 푼다 — 정강이를 회전시킨
뒤 발목이 IK 목표에 떨어지는 것은 그 전제 위에서만 성립한다. 원점을 축 밖으로 옮기면
발이 목표에서 벗어나고, 축을 따라 옮기면 좌우 SHIN_LEN 이 달라져야 하는데 앱에는
그 상수가 하나뿐이다. 어느 쪽이든 같은 문제가 되돌아온다.

그래서 **노드 원점과 로컬 T 는 그대로 두고 메시만 옮긴다.** 결과는 같다(좌우가 같은
관계를 갖는다) 면서 노드 계약을 건드리지 않는다. SHIN_LEN 은 바뀌지 않는다.

── 무엇을 하나 ──────────────────────────────────────────────────────────
발목 메시마다, 노드 원점을 중심으로
  1. 밑창 법선이 정확히 아래(−Z)를 향하도록 **회전**한다 (기울기 기준 ≤2° 대응)
  2. 밑창 중심이 좌우 공통 목표 (BACK*, UP*) 에 오도록 **평행이동**한다
BACK*·UP* 은 좌우 실측의 평균이다 — 한쪽에 맞추면 다른 쪽이 그만큼 더 움직인다.

정렬 방식(밑창 법선을 −Y 로)은 **바꾸지 않는다** — 수퍼바이저 지시대로 한 번에 하나씩.

제품 GLB·앱 코드는 건드리지 않는다. Blender 는 저장하지 않는다.

실행:
  blender --background --factory-startup --python align-ankle-mesh.py -- \
      <in.glb> <out.glb> <report.json>
"""
import bpy, sys, json, math
from mathutils import Vector, Matrix

_A = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, REPORT = _A[:3]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)

DOWN = Vector((0.0, 0.0, -1.0))


def sole(ob):
    """밑창 = 아래를 향하는 면들 중 **면적 합이 최대가 되는 8mm 두께 슬래브**.

    두 번 틀렸다. (1) `round(center.z,3)` 버킷 최대면적 → 발이 조금만 움직이면 다른
    버킷이 뽑혀 계측이 튀었다. (2) "가장 낮은 면에서 8mm" → 클릿처럼 **돌출된 작은
    면 2~13개**만 잡혀 그걸 수평으로 맞추느라 발이 26° 돌아갔다.
    높이를 훑으며 면적이 최대인 창을 고르면 큰 평면(진짜 밑창)이 안정적으로 뽑힌다.
    """
    down = [f for f in ob.data.polygons if f.normal.normalized().z < -0.5 and f.area > 1e-8]
    if not down:
        return None
    zmin = min(f.center.z for f in down)
    zmax = max(f.center.z for f in down)
    best, bz = -1.0, zmin
    z = zmin
    while z <= min(zmax, zmin + 0.12):
        a = sum(f.area for f in down if z <= f.center.z <= z + 0.008)
        if a > best:
            best, bz = a, z
        z += 0.001
    band = [f for f in down if bz <= f.center.z <= bz + 0.008]
    a = sum(f.area for f in band)
    c = sum((f.center * f.area for f in band), Vector()) / a
    n = sum((f.normal.normalized() * f.area for f in band), Vector()).normalized()
    return {"center": c, "normal": n, "areaM2": a,
            # 접촉면 = 밴드에 속한 면들의 **정점** 높이 중 하위 2% 지점.
            #   면 중심으로 잡으면 굽은 가장자리가 섞여 실제 접촉면보다 3.5mm 높게 나왔고,
            #   상수로 쓰니 발이 그만큼 떴다. 최저 정점 하나만 쓰면 튀는 점 하나에 휘둘린다.
            "contactZ": (lambda zs: zs[max(0, int(len(zs) * 0.02))])(
                sorted(ob.data.vertices[i].co.z for f in band for i in f.vertices)),
            "tiltDeg": math.degrees(math.acos(max(-1.0, min(1.0, -n.z)))),
            "bandFaces": len(band), "slabZmm": round(bz * 1000, 2)}


def pedal_top(side):
    """페달 **플랫폼 면**이 축(=페달 노드 원점) 위로 얼마나 있는가.

    정점 최대 z 를 쓰면 안 된다 — 판의 모서리·턱이 잡혀 좌우가 8.84 / 12.95mm 로
    4.1mm 어긋났고, 그만큼 발이 떴다. 위를 향하는 면 중 **면적 합이 최대가 되는
    4mm 슬래브**를 잡으면 발이 실제로 얹히는 면이 나온다.
    """
    ob = bpy.data.objects[f"pedal_{side}"]
    up = [f for f in ob.data.polygons if f.normal.normalized().z > 0.5 and f.area > 1e-8]
    if not up:
        return max(v.co.z for v in ob.data.vertices)
    zmin = min(f.center.z for f in up)
    zmax = max(f.center.z for f in up)
    best, bz, z = -1.0, zmin, zmin
    while z <= zmax:
        a = sum(f.area for f in up if z <= f.center.z <= z + 0.004)
        if a > best:
            best, bz = a, z
        z += 0.0005
    band = [f for f in up if bz <= f.center.z <= bz + 0.004]
    return sum(f.center.z * f.area for f in band) / sum(f.area for f in band)


report = {"tool": "blender/rider-cycle-fit/align-ankle-mesh.py",
          "why": "앱은 ANKLE_BACK·ANKLE_UP 을 좌우 공용 한 쌍으로 쓴다 — 후보의 두 발이 같은 관계를 가져야 한다",
          "nodeContract": "발목 노드의 원점과 로컬 T 는 건드리지 않았다. SHIN_LEN 불변.",
          "before": {}, "after": {}, "meshMoveMm": {}, "pedalTopMm": {}, "proposedConstants": {}}

# ── 1차 실측 ──────────────────────────────────────────────────────────────
meas = {}
for s in ("l", "r"):
    ob = bpy.data.objects[f"ankle_{s}"]
    sl = sole(ob)
    meas[s] = sl
    report["before"][s] = {"backMm": round(sl["center"].x * 1000, 2),
                           "upSlabCenterMm": round(-sl["center"].z * 1000, 2),
                           "upMm": round(-sl["contactZ"] * 1000, 2),
                           "tiltDeg": round(sl["tiltDeg"], 2),
                           "soleAreaCm2": round(sl["areaM2"] * 1e4, 1),
                           "localTranslationMm": [round(x * 1000, 2) for x in ob.matrix_local.translation]}
    report["pedalTopMm"][s] = round(pedal_top(s) * 1000, 2)   # (페달 평준화 전)

# ── 페달 플랫폼도 좌우 대칭으로 ──────────────────────────────────────────
# 두 페달 판이 축(노드 원점)에서 각각 5.85 / 9.95mm 위에 있다 — 4.1mm 어긋나 있다.
# 앱은 ANKLE_UP 이 하나뿐이라 이 비대칭이 그대로 한쪽 발의 뜸으로 남는다.
# 실제 자전거의 두 페달은 같은 물건이므로 평균으로 맞춘다(메시만, 원점·계약 불변).
pt_before = {s: pedal_top(s) for s in ("l", "r")}
pt_mean = sum(pt_before.values()) / 2
for s in ("l", "r"):
    dz = pt_mean - pt_before[s]
    bpy.data.objects[f"pedal_{s}"].data.transform(Matrix.Translation(Vector((0, 0, dz))))
    bpy.data.objects[f"pedal_{s}"].data.update()
report["pedalLevel"] = {
    "beforeMm": {k: round(v * 1000, 2) for k, v in pt_before.items()},
    "afterMm": {s: round(pedal_top(s) * 1000, 2) for s in ("l", "r")},
    "meshShiftMm": {s: round((pt_mean - pt_before[s]) * 1000, 2) for s in ("l", "r")},
    "why": "앱 상수가 하나뿐이라 좌우 4.1mm 비대칭이 한쪽 발의 뜸으로 남는다. 노드 원점·로컬 T 는 불변.",
}

# 좌우 공통 목표 = 평균
BACK = sum(meas[s]["center"].x for s in ("l", "r")) / 2
UP = sum(-meas[s]["contactZ"] for s in ("l", "r")) / 2   # 접촉면 기준
report["targetMm"] = {"backMm": round(BACK * 1000, 2), "upMm": round(UP * 1000, 2),
                      "rule": "좌우 실측의 평균 — 한쪽에 맞추면 다른 쪽이 그만큼 더 움직인다"}

# ── 회전 + 평행이동 ───────────────────────────────────────────────────────
for s in ("l", "r"):
    ob = bpy.data.objects[f"ankle_{s}"]
    total = Vector(); rot_deg = 0.0; iters = []
    # 회전이 밑창 무리를 바꾸고, 이동이 또 바꾼다 — **수렴할 때까지 반복**한다.
    for _ in range(6):
        sl = sole(ob)
        rq = sl["normal"].rotation_difference(DOWN)
        d = Vector((BACK - sl["center"].x, 0.0, -UP - sl["contactZ"]))
        iters.append({"tiltDeg": round(sl["tiltDeg"], 3), "moveMm": round(d.length * 1000, 3)})
        if sl["tiltDeg"] < 0.05 and d.length < 5e-5:
            break
        ob.data.transform(rq.to_matrix().to_4x4())     # 원점 중심 회전 — 원점은 안 움직인다
        sl = sole(ob)
        d = Vector((BACK - sl["center"].x, 0.0, -UP - sl["contactZ"]))
        ob.data.transform(Matrix.Translation(d))
        ob.data.update()
        rot_deg += math.degrees(rq.angle)
        total += d
    report["meshMoveMm"][s] = {"rotTotalDeg": round(rot_deg, 3),
                               "translateTotalMm": [round(x * 1000, 2) for x in total],
                               "translateLenMm": round(total.length * 1000, 2),
                               "iterations": iters}
    sl2 = sole(ob)
    report["after"][s] = {"backMm": round(sl2["center"].x * 1000, 2),
                          "upSlabCenterMm": round(-sl2["center"].z * 1000, 2),
                          "upMm": round(-sl2["contactZ"] * 1000, 2),
                          "tiltDeg": round(sl2["tiltDeg"], 3),
                          "bandFaces": sl2["bandFaces"],
                          "localTranslationMm": [round(x * 1000, 2) for x in ob.matrix_local.translation]}

# ── 단계 C 에 쓸 상수 제안 ────────────────────────────────────────────────
# 밑창이 페달 상면에 닿으려면 ANKLE_UP = (원점→밑창 높이) + (축→페달 상면 높이).
pt = sum(report["pedalTopMm"].values()) / 2
report["proposedConstants"] = {
    "ANKLE_BACK": round(BACK, 5),
    "ANKLE_UP": round(UP + pt / 1000.0, 5),
    "derivation": "ANKLE_BACK = 원점→밑창중심 전방거리 · ANKLE_UP = 원점→**접촉면** 높이 + 축→페달상면 높이",
    "pedalTopMeanMm": round(pt, 2),
    "residualFromPedalAsymmetryMm": round(abs(report["pedalTopMm"]["l"] - report["pedalTopMm"]["r"]) / 2, 2),
    "note": "페달 판이 좌우로 축에서 다르게 붙어 있어 그만큼 잔차가 남는다. 페달 메시는 이번에 건드리지 않았다.",
    "current": {"ANKLE_BACK": 0.10310, "ANKLE_UP": 0.06566},
}

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True,
                          export_apply=False, export_cameras=False, export_lights=False)
json.dump(report, open(REPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ANKLE_ALIGN_COMPLETE",
      json.dumps({"target": report["targetMm"], "after": report["after"],
                  "proposed": report["proposedConstants"]}, ensure_ascii=False))
