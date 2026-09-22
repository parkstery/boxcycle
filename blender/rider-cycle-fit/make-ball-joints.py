"""관절을 **피벗 중심 구**로 만든다 (단계 B 재작업 · 사용자 반려 대응).

── 왜 돔 캡이 틀렸나 ─────────────────────────────────────────────────────
`add-joint-caps-material.py` 는 절단 루프 **위에** 타원체 돔을 얹었다. 돔의 중심은
루프면이지 **회전축이 아니다**. 그래서 자식이 θ 만큼 돌면 두 뚜껑이 벌어진다 —
그 폭이 `2·R·sin(θ/2)` 다. 무릎 R=70mm·굽힘 106.7°(180° 위상)에서 약 112mm.
돔 높이를 바꿔도 줄지 않았던 이유가 이것이다. 높이는 벌어짐의 원인이 아니었다.

── 왜 구가 답인가 ───────────────────────────────────────────────────────
**구의 중심이 곧 회전축이면, 아무리 돌려도 구는 제자리에 있다.** 회전 불변이므로
틈이 기하학적으로 생길 수 없다.

이 리그에서는 **모든 관절의 자식 노드 로컬 원점이 곧 그 관절의 피벗**이다(검증:
`cut-planes-local.json` 의 자식쪽 centerLocalBlender 가 knee/elbow/hip 에서 (0,0,0)).
어깨만 예외다 — 뒤에 따로 적는다.

── 왜 기존 링에 뚜껑을 씌우면 안 되나 (2차 반려의 진짜 원인) ─────────────
절단면은 두 세그먼트 축의 **이등분면**이다. 조각 자세에서 오른무릎은 107° 굽어
있어 이등분면이 대퇴축과 52° 로 만난다. 원기둥을 52° 로 자르면 단면은 **타원**이다
— 실측 73×104mm. 타원은 어떤 구 위에도 놓이지 않는다. 그 링에 구면 뚜껑을 씌우면
뚜껑만 구면이고 링은 아니어서 회전 불변이 깨진다.

그래서 링을 쓰지 않는다. **구로 다시 자른다**:
  1. 피벗에서 반경 R 안쪽 정점을 지운다(면만 지우면 안쪽 정점이 남아 경계를 망친다)
  2. 그래서 생긴 경계를 **옮기지 않고**, 스커트 한 줄로 구면 위의 정확한 고리에 잇는다
  3. 그 고리에서 구면을 따라 먼 극까지 덮는다
결과적으로 세그먼트의 근위 끝이 **구의 일부가 된다**(뚜껑을 얹은 게 아니다).

경계를 구면으로 끌어당기는 쪽을 먼저 해봤는데, 원형과 거리가 먼 경계(고관절·어깨)
에서 한 점이 최대 100mm 까지 끌려와 살이 패였다. 스커트는 원래 살을 그대로 둔다.

── 세 반경 — 겹침과 z-파이팅 ────────────────────────────────────────────
  부모 = R           (가장 바깥. 소켓 역할)
  자식 = R − δ       (그 안. 겹쳐도 부모가 이긴다 — z-파이팅 없음)
  채움 = R − 2δ      (닫힌 구 껍질 하나. 자식에 붙인다)

채움 구가 핵심 보증이다. 캡 두 장만으로는 θ 만큼 돌 때 구면에 **초승달 빈 구역**이
남는다(서로 반대쪽 반구를 덮기 때문). 완전한 구는 회전과 무관하게 전 방향을 덮으므로
어떤 각도에서도 뚫려 보이지 않는다. 중심이 피벗이라 자식에 붙여도 제자리다.

── 반경 R 을 어떻게 정했나 ──────────────────────────────────────────────
R = sqrt(절단링 반경² + 절단면이 피벗에서 떨어진 거리²)
  = **피벗에서 절단 링 테두리까지의 거리**. 그 자리의 팔다리 굵기다.
knee/elbow 는 절단면이 피벗을 지나므로 링 반경 그대로다. 고관절은 SKIP_BALL 참고.

── 어깨만 다르다 ────────────────────────────────────────────────────────
어깨 절단면은 피벗을 지나지 않는다 — arm_l 로컬 z = −44.3mm(Guide 심 중심을 지나게
잡았기 때문). 링 테두리는 피벗에서 sqrt(44.3² + 56.9²) = 72.1mm 다. 사용자가 본
"상완의 링" 이 이 어긋남이다. 구로 바꾸면 삼각근이 구에 흡수되어 링이 사라진다 —
대신 어깨가 조금 둥글어진다. 그건 형상이고, 단차가 지는 것과는 다르다.

제품 GLB·앱 코드는 건드리지 않는다. Blender 는 저장하지 않는다.

실행:
  blender --background --factory-startup --python make-ball-joints.py -- \
      <in.glb> <out.glb> <cut-planes-local.json> <report.json>
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, PLANES, REPORT = _A[:4]
NO_FILL = len(_A) > 4 and _A[4] == "--no-fill"   # 진단용 — 채움 구를 빼고 굽는다

# 자식/부모/채움 구의 반경 차(m). **다면체 근사 오차보다 커야 한다** —
# 0.75mm 로 뒀더니 바깥 캡의 면이 안쪽 구의 정점보다 0.63mm 밖에 안 떴고,
# 세 껍질이 서로 뚫고 나와 렌더에 검은 삼각형 얼룩이 깔렸다(180° 무릎 실측).
# 반경 70mm·경도 42 분할이면 면의 처짐이 R×0.9% ≈ 0.63mm 다. 그 2배 이상으로 잡는다.
DELTA = 0.002
LAT_DEG = 20.0        # 구면 캡 위도 한 칸(도). 삼각형 수와 매끄러움의 절충.
FILL_SEG, FILL_RING = 24, 12    # 채움 구 해상도 → 576 삼각형, 실루엣 요철 R×0.9%
MAX_DELETE_FRAC = 0.45          # 이보다 많이 지우면 R 이 틀린 것이다 — 중단하고 보고

# ── 구로 만들지 **않는** 관절 ────────────────────────────────────────────
# 고관절: 절단면이 대퇴 최상단 단면이라 원형과 거리가 멀다(피벗까지 92mm~192mm).
#   여기에 구를 맞추면 반경을 어떻게 잡아도 살이 크게 패이거나 대퇴를 삼킨다.
#   그리고 이 이음매는 통째로 반바지·골반 안에 묻혀 있다 — 사용자가 지적한 곳도 아니다.
#   그래서 기존처럼 평면으로 막고, **틈은 따로 계측해서 보고한다**(가정하지 않는다).
# (1차 시도에서는 고관절을 제외하고 평면 팬으로 막았다. 그랬더니 dent 가 돔보다
#  오히려 나빠졌다 — 30→63mm. 스커트 방식이 비원형 테두리를 감당하므로 고관절도 구로 넣는다.)
SKIP_BALL = {}

# ── 어깨는 구로 만들지 않는다 — **안쪽으로 파묻는다** ──────────────────────
# 무릎·팔꿈치는 사지 양쪽이 다 드러나 있고 위상마다 굽는 각이 달라지므로 구가 맞다.
# 어깨는 사정이 다르다:
#   · 팔은 **위상과 무관하게 고정**이다(pose.mjs "Static Fit: 팔은 위상 무관").
#     회전하지 않으면 두 뚜껑이 벌어질 일이 없다 — 구가 필요 없다.
#   · 절단면 위쪽(삼각근)은 이미 torso 에 있다. 몸통을 구로 다시 파내면 그 삼각근이
#     통째로 사라지고 최대 37.7mm 짜리 스커트가 분화구 테두리로 남는다.
#     사용자가 네 라운드째 지적한 "검은 지그재그" 가 그 테두리다(실측 확인).
# 그래서 어깨는 **자르지 않고**, 양쪽 절단 링을 각각 **상대 세그먼트 쪽(안쪽)** 으로
# 부푸는 돔으로 막는다. 두 돔 모두 상대 살 속에 묻히므로 보이는 것은 원래 실루엣
# 하나뿐이다. 자르기 전 두 면은 같은 메시였으니 실루엣은 정확히 이어진다.
#
# 대가: 삼각근이 몸통에 남으므로 **팔이 돌아도 어깨 근육은 따라 돌지 않는다.**
#       제품 GLB 도 같은 방식이고 같은 대가를 치른다.
# ⚠ **시도했다가 되돌렸다.** "팔은 위상 무관" 은 맞지만 그것이 "팔이 안 돈다" 는 뜻이
#   아니다. 팔은 rest(−Y, 아래로 늘어뜨린 자세)에서 **약 90° 돌아가** 핸들을 잡는다.
#   어깨 링은 피벗에서 72.1mm 떨어져 있으므로 그 회전에 2·72.1·sin(45°) ≈ 102mm 움직인다.
#   안쪽 돔(높이 27.3mm)으로는 어림도 없고, 실제로 렌더에서 팔이 몸통에서 **완전히 떨어졌다**.
#   어깨도 피벗 중심 구가 필요하다 — 자유도가 3 이라 더더욱 그렇다.
BURY = {}
BURY_HEIGHT_RATIO = 0.5    # 안쪽 돔 높이 = 링 평균반경 × 이 값. 상대 살 안에 묻힐 만큼만.

planes = json.load(open(PLANES, encoding="utf-8"))["planes"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)

report = {
    "tool": "blender/rider-cycle-fit/make-ball-joints.py",
    "principle": "구의 중심 = 회전 피벗 → 회전 불변 → 틈이 기하학적으로 불가능",
    "method": "평면 절단 링을 버리고 **구로 재절단**한다. 세그먼트의 근위 끝이 구의 일부가 된다.",
    "deltaM": DELTA, "latDeg": LAT_DEG,
    "joints": {}, "perNode": {}, "totalAddedTriangles": 0, "totalDeletedTriangles": 0,
    "aborted": [], "openLoopsNearJoint": [],
}


def boundary_loops(bm):
    open_edges = [e for e in bm.edges if len(e.link_faces) == 1]
    if not open_edges:
        return []
    adj = {}
    for e in open_edges:
        for v in e.verts:
            adj.setdefault(v, []).append(e)
    seen, loops = set(), []
    for e0 in open_edges:
        if e0 in seen:
            continue
        loop, stack = [], [e0]
        while stack:
            e = stack.pop()
            if e in seen:
                continue
            seen.add(e)
            loop.append(e)
            for v in e.verts:
                for e2 in adj.get(v, ()):
                    if e2 not in seen:
                        stack.append(e2)
        loops.append(loop)
    return loops


def ordered_cycle(loop_edges):
    adj = {}
    for e in loop_edges:
        a, b = e.verts
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    if any(len(v) != 2 for v in adj.values()):
        return None
    start = next(iter(adj))
    cyc, prev, cur = [start], None, start
    while True:
        nxt = adj[cur][0] if adj[cur][0] is not prev else adj[cur][1]
        if nxt is start:
            break
        cyc.append(nxt)
        prev, cur = cur, nxt
        if len(cyc) > len(adj):
            return None
    return cyc if len(cyc) == len(adj) else None


def slerp(a, b, t):
    d = max(-1.0, min(1.0, a.dot(b)))
    if d > 0.999999:
        return b.copy()
    if d < -0.999999:
        ax = Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 1, 0))
        ax = a.cross(ax).normalized()
        ang = math.pi * t
        return (a * math.cos(ang) + ax * math.sin(ang)).normalized()
    om = math.acos(d)
    so = math.sin(om)
    return (a * (math.sin((1 - t) * om) / so) + b * (math.sin(t * om) / so)).normalized()


def build_sphere_cap(bm, cyc, pivot, pole_dir, R):
    """구면 위의 경계 고리에서 출발해 **같은 구면**을 따라 먼 극까지 덮는다."""
    dirs = [(v.co - pivot).normalized() for v in cyc]
    a = pole_dir.normalized()
    ang = max(math.acos(max(-1.0, min(1.0, d.dot(a)))) for d in dirs)
    K = max(2, int(math.ceil(math.degrees(ang) / LAT_DEG)))
    rings = [cyc]
    for k in range(1, K):
        t = k / K
        rings.append([bm.verts.new(pivot + slerp(dirs[i], a, t) * R) for i in range(len(cyc))])
    apex = bm.verts.new(pivot + a * R)
    bm.verts.ensure_lookup_table()
    faces, m, failed = [], len(cyc), 0
    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for i in range(m):
            j = (i + 1) % m
            try:
                faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
            except ValueError:
                failed += 1          # ⚠ 조용히 삼키면 캡에 구멍이 남는다 — 반드시 센다
    top = rings[-1]
    for i in range(m):
        j = (i + 1) % m
        try:
            faces.append(bm.faces.new((top[i], top[j], apex)))
        except ValueError:
            failed += 1
    return faces, math.degrees(ang), K, failed


def build_inward_dome(bm, cyc, inward):
    """링을 **상대 세그먼트 쪽**으로 부푸는 돔으로 막는다. 상대 살 속에 묻혀 안 보인다.

    기존 캡 도구는 이걸 **바깥**(몸통 반대쪽)으로 부풀렸다 — 그래서 어깨에 링이 섰다.
    방향만 뒤집는 것이 아니라, 안쪽으로 가면 상대 세그먼트의 살이 항상 더 넓으므로
    어떤 높이를 줘도 묻힌다(절단면 위아래가 원래 한 덩어리였기 때문이다).
    """
    C = sum((v.co for v in cyc), Vector()) / len(cyc)
    r = sum((v.co - C).length for v in cyc) / len(cyc)
    h = r * BURY_HEIGHT_RATIO
    n = inward.normalized()
    LAT = 3
    rings = [cyc]
    for k in range(1, LAT + 1):
        phi = (k / (LAT + 1)) * (math.pi / 2)
        cs, sn = math.cos(phi), math.sin(phi)
        rings.append([bm.verts.new(C + n * (h * sn) + (v.co - C) * cs) for v in cyc])
    apex = bm.verts.new(C + n * h)
    bm.verts.ensure_lookup_table()
    faces, m = [], len(cyc)
    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for i in range(m):
            j = (i + 1) % m
            try:
                faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
            except ValueError:
                pass
    top = rings[-1]
    for i in range(m):
        j = (i + 1) % m
        try:
            faces.append(bm.faces.new((top[i], top[j], apex)))
        except ValueError:
            pass
    return faces, r, h


def build_fill_sphere(bm, center, R):
    """반경 R 짜리 **닫힌 구 껍질**. 캡 두 장이 못 덮는 초승달 구역을 메운다."""
    rows = []
    for r in range(1, FILL_RING):
        phi = math.pi * r / FILL_RING
        z, rad = math.cos(phi) * R, math.sin(phi) * R
        rows.append([bm.verts.new(center + Vector((rad * math.cos(2 * math.pi * s / FILL_SEG),
                                                   rad * math.sin(2 * math.pi * s / FILL_SEG), z)))
                     for s in range(FILL_SEG)])
    top = bm.verts.new(center + Vector((0, 0, R)))
    bot = bm.verts.new(center + Vector((0, 0, -R)))
    bm.verts.ensure_lookup_table()
    faces = []
    for s in range(FILL_SEG):
        t = (s + 1) % FILL_SEG
        faces.append(bm.faces.new((top, rows[0][s], rows[0][t])))
        faces.append(bm.faces.new((bot, rows[-1][t], rows[-1][s])))
    for r in range(len(rows) - 1):
        lo, hi = rows[r], rows[r + 1]
        for s in range(FILL_SEG):
            t = (s + 1) % FILL_SEG
            faces.append(bm.faces.new((lo[s], lo[t], hi[t], hi[s])))
    return faces


def simple_cycle_after_delete(ob, bm, P, R, pname, role):
    """**사본**에서 지워 보고 경계가 단순 고리로 남는지만 확인한다(되돌릴 수 없으므로)."""
    t = bm.copy()
    t.verts.ensure_lookup_table()
    ins = [v for v in t.verts if (v.co - P).length < R]
    if ins:
        bmesh.ops.delete(t, geom=ins, context="VERTS")
        t.verts.ensure_lookup_table(); t.edges.ensure_lookup_table()
    best, bd = None, 1e9
    for loop in boundary_loops(t):
        vs = {v for e in loop for v in e.verts}
        c = sum((v.co for v in vs), Vector()) / len(vs)
        if (c - P).length < R * 2.0 and (c - P).length < bd:
            bd, best = (c - P).length, loop
    ok = best is not None and ordered_cycle(best) is not None
    t.free()
    return ok


# ── 관절 정의 — 자식은 "절단면이 자기 원점에 가장 가까운 노드" ─────────────
#    계층이 평면 구조(RiderBike 아래 형제들)라 부모-자식 링크로는 판정할 수 없다.
JOINTS = {}
for pname, pl in planes.items():
    ns = [n for n in pl["nodes"] if n in bpy.data.objects]
    if not ns:
        continue
    child = min(ns, key=lambda n: Vector(pl["nodes"][n]["centerLocalBlender"]).length)
    other = [n for n in ns if n != child]
    offset = Vector(pl["nodes"][child]["centerLocalBlender"]).length
    R = math.sqrt(pl["radiusM"] ** 2 + offset ** 2)
    JOINTS[pname] = {"child": child, "parent": other[0] if other else None,
                     "R": R, "planeRadiusM": pl["radiusM"], "pivotOffsetM": offset}

# ── 발목은 이 도구로 닫지 않는다 (시도했다가 되돌렸다) ────────────────────
# 발목에는 절단면이 없다. 정강이 원위부와 신발 주변에 **원래부터 열린 경계가 여러 겹**
# 있다 — 신발 입구(피벗에서 57mm)·양말 윗단(66mm)·정강이 끝. 어느 것을 테두리로
# 잡아도 나머지가 남아 스커트가 100mm 까지 벌어지고 폐합이 깨졌다(실측).
# 이 이음매는 신발이 정강이를 덮는 **겹침 구조**이지 절단면이 아니다. 다른 방식이
# 필요하므로 여기서는 손대지 않고, 발목 dent 는 계측으로 보고한다.

# 노드별 작업 목록 — 한 노드가 여러 관절에 관여한다(예: leg_l 은 hip 자식이자 knee 부모)
jobs = {}
for pname, J in JOINTS.items():
    jobs.setdefault(J["child"], []).append((pname, "child"))
    if J["parent"]:
        jobs.setdefault(J["parent"], []).append((pname, "parent"))

added_total = deleted_total = 0
for node, node_jobs in jobs.items():
    ob = bpy.data.objects[node]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # ⚠ glTF 익스포터가 노멀 심에서 정점을 쪼갠다 — 용접하지 않으면 거의 모든 엣지가
    #   '열린 경계' 로 보인다(캡 도구에서 가짜 루프 6,351개 사례).
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    made, note = {}, {}
    for pname, role in node_jobs:
        J = JOINTS[pname]
        if pname in BURY:
            # ── 어깨 — 자르지 않고 **안쪽 돔**으로 막는다
            P0 = (Vector((0, 0, 0)) if role == "child"
                  else ob.matrix_world.inverted() @ bpy.data.objects[J["child"]].matrix_world.translation)
            best, bd = None, 1e9
            for loop in boundary_loops(bm):
                vs = {v for e in loop for v in e.verts}
                c = sum((v.co for v in vs), Vector()) / len(vs)
                rmean = sum((v.co - P0).length for v in vs) / len(vs)
                if (c - P0).length > J["R"] * 2.0:
                    continue
                if abs(rmean - J["R"]) < bd:
                    bd, best = abs(rmean - J["R"]), loop
            cyc = ordered_cycle(best) if best else None
            if cyc is None:
                report["openLoopsNearJoint"].append({"node": node, "joint": pname,
                                                     "reason": "어깨 링을 단순 고리로 못 잡았다"})
                continue
            tally = {}
            for e in best:
                for f in e.link_faces:
                    tally[f.material_index] = tally.get(f.material_index, 0) + 1
            mi = max(tally.items(), key=lambda kv: kv[1])[0] if tally else 0
            # 안쪽 = 자기 몸통 **쪽**. 기존 캡 도구는 정확히 반대(바깥)로 부풀렸다.
            body = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
            cC = sum((v.co for v in cyc), Vector()) / len(cyc)
            inward = (body - cC)
            inward = inward.normalized() if inward.length > 1e-6 else Vector((0, 0, 1))
            faces, rr, hh = build_inward_dome(bm, cyc, inward)
            adds = [f for f in faces if f.is_valid]
            for f in adds:
                f.material_index = mi
                f.smooth = True
            bmesh.ops.triangulate(bm, faces=adds)
            bm.faces.ensure_lookup_table()
            made[f"{pname}:{role}"] = {"ball": False, "mode": "bury", "reason": BURY[pname],
                                       "loopVerts": len(cyc), "ringRadiusMm": round(rr * 1000, 2),
                                       "domeHeightMm": round(hh * 1000, 2), "addedPolys": len(adds)}
            added_total += len(adds)
            continue
        if pname in SKIP_BALL:
            # 구 제외 — 평면 팬으로만 막는다
            loops = boundary_loops(bm)
            P0 = Vector((0, 0, 0)) if role == "child" else (
                ob.matrix_world.inverted() @ bpy.data.objects[J["child"]].matrix_world.translation)
            tgt, td = None, 1e9
            for loop in loops:
                vs = {v for e in loop for v in e.verts}
                c = sum((v.co for v in vs), Vector()) / len(vs)
                if (c - P0).length < td and (c - P0).length < J["R"] * 1.5:
                    td, tgt = (c - P0).length, loop
            if tgt is None:
                continue
            tally = {}
            for e in tgt:
                for f in e.link_faces:
                    tally[f.material_index] = tally.get(f.material_index, 0) + 1
            mi = max(tally.items(), key=lambda kv: kv[1])[0] if tally else 0
            res = bmesh.ops.holes_fill(bm, edges=tgt, sides=0)
            adds = [f for f in res.get("faces", []) if f.is_valid]
            for f in adds:          # 삼각화 전에 재질을 건다(인덱스로 고르지 않는다)
                f.material_index = mi
                f.smooth = True
            if adds:
                bmesh.ops.triangulate(bm, faces=adds)
            bm.faces.ensure_lookup_table()
            made[f"{pname}:{role}"] = {"ball": False, "reason": SKIP_BALL[pname],
                                       "flatFanTris": len(adds), "loopEdges": len(tgt)}
            added_total += len(adds)
            continue
        R = J["R"] - (DELTA if role == "child" else 0.0)
        # 피벗 — 자식이면 자기 원점, 부모면 자식 원점을 자기 로컬로 옮긴 점
        if role == "child":
            P = Vector((0, 0, 0))
        else:
            cw = bpy.data.objects[J["child"]].matrix_world.translation
            P = ob.matrix_world.inverted() @ cw
        # ── 1. 구 안쪽을 지운다
        #    지운 뒤 경계가 **단순 고리**가 아니면 캡을 만들 수 없다(어깨에서 실제로
        #    122 엣지짜리 분기 경계가 나왔다). 그때는 **아무것도 지우지 않는다** —
        #    스커트가 비원형 경계를 감당하므로 삭제는 필수가 아니고, 구면은 그대로다.
        inside = {v for v in bm.verts if (v.co - P).length < R}
        kill = [f for f in bm.faces if any(v in inside for v in f.verts)]
        if len(kill) > len(bm.faces) * MAX_DELETE_FRAC:
            report["aborted"].append({"node": node, "joint": pname,
                                      "wouldDeleteFaces": len(kill), "ofFaces": len(bm.faces),
                                      "reason": "R 이 너무 크다 — 세그먼트를 삼킨다"})
            continue
        if inside and not simple_cycle_after_delete(ob, bm, P, R, pname, role):
            note[f"{pname}:{role}"] = "구 안쪽 삭제를 건너뛰었다 — 삭제하면 경계가 분기한다"
            inside, kill = set(), []
        ndel = len(kill)
        if inside:
            # ⚠ context="FACES" 는 면만 지우고 **안쪽 정점을 남긴다**. 그러면 구 깊숙한
            #   정점이 경계에 살아남아 투영 때 100mm 씩 끌려나온다(1차 실행 실측).
            #   "VERTS" 로 지워야 경계가 전부 구 바깥에 놓인다.
            bmesh.ops.delete(bm, geom=list(inside), context="VERTS")
            bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        # ── 2. 그 자리의 경계 고리를 찾는다
        #    중심이 피벗에 가까운 고리를 고르면 안 된다 — 발목에서 엉뚱한 고리(양말 윗단)가
        #    뽑혀 스커트가 91mm 까지 벌어졌다. **정점들의 평균 반경이 R 에 가장 가까운**
        #    고리를 고른다. 그게 이 구가 이어받아야 할 테두리다.
        best, bd = None, 1e9
        for loop in boundary_loops(bm):
            verts = {v for e in loop for v in e.verts}
            rmean = sum((v.co - P).length for v in verts) / len(verts)
            c = sum((v.co for v in verts), Vector()) / len(verts)
            if (c - P).length > R * 2.0:
                continue
            score = abs(rmean - R)
            if score < bd:
                bd, best = score, loop
        cyc = ordered_cycle(best) if best else None
        if cyc is None:
            report["openLoopsNearJoint"].append({"node": node, "joint": pname,
                                                 "reason": "구 재절단 뒤 단순 고리를 못 찾았다",
                                                 "deletedFaces": ndel})
            deleted_total += ndel
            continue
        tally = {}
        for e in best:
            for f in e.link_faces:
                tally[f.material_index] = tally.get(f.material_index, 0) + 1
        mat_idx = max(tally.items(), key=lambda kv: kv[1])[0] if tally else 0
        before = len(bm.faces)
        # ── 3. 경계를 **옮기지 않고** 스커트 한 줄로 구면에 연결한다.
        #    정점을 구면으로 끌어당기면 원형과 거리가 먼 경계(고관절·어깨)에서
        #    한 점이 최대 100mm 까지 끌려와 살이 패인다(2차 실행 실측). 스커트는
        #    원래 살을 그대로 두고 깔때기처럼 잇는다 — 구면은 정확히 유지된다.
        moved = [abs((v.co - P).length - R) for v in cyc]
        ring0 = [bm.verts.new(P + (v.co - P).normalized() * R) for v in cyc]
        bm.verts.ensure_lookup_table()
        skirt, m = [], len(cyc)
        for i in range(m):
            j = (i + 1) % m
            try:
                skirt.append(bm.faces.new((cyc[i], cyc[j], ring0[j], ring0[i])))
            except ValueError:
                pass
        # ── 4. 구면을 따라 먼 극까지 덮는다
        body = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        a = (P - body)
        a = a.normalized() if a.length > 1e-6 else Vector((0, 0, 1))
        faces, extent, K, capfail = build_sphere_cap(bm, ring0, P, a, R)
        faces += skirt
        # 구 껍질은 닫힌 면이어야 한다 — 법선을 한 방향으로 맞춘다.
        # (맞추지 않으면 스무스 셰이딩에서 정점 법선이 뒤섞여 얼룩이 진다)
        bmesh.ops.recalc_face_normals(bm, faces=[f for f in faces if f.is_valid])
        # ── 4. 자식에만 채움 구 하나 (초승달 빈 구역 보증)
        fill_n = 0
        if role == "child" and not NO_FILL:
            faces += build_fill_sphere(bm, P, J["R"] - 2 * DELTA)
            fill_n = FILL_SEG * (2 + (FILL_RING - 2) * 2)
        # ⚠ **면을 인덱스로 고르지 마라.** bmesh.ops.delete 뒤에도 옛 면은 낡은 index 를
        #   그대로 들고 있어서 "index >= before" 가 남의 면을 집는다. 실제로 무릎 구
        #   껍질 84개 면이 옆 관절(고관절)의 **검은 반바지 재질**을 뒤집어썼고,
        #   렌더에 검은 삼각형으로 나왔다. 재질은 **삼각화 전에** 직접 만든 면에만 건다
        #   — 삼각화는 속성을 물려받는다.
        add = [f for f in faces if f.is_valid]
        for f in add:
            f.material_index = mat_idx
            f.smooth = True
        bmesh.ops.triangulate(bm, faces=add)
        bm.faces.ensure_lookup_table()
        # 계측용 — 이 테두리가 "원래 살이 끝나고 관절 캡이 시작되는 자리" 다.
        report.setdefault("rims", {}).setdefault(pname, {})[node] =             [[round(x, 6) for x in v.co] for v in cyc]
        made[f"{pname}:{role}"] = {"deleted": ndel, "addedPolys": len(add), "fillOf": fill_n,
                                   "capFaceFailures": capfail, "skirtFaceFailures": len(cyc) - len(skirt),
                                   "loopVerts": len(cyc), "capExtentDeg": round(extent, 1), "latSteps": K,
                                   "loopProjMaxMm": round(max(moved) * 1000, 2),
                                   "loopProjMeanMm": round(sum(moved) / len(moved) * 1000, 2),
                                   "sphereRadiusMm": round(R * 1000, 2)}
        added_total += len(add)
        deleted_total += ndel
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    # ⚠ glTF 임포트는 **커스텀 분할 법선**(loop 당 저장)을 가져온다. 새로 만든 면에는
    #   그 데이터가 없고, 정점을 지우면 loop 색인도 어긋난다. 그대로 두면 렌더에
    #   검은 삼각형이 깔린다(180° 무릎 실측 — 대퇴 메시 하나 안에서 재현). 지운다.
    #   지우면 익스포터가 계산 법선을 쓴다 — 유기적 표면이라 원본과 사실상 같다.
    at = ob.data.attributes.get("custom_normal")
    if at is not None:
        ob.data.attributes.remove(at)
        report.setdefault("clearedCustomNormals", []).append(node)
    ob.data.update()
    if note:
        report.setdefault("notes", {})[node] = note
    report["perNode"][node] = made
    print(f"  {node}: " + json.dumps(made, ensure_ascii=False))

for pname, J in JOINTS.items():
    report["joints"][pname] = {
        "child": J["child"], "parent": J["parent"],
        "sphereRadiusMm": round(J["R"] * 1000, 2),
        "planeRingRadiusMm": round(J["planeRadiusM"] * 1000, 2),
        "planeOffsetFromPivotMm": round(J["pivotOffsetM"] * 1000, 2),
        "radiusFormula": "sqrt(링반경² + 평면이 피벗에서 떨어진 거리²) = 피벗→링 테두리",
        "synthetic": J.get("synthetic"),
    }
report["totalAddedTriangles"] = added_total
report["totalDeletedTriangles"] = deleted_total

# ── 폐합 검사 — 관절 근처에 열린 경계가 남았는가 ──────────────────────────
for pname, J in JOINTS.items():
    for role, node in (("child", J["child"]), ("parent", J["parent"])):
        if not node:
            continue
        ob = bpy.data.objects[node]
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bm.edges.ensure_lookup_table()
        if role == "child":
            P = Vector((0, 0, 0))
        else:
            P = ob.matrix_world.inverted() @ bpy.data.objects[J["child"]].matrix_world.translation
        for loop in boundary_loops(bm):
            verts = {v for e in loop for v in e.verts}
            c = sum((v.co for v in verts), Vector()) / len(verts)
            if (c - P).length < J["R"] * 2.0:
                report["openLoopsNearJoint"].append(
                    {"node": node, "joint": pname, "edges": len(loop),
                     "centerLocalMm": [round(x * 1000, 1) for x in c],
                     "distFromPivotMm": round((c - P).length * 1000, 1)})
        bm.free()
report["allJointsClosed"] = len(report["openLoopsNearJoint"]) == 0

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True,
                          export_apply=False, export_cameras=False, export_lights=False)
json.dump(report, open(REPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("BALL_JOINTS_COMPLETE added=", added_total, "deleted=", deleted_total,
      "closed=", report["allJointsClosed"], "aborted=", len(report["aborted"]))
