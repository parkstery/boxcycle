"""0.88 안장–좌골 접촉의 수치·일반/표식 Blender 증거를 후보 manifest에 추가한다."""
import bpy, sys, os, json, math, hashlib, datetime, inspect
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
scale, candidate_id, out_dir, input_hash, joints_path = argv[:5]
# cycle GLB 오버라이드(선택) — 프레임 후보를 계측 대상으로 쓴다. 미지정 시 fit_ik.py 기본.
cycle_path = argv[5] if len(argv) > 5 else None
wf = r"C:\Users\kdrea\OneDrive\Documents\img\v2_4_cyclefit"
src = open(os.path.join(wf, "fit_ik.py"), encoding="utf-8").read()
src = src.replace(
    'JOINTS = WF + r"\\ik-joints-v2.json"',
    "JOINTS = r%r" % os.path.abspath(joints_path))
if cycle_path:
    src = src.replace(
        'CYCLE = WF + r"\\cycle-only.glb"',
        "CYCLE = r%r" % os.path.abspath(cycle_path))
    print("cycle GLB 오버라이드: %s" % os.path.abspath(cycle_path))
sys.argv = ["blender", "--", scale, "78", "hip", "x"]
exec(compile(src[:src.index("SWEEP = len(_ARG)")], "fit_ik_head", "exec"), globals())
apply_phase("0.000")
rotate_cranks(crank_rot(JD["phases"]["0.000"]["crankDeg"]))
bpy.context.view_layer.update()
bpy.context.evaluated_depsgraph_get().update()

sc = bpy.context.scene
setup_render()
sc.render.resolution_x = 900
sc.render.resolution_y = 700
sc.render.resolution_percentage = 100


def mm(v):
    return [round(float(v.x) * 1000, 3),
            round(float(v.y) * 1000, 3),
            round(float(v.z) * 1000, 3)]


def dist_mm(a, b):
    return round((a - b).length * 1000, 3)


def angle_deg(a, vertex, c):
    va, vc = a - vertex, c - vertex
    if va.length < 1e-9 or vc.length < 1e-9:
        return None
    return round(math.degrees(va.angle(vc)), 3)


rider_mesh = next(o for o in v2objs if o.type == "MESH" and "RIDER" in o.name.upper())
group_index = rider_mesh.vertex_groups["PELVIS"].index


def evaluated_vertices(obj, indices=None, with_local=False):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    use = indices if indices is not None else range(len(me.vertices))
    pts = [
        (i, me.vertices[i].co.copy(), ev.matrix_world @ me.vertices[i].co)
        if with_local else ev.matrix_world @ me.vertices[i].co
        for i in use
    ]
    ev.to_mesh_clear()
    return pts


def vertex_weight(index):
    v = rider_mesh.data.vertices[index]
    return max((g.weight for g in v.groups if g.group == group_index), default=0.0)


all_pelvis_indices = [v.index for v in rider_mesh.data.vertices if vertex_weight(v.index) > 0]
pelvis_records = evaluated_vertices(rider_mesh, all_pelvis_indices, with_local=True)


def percentile(values, p):
    ordered = sorted(values)
    if not ordered:
        raise ValueError("percentile 대상이 비어 있음")
    pos = (len(ordered) - 1) * p / 100.0
    lo, hi = int(math.floor(pos)), int(math.ceil(pos))
    if lo == hi:
        return ordered[lo]
    return ordered[lo] * (hi - pos) + ordered[hi] * (pos - lo)


def median_point(points):
    return Vector((
        percentile([p.x for p in points], 50),
        percentile([p.y for p in points], 50),
        percentile([p.z for p in points], 50),
    ))


def rider_only_ischial(weight_threshold, lower_percentile, posterior_percentile=55):
    """안장과 무관한 rider-local 후하방 강건 중심.

    local +X=좌, -X=우, +Y=후방, +Z=상방. 각 좌우에서 posterior cutoff 이상만
    남긴 뒤 그 집합의 local Z 하위 percentile을 지지 밴드로 삼고 좌표별 median을 쓴다.
    """
    weighted = [
        (i, local, world) for i, local, world in pelvis_records
        if vertex_weight(i) >= weight_threshold
    ]
    result = {}
    for side, side_fn in (("L", lambda p: p.x > 0), ("R", lambda p: p.x < 0)):
        half = [(i, l, w) for i, l, w in weighted if side_fn(l)]
        posterior_cut = percentile([l.y for _, l, _ in half], posterior_percentile)
        posterior = [(i, l, w) for i, l, w in half if l.y >= posterior_cut]
        lower_cut = percentile([l.z for _, l, _ in posterior], lower_percentile)
        support = [(i, l, w) for i, l, w in posterior if l.z <= lower_cut]
        robust_local = median_point([l for _, l, _ in support])
        robust_world = rider_mesh.evaluated_get(
            bpy.context.evaluated_depsgraph_get()).matrix_world @ robust_local
        result[side] = {
            "pointLocal": robust_local,
            "pointWorld": robust_world,
            "halfCount": len(half),
            "posteriorCount": len(posterior),
            "supportCount": len(support),
            "posteriorCutLocalMm": posterior_cut * 1000,
            "lowerCutLocalMm": lower_cut * 1000,
        }
    return result


NOMINAL_WEIGHT = 0.25
NOMINAL_LOWER_PCT = 20
NOMINAL_POSTERIOR_PCT = 55
nominal = rider_only_ischial(NOMINAL_WEIGHT, NOMINAL_LOWER_PCT, NOMINAL_POSTERIOR_PCT)
ischial_l = nominal["L"]["pointWorld"]
ischial_r = nominal["R"]["pointWorld"]
contact = (ischial_l + ischial_r) / 2

# 민감도: 안장을 읽기 전에 rider-only 선택 규칙만 변화시킨다.
sensitivity_rows = []
for wt in (0.15, 0.25, 0.40):
    for lp in (15, 20, 25):
        sample = rider_only_ischial(wt, lp, NOMINAL_POSTERIOR_PCT)
        sl, sr = sample["L"]["pointWorld"], sample["R"]["pointWorld"]
        sm = (sl + sr) / 2
        sensitivity_rows.append({
            "weightThreshold": wt,
            "lowerPercentile": lp,
            "posteriorPercentile": NOMINAL_POSTERIOR_PCT,
            "leftWorldMm": mm(sl),
            "rightWorldMm": mm(sr),
            "contactMidWorldMm": mm(sm),
            "leftShiftFromNominalMm": dist_mm(sl, ischial_l),
            "rightShiftFromNominalMm": dist_mm(sr, ischial_r),
            "midShiftFromNominalMm": dist_mm(sm, contact),
            "leftSupportCount": sample["L"]["supportCount"],
            "rightSupportCount": sample["R"]["supportCount"],
        })
max_sensitivity_shift = max(
    max(r["leftShiftFromNominalMm"], r["rightShiftFromNominalMm"]) for r in sensitivity_rows)
SENSITIVITY_LIMIT_MM = 20.0
sensitivity_stable = max_sensitivity_shift <= SENSITIVITY_LIMIT_MM

# 좌골점이 rider-only로 확정된 뒤에만 cycle 안장 메시를 읽는다.
#
# 안장 식별은 **SSoT(geometry.json coords.saddle)에서 파생한 기대 위치 근방**으로 한정한다.
# 과거 필터 `center.x < -0.1 and zMax > 0.85` 는 "왼쪽·높이" 조건뿐이라, F1 으로 시트포스트가
# 노출되자 시트포스트 메시(center z≈881mm, zMin≈803mm)까지 안장으로 집어삼켰다. 그 결과
# 좌골 최근접점이 안장이 아니라 시트포스트 하단을 잡아 안장 표면이 SSoT 대비 162mm 낮게
# 계측됐다(2026-07-31 F2-1). 기대 위치 기준이면 시트포스트가 아무리 길어져도 오검출되지 않는다.
_geom_path = os.path.join(
    r"C:\20.HDev\boxcycle\apps\web", "src", "lib", "riderPrototype", "geometry.json")
with open(_geom_path, encoding="utf-8") as _gf:
    _GEOM = json.load(_gf)
# geometry.json 은 BB 원점 mm. Blender world = (x/1000, ..., (y+bbHeight)/1000).
SADDLE_EXPECT_X_M = _GEOM["coords"]["saddle"][0] / 1000.0
SADDLE_EXPECT_Z_M = (_GEOM["coords"]["saddle"][1] + _GEOM["bbHeight"]) / 1000.0
# 허용 반경 — 안장 메시(길이 ~250mm·두께 ~50mm)는 포함하고 시트포스트 중심(약 84mm 아래,
# 33mm 앞)은 배제하는 값. 안장 자체 크기에서 온 값이며 임의 상수가 아니다.
SADDLE_DETECT_RADIUS_M = 0.075
saddle_objects = []
saddle_detect_rows = []
cycle_meshes = [o for o in bpy.data.objects if o.type == "MESH" and o not in v2objs]
for o in cycle_meshes:
    pts = evaluated_vertices(o)
    center = sum(pts, Vector()) / len(pts)
    d = math.hypot(center.x - SADDLE_EXPECT_X_M, center.z - SADDLE_EXPECT_Z_M)
    hit = d <= SADDLE_DETECT_RADIUS_M
    if hit:
        saddle_objects.append(o)
    saddle_detect_rows.append({
        "name": o.name,
        "centerWorldMm": mm(center),
        "distToExpectedSaddleMm": round(d * 1000, 3),
        "selected": hit,
    })
if not saddle_objects:
    raise RuntimeError(
        "안장 메시 검출 실패 — 기대 위치 [%0.1f, %0.1f]mm 반경 %0.1fmm 안에 메시가 없다."
        % (SADDLE_EXPECT_X_M * 1000, SADDLE_EXPECT_Z_M * 1000, SADDLE_DETECT_RADIUS_M * 1000))
saddle_points = []
for o in saddle_objects:
    saddle_points.extend(evaluated_vertices(o))


def nearest_saddle(point, side):
    candidates = [p for p in saddle_points if (p.y > 0 if side == "L" else p.y < 0)]
    return min(candidates, key=lambda p: (p - point).length_squared).copy()


saddle_l = nearest_saddle(ischial_l, "L")
saddle_r = nearest_saddle(ischial_r, "R")
saddle_surface = (saddle_l + saddle_r) / 2
error = contact - saddle_surface

# 반려된 순환 정의는 비교 참고값으로만 보존한다.
weighted_world = [(local, world) for i, local, world in pelvis_records if vertex_weight(i) >= NOMINAL_WEIGHT]
def legacy_circular_nearest(side):
    rider_side = [w for l, w in weighted_world if (l.x > 0 if side == "L" else l.x < 0)]
    saddle_side = [p for p in saddle_points if (p.y > 0 if side == "L" else p.y < 0)]
    return min(
        ((rp - sp).length_squared, rp, sp) for rp in rider_side for sp in saddle_side
    )[1:]


legacy_l, legacy_saddle_l = legacy_circular_nearest("L")
legacy_r, legacy_saddle_r = legacy_circular_nearest("R")
hip_l = eval_head("THIGH_L")
hip_r = eval_head("THIGH_R")
hip_mid = (hip_l + hip_r) / 2


def phase_angles(pkey):
    apply_phase(pkey)
    bpy.context.view_layer.update()
    result = {}
    for side in ("L", "R"):
        hip = eval_head("THIGH_" + side)
        knee = eval_tail("THIGH_" + side)
        ankle = eval_tail("SHIN_" + side)
        shoulder = eval_head("UPPER_ARM_" + side)
        result[side] = {
            "hipMm": mm(hip), "kneeMm": mm(knee), "ankleMm": mm(ankle),
            "kneeIncludedAngleDeg": angle_deg(hip, knee, ankle),
            "kneeFlexionDeg": round(180 - angle_deg(hip, knee, ankle), 3),
            "hipIncludedAngleDegTorsoToThigh": angle_deg(shoulder, hip, knee),
            "hipFlexionFromStraightDeg": round(180 - angle_deg(shoulder, hip, knee), 3),
        }
    return result


angles = {
    "phase0_leftBDC_rightTDC": phase_angles("0.000"),
    "phase180_leftTDC_rightBDC": phase_angles("0.500"),
}
bdc_flexions = [
    angles["phase0_leftBDC_rightTDC"]["L"]["kneeFlexionDeg"],
    angles["phase180_leftTDC_rightBDC"]["R"]["kneeFlexionDeg"],
]
BDC_RANGE = [25.0, 35.0]
bdc_pass = all(BDC_RANGE[0] <= v <= BDC_RANGE[1] for v in bdc_flexions)
gate_reasons = []
if not bdc_pass:
    gate_reasons.append(
        "BDC knee flexion %.3f° is outside %.0f–%.0f°" %
        (bdc_flexions[0], BDC_RANGE[0], BDC_RANGE[1]))
if not sensitivity_stable:
    gate_reasons.append(
        "rider-only ischial sensitivity max shift %.3fmm exceeds %.1fmm" %
        (max_sensitivity_shift, SENSITIVITY_LIMIT_MM))
gate_status = "PASS" if not gate_reasons else "FAIL_UNAPPROVED"
# 렌더는 정적 0° 자세로 되돌린다.
apply_phase("0.000")
bpy.context.view_layer.update()


def make_emission(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = 4.0
    return m


red = make_emission("ISCHIAL_RED", (1.0, 0.03, 0.02))
green = make_emission("SADDLE_GREEN", (0.02, 1.0, 0.1))
yellow = make_emission("HIP_YELLOW", (1.0, 0.7, 0.02))
cyan = make_emission("ERROR_CYAN", (0.02, 0.8, 1.0))
markers = []


def marker(name, pos, mat, radius=0.018):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=pos)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    markers.append(o)
    return o


def line(name, a, b, mat, radius=0.005):
    delta = b - a
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=delta.length, location=mid)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    o.data.materials.append(mat)
    markers.append(o)
    return o


for n, p, m in (
    ("ISCHIAL_L", ischial_l, red), ("ISCHIAL_R", ischial_r, red),
    ("SADDLE_SURFACE_L", saddle_l, green), ("SADDLE_SURFACE_R", saddle_r, green),
    ("HIP_L", hip_l, yellow), ("HIP_R", hip_r, yellow),
):
    marker(n, p, m, radius=0.009)
line("ERROR_L", saddle_l, ischial_l, cyan)
line("ERROR_R", saddle_r, ischial_r, cyan)


_rider_material_state = {}
for slot in rider_mesh.material_slots:
    mat = slot.material
    if not mat or mat in _rider_material_state:
        continue
    bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
    _rider_material_state[mat] = {
        "diffuseAlpha": mat.diffuse_color[3],
        "nodeAlpha": float(bsdf.inputs["Alpha"].default_value) if bsdf else 1.0,
        "surfaceMethod": getattr(mat, "surface_render_method", None),
    }


def set_rider_overlay(enabled):
    for mat, state in _rider_material_state.items():
        alpha = 0.22 if enabled else state["diffuseAlpha"]
        mat.diffuse_color[3] = alpha
        if mat.use_nodes:
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Alpha"].default_value = alpha if enabled else state["nodeAlpha"]
        if state["surfaceMethod"] is not None:
            mat.surface_render_method = "DITHERED" if enabled else state["surfaceMethod"]


def shoot(name, loc, look, overlay):
    for o in markers:
        o.hide_render = not overlay
    set_rider_overlay(overlay)
    cd = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.data.lens = 65
    cam.rotation_euler = (Vector(look) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.use_stamp = True
    sc.render.use_stamp_note = True
    sc.render.use_stamp_date = sc.render.use_stamp_time = False
    sc.render.use_stamp_render_time = sc.render.use_stamp_frame = False
    sc.render.use_stamp_frame_range = sc.render.use_stamp_memory = False
    sc.render.use_stamp_hostname = sc.render.use_stamp_camera = False
    sc.render.use_stamp_lens = sc.render.use_stamp_scene = False
    sc.render.use_stamp_marker = sc.render.use_stamp_filename = False
    sc.render.stamp_note_text = "%s | SCALE 0.88 | %s | %s" % (
        candidate_id, name,
        ("%s | RED RIDER-ONLY ISCHIAL / GREEN SADDLE / YELLOW HIP / CYAN ERROR" % gate_status)
        if overlay else ("%s | BDC FLEX %.3f DEG (REQUIRED 25-35)" % (gate_status, bdc_flexions[0])))
    bpy.context.view_layer.update()
    path_out = os.path.join(out_dir, name + ".png")
    sc.render.filepath = path_out
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    return path_out


look = contact + Vector((0, 0, 0.025))
views = {
    "SADDLE_LEFT_NORMAL": (look + Vector((0.15, -0.62, -0.04)), False),
    "SADDLE_LEFT_MARKED": (look + Vector((0.15, -0.62, -0.04)), True),
    "SADDLE_RIGHT_NORMAL": (look + Vector((0.15, 0.62, -0.04)), False),
    "SADDLE_RIGHT_MARKED": (look + Vector((0.15, 0.62, -0.04)), True),
    "SADDLE_REAR_NORMAL": (look + Vector((-0.62, 0.0, -0.02)), False),
    "SADDLE_REAR_MARKED": (look + Vector((-0.62, 0.0, -0.02)), True),
}
rendered = {name: shoot(name, loc, look, overlay) for name, (loc, overlay) in views.items()}


def png_meta(p):
    raw = open(p, "rb").read()
    return {
        "absolutePath": os.path.abspath(p),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "width": int.from_bytes(raw[16:20], "big"),
        "height": int.from_bytes(raw[20:24], "big"),
    }


manifest_path = os.path.join(out_dir, "render-manifest.json")
mf = json.load(open(manifest_path, encoding="utf-8"))
mf["saddleContactEvidence"] = {
    "inputHash": input_hash,
    "measuredAt": datetime.datetime.now().isoformat(timespec="seconds"),
    "definitions": {
        "HIP_joint": "평가된 THIGH_L/R head의 중점. IK/배치 기준이며 안장 접촉점이 아니다.",
        "SADDLE_CONTACT": "안장을 읽기 전에 rider local 후하방 PELVIS 지지 밴드의 좌우 좌표별 median을 산출하고, 두 rider-only 점의 중점을 사용한다.",
        "saddleSurface": "rider-only SADDLE_CONTACT가 확정된 뒤에만 cycle 안장 평가 정점 중 좌우 최근접점을 구한다.",
        "codeBasis": "blender/rider-cycle-fit/inspect-saddle-geometry.py + apps/web/scripts/rider-cycle-fit/render-saddle-evidence.py",
        "boneBasis": "THIGH_L/R head=HIP joint; GLB에는 SADDLE_CONTACT bone이 존재하지 않음.",
        "independenceContract": {
            "version": 1,
            "riderPointFunction": "rider_only_ischial",
            "riderPointInputs": ["evaluated rider mesh", "PELVIS vertex weights", "rider local coordinates"],
            "forbiddenRiderPointInputs": ["cycle mesh", "saddle vertices", "saddle position", "nearest saddle distance"],
            "saddleReadAfterRiderPointFrozen": True,
            "algorithmId": "pelvis-posteroinferior-robust-median-v1",
            "riderPointSourceSha256": hashlib.sha256(
                inspect.getsource(rider_only_ischial).encode("utf-8")).hexdigest(),
        },
        "meshBasis": {
            "object": rider_mesh.name,
            "vertexGroup": "PELVIS",
            "localAxes": {
                "+X": "rider left/lateral", "-X": "rider right/lateral",
                "+Y": "posterior", "-Y": "anterior", "+Z": "superior/up",
            },
            "selectionFormula": "weight>=W; split by sign(localX); localY>=percentile(P); within posterior set localZ<=percentile(L); coordinate-wise median(localXYZ)",
            "weightThreshold": NOMINAL_WEIGHT,
            "posteriorPercentile": NOMINAL_POSTERIOR_PCT,
            "lowerPercentile": NOMINAL_LOWER_PCT,
            "allWeightedVertexCount": len(all_pelvis_indices),
            "left": {
                "halfCount": nominal["L"]["halfCount"],
                "posteriorCount": nominal["L"]["posteriorCount"],
                "supportCount": nominal["L"]["supportCount"],
                "posteriorCutLocalMm": round(nominal["L"]["posteriorCutLocalMm"], 3),
                "lowerCutLocalMm": round(nominal["L"]["lowerCutLocalMm"], 3),
                "robustPointLocalMm": mm(nominal["L"]["pointLocal"]),
            },
            "right": {
                "halfCount": nominal["R"]["halfCount"],
                "posteriorCount": nominal["R"]["posteriorCount"],
                "supportCount": nominal["R"]["supportCount"],
                "posteriorCutLocalMm": round(nominal["R"]["posteriorCutLocalMm"], 3),
                "lowerCutLocalMm": round(nominal["R"]["lowerCutLocalMm"], 3),
                "robustPointLocalMm": mm(nominal["R"]["pointLocal"]),
            },
            "saddleObjects": [o.name for o in saddle_objects],
            "saddleDetection": {
                "rule": "SSoT geometry.json coords.saddle 파생 기대위치 반경 내 메시만 안장",
                "expectedSaddleWorldMm": [round(SADDLE_EXPECT_X_M * 1000, 3),
                                          round(SADDLE_EXPECT_Z_M * 1000, 3)],
                "radiusMm": round(SADDLE_DETECT_RADIUS_M * 1000, 3),
                "supersedes": "center.x<-0.1 and zMax>0.85 (시트포스트 오검출, 2026-07-31 F2-1)",
                "candidates": saddle_detect_rows,
            },
        },
    },
    "pointsMm": {
        "HIP_L": mm(hip_l), "HIP_R": mm(hip_r), "HIP_MID": mm(hip_mid),
        "ISCHIAL_L": mm(ischial_l), "ISCHIAL_R": mm(ischial_r),
        "SADDLE_CONTACT": mm(contact),
        "SADDLE_SURFACE_L": mm(saddle_l), "SADDLE_SURFACE_R": mm(saddle_r),
        "SADDLE_SURFACE_MID": mm(saddle_surface),
    },
    "legacy": {
        "circularNearest": {
            "status": "REFERENCE_ONLY_REJECTED_CIRCULAR_DEFINITION",
            "mustNotBeUsedAsSaddleContact": True,
            "leftRiderMm": mm(legacy_l),
            "rightRiderMm": mm(legacy_r),
            "leftSaddleMm": mm(legacy_saddle_l),
            "rightSaddleMm": mm(legacy_saddle_r),
        }
    },
    "error": {
        "vectorContactMinusSurfaceMm": mm(error),
        "forwardXmm": round(error.x * 1000, 3),
        "lateralYmm": round(error.y * 1000, 3),
        "verticalZmm": round(error.z * 1000, 3),
        "distance3dMm": dist_mm(contact, saddle_surface),
        "leftDistance3dMm": dist_mm(ischial_l, saddle_l),
        "rightDistance3dMm": dist_mm(ischial_r, saddle_r),
    },
    "sensitivity": {
        "variedParameters": {
            "weightThresholds": [0.15, 0.25, 0.40],
            "lowerPercentiles": [15, 20, 25],
            "posteriorPercentileFixed": NOMINAL_POSTERIOR_PCT,
        },
        "stabilityLimitMm": SENSITIVITY_LIMIT_MM,
        "maxSideShiftFromNominalMm": max_sensitivity_shift,
        "stable": sensitivity_stable,
        "rows": sensitivity_rows,
    },
    "angles": angles,
    "gateDecision": {
        "status": gate_status,
        "approved": False,
        "reasons": gate_reasons,
        "criteria": {
            "bdcKneeFlexionRangeDeg": BDC_RANGE,
            "bdcObservedDeg": bdc_flexions,
            "sensitivityStableRequired": True,
        },
        "note": "계측 전용 후보. 안장/IK를 조정하지 않았으며 제품 반영 금지.",
    },
    "commonAssumptionsUnconfirmed": {
        "hipDropMm": 65.0, "ANKLE_BACK_mm": 149.4, "ANKLE_UP_mm": 81.0,
    },
    "requiredEvidenceImages": list(views.keys()),
    "images": {name: png_meta(p) for name, p in rendered.items()},
}
json.dump(mf, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("@@SADDLE_EVIDENCE@@" + json.dumps(mf["saddleContactEvidence"], ensure_ascii=False))
