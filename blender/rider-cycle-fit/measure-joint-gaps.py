"""관절 틈을 **위상별로 mm 로** 잰다 — 도구가 아니라 사용자가 본 것을 재려는 계측이다.

── 왜 새 계측인가 ───────────────────────────────────────────────────────
`joint-continuity.mjs` 는 0px 을 냈는데 사용자 눈에는 무릎 틈이 보였다. 그 도구는
정면 실루엣 래스터만 본다 — 옆으로 벌어진 틈은 잡지 못한다. 그래서 각도로 훑는다.

── 무엇을 재나 ──────────────────────────────────────────────────────────
**테두리에서 상대 표면까지의 거리**다.

각 관절에는 "원래 살이 끝나고 관절 캡이 시작되는 자리" = 테두리가 양쪽에 하나씩 있다.
자세를 만든 뒤 한쪽 테두리 정점마다 **반대쪽 세그먼트 표면까지의 최단 거리**를 재고,
그 최대값을 그 관절의 **틈**으로 삼는다. 양쪽을 다 재서 큰 쪽을 쓴다.

  · 평면 원판 + 돔이면 굽힘 θ 에서 두 테두리가 `2·R·sin(θ/2)` 만큼 어긋난다 →
    테두리에서 상대 표면까지가 그만큼 멀어진다. 각도가 커질수록 커진다.
  · 피벗 중심 구면이면 상대 표면(채움 구)이 항상 ε 만큼 안쪽에 있다 →
    각도와 무관하게 ε 근처에서 평평하다. **그 평평함이 고쳐졌다는 증거다.**

테두리는 추측하지 않는다 — 구 도구가 리포트에 적어준 것을 읽고, 없으면(낡은 모델)
`cut-planes-local.json` 의 절단면에서 뽑는다. 발목처럼 절단면이 없으면 피벗에 가장
가까운 열린 경계를 쓴다.

── 처음 쓴 계측은 틀렸다 (기록) ─────────────────────────────────────────
처음에는 "피벗을 향해 쏜 광선이 어디에도 안 맞는 방향" 을 틈으로 봤다. 낡은 모델에서
9개 위상 전부 0.0mm 이 나왔다 — 두 세그먼트가 각자 닫혀 있어 관통 터널이 없기
때문이다. 사용자가 본 것은 **뚫린 구멍이 아니라 살이 벌어진 V 노치**였다.
낡은 모델에서 0 이 나오면 계측이 틀린 것이지 모델이 좋은 것이 아니다.

밑창-페달 거리와 밑창 수평 오차도 같은 자세에서 함께 잰다(따로 포즈하면 어긋난다).

실행:
  blender --background --factory-startup --python measure-joint-gaps.py -- \
      <in.glb> <phases.json> <out.json> <label>
"""
import bpy, bmesh, sys, json, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

_A = sys.argv[sys.argv.index("--") + 1:]
GLB, PHASES, OUT, LABEL = _A[:4]
RIMS_JSON = _A[4] if len(_A) > 4 else ""          # 구 도구 리포트(있으면 테두리를 여기서 읽는다)
PLANES_JSON = _A[5] if len(_A) > 5 else ""        # 없으면 절단면에서 뽑는다

LAT, LON = 40, 80            # 구면 격자 3,200 방향. 각 분해능 4.5°.
BAND_DEG = 55.0              # 두 세그먼트 축에서 이만큼 떨어진 방향만 "관절 띠" 로 본다
CHILD_OF = {"leg_l": "leg_l_shin", "leg_r": "leg_r_shin", "arm_l": "arm_l_fore", "arm_r": "arm_r_fore"}
JOINTS = [
    ("knee_l", "leg_l", "leg_l_shin"), ("knee_r", "leg_r", "leg_r_shin"),
    ("elbow_l", "arm_l", "arm_l_fore"), ("elbow_r", "arm_r", "arm_r_fore"),
    ("shoulder_l", "torso", "arm_l"), ("shoulder_r", "torso", "arm_r"),
    ("hip_l", "torso", "leg_l"), ("hip_r", "torso", "leg_r"),
    ("ankle_l", "leg_l_shin", "ankle_l"), ("ankle_r", "leg_r_shin", "ankle_r"),
]

G2B = lambda p: Vector((p[0], -p[2], p[1]))     # glTF y-up → Blender z-up
DOWN = Vector((0.0, 0.0, -1.0))                 # rest = glTF −Y = Blender −Z

phases = json.load(open(PHASES, encoding="utf-8"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

# ── 테두리 수집 (rest 자세에서 로컬 좌표로 한 번만) ──────────────────────
RIMS = {}          # {joint: {node: [Vector local, ...]}}
_ball = json.load(open(RIMS_JSON, encoding="utf-8")) if RIMS_JSON else {}
_planes = json.load(open(PLANES_JSON, encoding="utf-8"))["planes"] if PLANES_JSON else {}
rim_src = {}

for j, per in (_ball.get("rims") or {}).items():
    RIMS[j] = {n: [Vector(v) for v in pts] for n, pts in per.items()}
    rim_src[j] = "구 도구가 기록한 테두리"


def open_loops_local(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # ⚠ glTF 익스포터가 노멀 심에서 정점을 쪼갠다 — 용접 없이는 전부 열린 경계로 보인다
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.edges.ensure_lookup_table()
    open_edges = [e for e in bm.edges if len(e.link_faces) == 1]
    adj = {}
    for e in open_edges:
        for v in e.verts:
            adj.setdefault(v, []).append(e)
    seen, loops = set(), []
    for e0 in open_edges:
        if e0 in seen:
            continue
        vs, stack = set(), [e0]
        while stack:
            e = stack.pop()
            if e in seen:
                continue
            seen.add(e)
            vs.update(e.verts)
            for v in e.verts:
                for e2 in adj.get(v, ()):
                    if e2 not in seen:
                        stack.append(e2)
        loops.append([v.co.copy() for v in vs])
    bm.free()
    return loops


for jname, par, ch in JOINTS:
    if jname in RIMS:
        continue
    got = {}
    if jname in _planes:
        # 낡은 모델 — 절단면 위(수직 3mm 이내)이고 옆으로도 절단 반경 1.5배 안인 정점
        pl = _planes[jname]
        for node, spec in pl["nodes"].items():
            if node not in bpy.data.objects:
                continue
            c0, n0 = Vector(spec["centerLocalBlender"]), Vector(spec["normalLocalBlender"]).normalized()
            me = bpy.data.objects[node].data
            pts = []
            for v in me.vertices:
                d = v.co - c0
                perp = abs(d.dot(n0))
                lat = (d - n0 * d.dot(n0)).length
                if perp <= 0.003 and lat <= pl["radiusM"] * 1.5:
                    pts.append(v.co.copy())
            if pts:
                got[node] = pts
        if got:
            rim_src[jname] = "절단면에서 뽑은 테두리(평면 3mm 이내)"
    if not got:
        # 절단면이 없는 관절(발목) — 피벗에 가장 가까운 열린 경계
        P_ch = Vector((0, 0, 0))
        for node, P in ((ch, P_ch), (par, None)):
            ob = bpy.data.objects[node]
            Pl = P if P is not None else (ob.matrix_world.inverted()
                                          @ bpy.data.objects[ch].matrix_world.translation)
            best, bd = None, 1e9
            for loop in open_loops_local(ob):
                c = sum(loop, Vector()) / len(loop)
                if (c - Pl).length < bd:
                    bd, best = (c - Pl).length, loop
            if best is not None and bd < 0.15:
                got[node] = best
        rim_src[jname] = "절단면이 없다 — 피벗에 가장 가까운 열린 경계"
    RIMS[jname] = got


def world_bvh(names):
    """여러 노드의 메시를 **월드 좌표**로 합쳐 BVH 를 만든다."""
    bm = bmesh.new()
    for n in names:
        ob = bpy.data.objects[n]
        tmp = bmesh.new()
        tmp.from_mesh(ob.data)
        tmp.transform(ob.matrix_world)
        vmap = [bm.verts.new(v.co) for v in tmp.verts]
        bm.verts.ensure_lookup_table()
        for f in tmp.faces:
            try:
                bm.faces.new([vmap[v.index] for v in f.verts])
            except ValueError:
                pass
        tmp.free()
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree


DIRS = []
for _i in range(LAT):
    _th = math.pi * (_i + 0.5) / LAT
    for _j in range(LON):
        _ph = 2 * math.pi * _j / LON
        DIRS.append(Vector((math.sin(_th) * math.cos(_ph), math.sin(_th) * math.sin(_ph), math.cos(_th))))


def measure_dent(parent, child):
    """**바깥 살이 얼마나 패였나** — 주 지표. 테두리 기준과 달리 구조적으로 0 이 되지 않는다.

    피벗 P 둘레의 각 방향 d 마다 바깥에서 P 로 광선을 쏴 **바깥 살 반경** r(d) 를 얻는다.
    두 세그먼트 축에서 55° 이상 떨어진 방향("관절 띠")만 본다 — 팔다리를 따라 내려가는
    방향은 원래 멀어서 섞으면 안 된다.

        dent = median(r) − min(r)

    돔 캡이면 굽힘 바깥쪽에서 살이 돔 높이(0.45R)까지 물러나므로 크게 나온다.
    피벗 중심 구면이면 어느 방향이든 r ≈ R 이라 작게 나온다. 기준값을 밖에서
    가져오지 않고 자기 중앙값과 비교하므로 자기 보정이다.
    """
    P = bpy.data.objects[child].matrix_world.translation.copy()
    tree = world_bvh([parent, child])
    ax = []
    for n in (parent, child):
        ob = bpy.data.objects[n]
        me = ob.data
        c = ob.matrix_world @ (sum((v.co for v in me.vertices), Vector()) / len(me.vertices))
        u = c - P
        if u.length > 1e-6:
            ax.append(u.normalized())
    probe = []
    for k in range(0, len(DIRS), 17):
        h = tree.ray_cast(P + DIRS[k] * 0.6, -DIRS[k], 0.6)
        if h[0] is not None:
            probe.append((h[0] - P).length)
    R0 = sorted(probe)[len(probe) // 2] if probe else 0.08
    start = max(R0 * 3.0, 0.15)
    rs = []
    cosb = math.cos(math.radians(BAND_DEG))
    for d in DIRS:
        if any(abs(d.dot(a)) > cosb for a in ax):
            continue
        h = tree.ray_cast(P + d * start, -d, start)
        rs.append((h[0] - P).length if h[0] is not None else 0.0)
    if len(rs) < 20:
        return {"error": "관절 띠 방향이 너무 적다"}
    rs.sort()
    med = rs[len(rs) // 2]
    return {"bandDirs": len(rs), "medianMm": round(med * 1000, 2),
            "minMm": round(rs[0] * 1000, 2), "p5Mm": round(rs[len(rs) // 20] * 1000, 2),
            "dentMm": round((med - rs[0]) * 1000, 2),
            "dentP5Mm": round((med - rs[len(rs) // 20]) * 1000, 2)}


def measure_joint(jname, parent, child):
    """테두리 → 상대 표면 최단거리의 **최대값**. 보조 지표(두 빌드 간 테두리 위치가 달라 직접 비교는 못 한다)."""
    rims = RIMS.get(jname) or {}
    if not rims:
        return {"error": "테두리를 못 찾았다"}
    P = bpy.data.objects[child].matrix_world.translation.copy()
    trees = {n: world_bvh([n]) for n in (parent, child)}
    out = {"rimSource": rim_src.get(jname), "sides": {}}
    worst, worst_side = 0.0, None
    for node, pts in rims.items():
        other = child if node == parent else parent
        if other not in trees:
            continue
        mw = bpy.data.objects[node].matrix_world
        ds = []
        for lp in pts:
            w = mw @ lp
            loc, nor, idx, dist = trees[other].find_nearest(w)
            ds.append(dist if dist is not None else 0.0)
        if not ds:
            continue
        out["sides"][node] = {"rimVerts": len(ds),
                              "maxToOtherMm": round(max(ds) * 1000, 2),
                              "meanToOtherMm": round(sum(ds) / len(ds) * 1000, 2)}
        if max(ds) > worst:
            worst, worst_side = max(ds), node
    rr = [(mw_pt - P).length for node, pts in rims.items()
          for mw_pt in [bpy.data.objects[node].matrix_world @ lp for lp in pts]]
    out["gapMm"] = round(worst * 1000, 2)
    out["worstSide"] = worst_side
    out["rimRadiusMeanMm"] = round(sum(rr) / len(rr) * 1000, 2) if rr else None
    return out


def pose(entry):
    """p9-render-posed.py 와 같은 방식 — 월드 방향 벡터로 회전을 만든다(Euler 규약 재현 없음)."""
    seg = entry["segments"]
    ck = bpy.data.objects["crank"]; ck.rotation_mode = "XYZ"
    ck.rotation_euler = (0.0, math.radians(-(90.0 + entry["crankRotationDeg"])), 0.0)
    ts = bpy.data.objects["torso"]; ts.rotation_mode = "XYZ"
    ts.rotation_euler = (0.0, math.radians(-entry["torsoRotationDeg"][2]), 0.0)
    bpy.context.view_layer.update()
    for root, child in CHILD_OF.items():
        d = G2B(seg[root]["dirWorld"]).normalized()
        ob = bpy.data.objects[root]; ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = DOWN.rotation_difference(d)
        bpy.context.view_layer.update()
        cd = G2B(seg[root]["childDirWorld"]).normalized()
        pw = ob.matrix_world.to_quaternion()
        co = bpy.data.objects[child]; co.rotation_mode = "QUATERNION"
        co.rotation_quaternion = DOWN.rotation_difference(pw.inverted() @ cd)
        bpy.context.view_layer.update()
    for n in ("ankle_l", "ankle_r", "pedal_l", "pedal_r"):
        ob = bpy.data.objects[n]; ob.rotation_mode = "QUATERNION"
        ob.rotation_quaternion = ob.parent.matrix_world.to_quaternion().inverted()
    bpy.context.view_layer.update()


def measure_sole(side):
    """밑창-페달 상면 거리와 밑창 수평 오차.

    밑창 정의는 align-ankle-mesh.py 와 **같아야 한다**(다르면 두 도구 수치를 못 겹친다):
    아래보기 면 중 면적 합이 최대가 되는 8mm 두께 슬래브. 월드 좌표로 잡는다.
    """
    ao, po = bpy.data.objects[f"ankle_{side}"], bpy.data.objects[f"pedal_{side}"]
    amw, pmw = ao.matrix_world, po.matrix_world
    R3 = amw.to_3x3()
    down = []
    for f in ao.data.polygons:
        n = (R3 @ f.normal).normalized()
        if n.z < -0.5 and f.area > 1e-8:
            down.append(((amw @ f.center), n, f.area, f))
    if not down:
        return {"gapMm": None, "tiltDeg": None, "note": "아래를 향하는 면이 없다"}
    zmin = min(c.z for c, _, _, _ in down)
    zmax = max(c.z for c, _, _, _ in down)
    best, bz, z = -1.0, zmin, zmin
    while z <= min(zmax, zmin + 0.12):
        a = sum(w for c, _, w, _ in down if z <= c.z <= z + 0.008)
        if a > best:
            best, bz = a, z
        z += 0.001
    band = [(c, n, w, f) for c, n, w, f in down if bz <= c.z <= bz + 0.008]
    A = sum(w for _, _, w, _ in band)
    # 접촉면 = 밴드 면들의 **정점** 높이 하위 2% (align-ankle-mesh.py 와 같은 정의)
    zs = sorted((amw @ ao.data.vertices[i].co).z for _, _, _, f in band for i in f.vertices)
    sole_z = zs[max(0, int(len(zs) * 0.02))]
    slab_c = sum(c.z * w for c, _, w, _ in band) / A
    nrm = sum((n * w for _, n, w, _ in band), Vector()).normalized()
    tilt = math.degrees(math.acos(max(-1.0, min(1.0, -nrm.z))))
    # 페달 상면 = 위를 향하는 면 중 면적 최대 4mm 슬래브(정점 최대 z 는 판의 턱을 집는다).
    #   align-ankle-mesh.py 의 pedal_top 과 같은 정의여야 한다.
    R3p = pmw.to_3x3()
    up = [((pmw @ f.center).z, f.area) for f in po.data.polygons
          if (R3p @ f.normal).normalized().z > 0.5 and f.area > 1e-8]
    if up:
        zl = min(z for z, _ in up); zh = max(z for z, _ in up)
        bb, bzp, zz = -1.0, zl, zl
        while zz <= zh:
            aa = sum(w for z, w in up if zz <= z <= zz + 0.004)
            if aa > bb:
                bb, bzp = aa, zz
            zz += 0.0005
        bnd = [(z, w) for z, w in up if bzp <= z <= bzp + 0.004]
        ptop = sum(z * w for z, w in bnd) / sum(w for _, w in bnd)
    else:
        ptop = max((pmw @ v.co).z for v in po.data.vertices)
    # ── 접촉 판정 — **페달 판 발자국 안**의 신발 최저점 ──────────────────
    # 두 번 틀렸다. (1) 밑창의 면적 최대 슬래브 → 실제 접지면보다 12mm 높다.
    # (2) 신발 전체의 최저 정점 → 판 밖의 엉뚱한 돌기를 집는다(신발이 여러 조각이라
    #     밑면이 매끈하지 않다). 페달이 닿을 수 있는 것은 **판 위에 있는 부분뿐**이다.
    pv = [pmw @ v.co for v in po.data.vertices]
    px0, px1 = min(v.x for v in pv), max(v.x for v in pv)
    py0, py1 = min(v.y for v in pv), max(v.y for v in pv)
    av = [amw @ v.co for v in ao.data.vertices]
    over = [v for v in av if px0 <= v.x <= px1 and py0 <= v.y <= py1]
    cleat_z = min((v.z for v in over), default=None)
    # 접촉면 기울기 — 그 발자국 안, 최저에서 3mm 이내의 아래보기 면
    ctilt, cfaces, carea = None, 0, 0.0
    if cleat_z is not None:
        acc = Vector()
        for f in ao.data.polygons:
            c = amw @ f.center
            if not (px0 <= c.x <= px1 and py0 <= c.y <= py1):
                continue
            n = (R3 @ f.normal).normalized()
            if n.z >= -0.5 or f.area <= 1e-8:
                continue
            if min((amw @ ao.data.vertices[i].co).z for i in f.vertices) <= cleat_z + 0.003:
                acc = acc + n * f.area; cfaces += 1; carea += f.area
        if cfaces:
            nn = acc.normalized()
            ctilt = round(math.degrees(math.acos(max(-1.0, min(1.0, -nn.z)))), 2)
    return {"cleatZ": None if cleat_z is None else round(cleat_z, 5),
            "cleatGapMm": None if cleat_z is None else round((cleat_z - ptop) * 1000, 2),
            "contactTiltDeg": ctilt, "contactFaces": cfaces,
            "contactAreaCm2": round(carea * 1e4, 2),
            "pedalFootprintMm": [round((px1 - px0) * 1000, 1), round((py1 - py0) * 1000, 1)],
            "soleContactZ": round(sole_z, 5), "soleSlabCenterZ": round(slab_c, 5),
            "pedalTopZ": round(ptop, 5),
            "gapMm": round((sole_z - ptop) * 1000, 2),
            "gapSlabCenterMm": round((slab_c - ptop) * 1000, 2),
            "tiltDeg": round(tilt, 2), "bandFaces": len(band)}


out = {"label": LABEL, "glb": GLB, "grid": [LAT, LON],
       "primaryMetric": "dentMm = 관절 띠 방향에서 바깥 살 반경의 median − min. 살이 얼마나 패였나.",
       "secondaryMetric": "gapMm = 한쪽 테두리에서 반대쪽 표면까지 최단거리의 최대값. 빌드마다 테두리 위치가 달라 **두 빌드 사이 직접 비교는 하지 않는다**.",
       "phases": []}
for entry in phases["phases"]:
    pose(entry)
    row = {"deg": entry["deg"],
           "kneeDeg": {"l": round(entry["segments"]["leg_l"]["jointDeg"], 1),
                       "r": round(entry["segments"]["leg_r"]["jointDeg"], 1)},
           "elbowDeg": {"l": round(entry["segments"]["arm_l"]["jointDeg"], 1),
                        "r": round(entry["segments"]["arm_r"]["jointDeg"], 1)},
           "joints": {}, "sole": {}}
    for jname, par, ch in JOINTS:
        m = measure_joint(jname, par, ch)
        m["dent"] = measure_dent(par, ch)
        row["joints"][jname] = m
    for s in ("l", "r"):
        row["sole"][s] = measure_sole(s)
    out["phases"].append(row)
    g = {k: v.get("dent", {}).get("dentMm") for k, v in row["joints"].items()}
    print(f"  {entry['deg']:>3}° gap(mm) " + " ".join(f"{k}={v}" for k, v in g.items())
          + f" | sole L={row['sole']['l']['gapMm']} R={row['sole']['r']['gapMm']}")

json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("MEASURE_COMPLETE", LABEL)
