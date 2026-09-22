"""natural_joint_skin 라이더 → 앱 계약(강체 노드 14개) GLB 로 분해·변환한다 (단계 B).

`decompose-v2-rider.py`(F16) 의 **핵심 10줄과 앱 계약 지식은 옮기고**, 아마추어 전제와
외부 exec 체인은 버린 재작성판이다. 판정 근거는 계획서 rev.3 §2-2.

── 왜 재작성인가 ──────────────────────────────────────────────────────────
`decompose-v2-rider.py` 는 스킨드 메시를 전제한다(vertex_groups · pose bone eval_head/tail ·
Armature modifier apply · render-all.py→fit_ik.py→V2.4 폴더 exec). 신규 자산에는
**아마추어가 없다**(P2 실측: 오브젝트 타입 [CAMERA, EMPTY, LIGHT, MESH], Armature modifier 0).

대신 모델러가 남긴 것을 쓴다:
  · `node-mapping.json`  단계 A 의 210노드 → 15그룹 귀속 (여기서 다시 계산하지 않는다)
  · `anchors.json`       14노드 원점 (출처는 그 파일에 기록)
  · `joint_layout.json`  절단면 중심·반경·세그먼트 축 (P3 에서 현재 형상과 ≤0.082mm 검증)

── 옮겨 온 핵심 (decompose-v2-rider.py:169, 218-220) ──────────────────────
    rot = d.normalized().rotation_difference(DOWN)          # 세그먼트 축 → rest
    M   = rot.to_4x4() @ Matrix.Translation(-origin)
    obj.data.transform(M)                                   # **정점에 직접** 적용
    obj.matrix_world = Matrix.Identity(4)

── ⚠ F20/F21 교훈 ────────────────────────────────────────────────────────
폐기된 `normalize-node-rest.mjs`(F20) 는 **export 된 GLB 를 후처리로** 회전시켜 오차를
정점으로 옮겼다. 여기서는 **분해 단계에서** −Y rest 로 만들어 내보낸다. export 후
정점을 되돌리는 후처리를 붙이지 마라.

── 좌표계 ────────────────────────────────────────────────────────────────
Blender 안에서는 glTF import 결과(z-up)로 작업하고, 앵커는 glTF y-up 이므로
gltf(x,y,z) → blender(x, −z, y) 로 환산해 쓴다. export 는 exporter 의 +Y up 에 맡긴다.

실행:
  blender --background --factory-startup --python decompose-natural-joint-skin.py -- \
      <s5.glb> <blend> <node-mapping.json> <anchors.json> <joint_layout.json> \
      <guide-verts.json> <outDir>
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix

_A = sys.argv[sys.argv.index("--") + 1:]
S5, BLEND, NODEMAP, ANCHORS, JOINTLAYOUT, GUIDEVERTS, OUTDIR = _A[:7]
os.makedirs(OUTDIR, exist_ok=True)

G2B = lambda p: Vector((p[0], -p[2], p[1]))   # glTF y-up → Blender z-up
DOWN = Vector((0.0, 0.0, -1.0))               # Blender 에서의 rest 방향 (= glTF −Y)

nodemap = json.load(open(NODEMAP, encoding="utf-8"))
anchors = json.load(open(ANCHORS, encoding="utf-8"))
jl = json.load(open(JOINTLAYOUT, encoding="utf-8"))
guides = json.load(open(GUIDEVERTS, encoding="utf-8"))["meshes"]

SPLIT_MESHES = list(guides.keys())
GUIDE2NODE = {
    "Guide_Torso": "torso",
    "Guide_Right_UpperArm": "arm_l", "Guide_Right_Forearm": "arm_l_fore",
    "Guide_Left_UpperArm": "arm_r", "Guide_Left_Forearm": "arm_r_fore",
    "Guide_Right_Thigh": "leg_l", "Guide_Right_Shin": "leg_l_shin",
    "Guide_Left_Thigh": "leg_r", "Guide_Left_Shin": "leg_r_shin",
}
# 앱 계약 — 부모와 자식 관계 (제품 GLB 실측, STEP-P nodeContract.hierarchy)
PARENT = {
    "crank": None, "pedal_l": "crank", "pedal_r": "crank", "torso": None,
    "leg_l": None, "leg_l_shin": "leg_l", "ankle_l": "leg_l_shin",
    "leg_r": None, "leg_r_shin": "leg_r", "ankle_r": "leg_r_shin",
    "arm_l": None, "arm_l_fore": "arm_l", "arm_r": None, "arm_r_fore": "arm_r",
}
# 세그먼트 축 = 이 노드의 원점 → 자식 원점. rest 는 −Y(glTF) = −Z(Blender).
AXIS_CHILD = {
    "leg_l": "leg_l_shin", "leg_l_shin": "ankle_l",
    "leg_r": "leg_r_shin", "leg_r_shin": "ankle_r",
    "arm_l": "arm_l_fore", "arm_r": "arm_r_fore",
}
WRIST = {"arm_l_fore": anchors["supplementary"]["wrist"]["R"],
         "arm_r_fore": anchors["supplementary"]["wrist"]["L"]}

report = {"unpose": {}, "cut": {}, "nodes": {}, "warnings": []}


def anchor_world(node):
    a = anchors["anchors"][node]
    w = a.get("worldOrigin")
    if w is None:
        w = a.get("localTranslation")
    return G2B(w) if w else None


# ── 0) s5 import ──────────────────────────────────────────────────────────
print("=== [0] s5 import ===")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=S5)
objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}
print(f"  메시 오브젝트 {len(objs)}")

# scale≠1 을 정점에 굽는다 (B9) — 노드 변환 전체를 월드로 적용한다
baked_scale = 0
for o in objs.values():
    if any(abs(s - 1.0) > 1e-9 for s in o.scale):
        baked_scale += 1
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
report["bakedScaleObjects"] = baked_scale
print(f"  scale≠1 이던 오브젝트 {baked_scale}개 포함, 전 오브젝트를 월드로 구웠다")

# ── 1) 분할 메시 용접 + Guide 라벨 전이 ──────────────────────────────────
print("=== [1] 분할 메시 용접 · Guide 라벨 전이 ===")
GRID = 1e4


def build_lookup(meshname):
    cells = {}
    m = guides[meshname]
    for i, p in enumerate(m["positions"]):
        b = G2B(p)
        k = (round(b.x * GRID), round(b.y * GRID), round(b.z * GRID))
        cells.setdefault(k, []).append((b, GUIDE2NODE[m["dominantGroup"][i]]))
    return cells


def transfer(cells, p):
    best, bd = None, 1e9
    cx, cy, cz = round(p.x * GRID), round(p.y * GRID), round(p.z * GRID)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for q, node in cells.get((cx + dx, cy + dy, cz + dz), ()):
                    d = (q - p).length_squared
                    if d < bd:
                        bd, best = d, node
    return best, math.sqrt(bd) if best else None


CUT_PLANES = {}      # name -> {point, normal(distal+), radius, mesh, allow}


def _blender_axis(v):
    """joint_layout 의 축은 이미 Blender z-up 이다(P2 coordSystem)."""
    return Vector(v).normalized()


def build_cut_planes():
    """6개 절단면 — 계획서 §단계B 가 정한 어깨×2·팔꿈치×2·무릎×2. 그 외는 만들지 않는다.

    법선은 **원위(distal) 방향이 양수**가 되도록 잡는다.
      · 무릎/팔꿈치 = joint_layout 두 축의 이등분선 (P3 에서 Guide 이음매 법선과 0.24° 일치)
      · 어깨        = joint_layout 의 upper_axis (P3 에서 verify.py 가 0.0127mm 로 검증한 상완 샤프트 축)
    통과점은 §2-5 대로 **노드 원점은 anchors, 절단면은 joint_layout 계보**를 쓴다.
    """
    T = "Rider anatomical torso shoulders and pelvis"
    KL, KR = "Left continuous knee skin", "Right continuous knee skin"
    j = jl["joints"]
    bis = lambda a, b: (_blender_axis(a) + _blender_axis(b)).normalized()
    # 어깨 이음매 중심 — Guide 경계 링(P3-shoulder.json) 의 무게중심. glTF → Blender.
    SH = {"arm_l": G2B([0.201633, 1.222279, 0.16936]),
          "arm_r": G2B([0.202905, 1.221985, -0.170328])}
    CUT_PLANES["shoulder_l"] = {"point": SH["arm_l"], "normal": _blender_axis(j["Right elbow"]["upper_axis"]),
                                "radius": 0.0569, "mesh": T, "proximal": "torso", "distal": "arm_l"}
    CUT_PLANES["shoulder_r"] = {"point": SH["arm_r"], "normal": _blender_axis(j["Left elbow"]["upper_axis"]),
                                "radius": 0.0563, "mesh": T, "proximal": "torso", "distal": "arm_r"}
    CUT_PLANES["elbow_l"] = {"point": anchor_world("arm_l_fore"),
                             "normal": bis(j["Right elbow"]["upper_axis"], j["Right elbow"]["fore_axis"]),
                             "radius": 0.0459, "mesh": T, "proximal": "arm_l", "distal": "arm_l_fore"}
    CUT_PLANES["elbow_r"] = {"point": anchor_world("arm_r_fore"),
                             "normal": bis(j["Left elbow"]["upper_axis"], j["Left elbow"]["fore_axis"]),
                             "radius": 0.0459, "mesh": T, "proximal": "arm_r", "distal": "arm_r_fore"}
    CUT_PLANES["knee_l"] = {"point": anchor_world("leg_l_shin"),
                            "normal": bis(j["Right knee"]["thigh_axis"], j["Right knee"]["shin_axis"]),
                            "radius": 0.0704, "mesh": KR, "proximal": "leg_l", "distal": "leg_l_shin"}
    CUT_PLANES["knee_r"] = {"point": anchor_world("leg_r_shin"),
                            "normal": bis(j["Left knee"]["thigh_axis"], j["Left knee"]["shin_axis"]),
                            "radius": 0.0732, "mesh": KL, "proximal": "leg_r", "distal": "leg_r_shin"}


split_parts = {}          # app node -> list of obj
max_transfer_mm = 0.0
build_cut_planes()

for mname in SPLIT_MESHES:
    ob = objs[mname]
    # 용접 — s5 는 노멀 심에서 정점이 쪼개져 있다. BLEND 의 용접 위상을 복원한다.
    bm = bmesh.new(); bm.from_mesh(ob.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    welded = len(bm.verts)

    cells = build_lookup(mname)
    # 원본(용접 후) 정점의 Guide 라벨 — 새로 생기는 정점은 최근접에서 물려받는다
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        n, d = transfer(cells, v.co)
        if n is None:
            raise RuntimeError(f"{mname}: Guide 전이 실패")
        max_transfer_mm = max(max_transfer_mm, d * 1000)

    # ── 평면 절단 — **새 엣지 루프를 만든다**. 삼각형 다수결 분할(톱니)을 폐기했다.
    planes_here = {k: v for k, v in CUT_PLANES.items() if v["mesh"] == mname}
    cut_stats = {}
    for pname, pl in planes_here.items():
        # ⚠ 구가 아니라 **원통**으로 제한한다. 구로 자르면 어깨 평면이 가슴·등까지 파고들어
        #   절단 링이 반경 27.8~210.4mm(비 7.57)의 거대한 불규칙 고리가 된다(실측).
        #   무릎 1.01 · 팔꿈치 1.00 과 비교하면 어깨만 망가진 것이 분명하다.
        #   사지 축 둘레 R_lat 안, 평면에서 ±R_ax 안으로 묶으면 팔 단면만 남는다.
        P, N = pl["point"], pl["normal"]
        R_lat, R_ax = pl["radius"] * 1.5, pl["radius"] * 3.0
        bm.faces.ensure_lookup_table()

        def in_cyl(c):
            d = c - P
            ax = d.dot(N)
            return abs(ax) <= R_ax and (d - N * ax).length <= R_lat

        sel_f = [f for f in bm.faces if in_cyl(f.calc_center_median())]
        if not sel_f:
            cut_stats[pname] = {"error": "절단 반경 안에 면이 없다"}
            continue
        geom = set(sel_f)
        for f in sel_f:
            geom.update(f.verts); geom.update(f.edges)
        res = bmesh.ops.bisect_plane(bm, geom=list(geom), plane_co=P, plane_no=N,
                                     clear_inner=False, clear_outer=False, use_snap_center=False)
        new_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        new_verts = [v for v in res["geom_cut"] if isinstance(v, bmesh.types.BMVert)]
        cut_stats[pname] = {"faceCandidates": len(sel_f), "newEdges": len(new_edges), "newVerts": len(new_verts),
                            "planePointBlender": [round(x, 5) for x in P],
                            "planeNormalBlender": [round(x, 5) for x in N],
                            "limitLateralMm": round(R_lat * 1000, 1), "limitAxialMm": round(R_ax * 1000, 1)}
        print(f"    절단 {pname}: 후보면 {len(sel_f)} → 새 엣지 {len(new_edges)} · 새 정점 {len(new_verts)}")
    bm.to_mesh(ob.data); bm.free()
    after = len(ob.data.vertices)

    # ── 절단 후 귀속 — 절단 반경 **안**은 평면 부호, **밖**은 Guide 라벨.
    # bisect 가 만든 새 정점은 원본 격자(±0.15mm) 밖이라 전이가 실패할 수 있다.
    # 그런 정점은 None 으로 두고 삼각형 다수결에서 빠진다 — 새 정점은 전부 절단면
    # 근처에 있고, 그 구역은 평면 부호가 결정하므로 라벨이 필요 없다.
    vlabel = []
    for v in ob.data.vertices:
        n, d = transfer(cells, v.co)
        if n is not None:
            max_transfer_mm = max(max_transfer_mm, d * 1000)
        vlabel.append(n)

    def sd(pname, c):
        pl = CUT_PLANES[pname]
        return (c - pl["point"]).dot(pl["normal"])

    # ⚠ **거리 상한** — 평면 부호는 절단이 실제로 일어난 반경 안에서만 쓴다.
    #   1차는 무한 평면 부호를 메시 전체에 적용해, 어깨에서 392.8mm 떨어진 저지 면들이
    #   팔로 끌려갔다(arm_l 에 1,127면·열린엣지 121 짜리 떠돌이 조각, torso 에 같은 크기 구멍).
    #   bisect 를 반경 3배 안에서만 했으므로 그 **바깥에는 평면이 만든 경계가 없다** —
    #   부호를 쓸 근거가 없고, Guide 라벨이 정답이다. 상한을 bisect 반경과 같게 둔다.
    def nearest_plane(c):
        """귀속도 **절단을 실제로 건 원통 안**에서만 평면 부호를 쓴다."""
        best, bd = None, 1e9
        for pname, pl in planes_here.items():
            d = c - pl["point"]
            ax = d.dot(pl["normal"])
            lat = (d - pl["normal"] * ax).length
            if abs(ax) <= pl["radius"] * 3.0 and lat <= pl["radius"] * 1.5 and abs(ax) < bd:
                bd, best = abs(ax), pname
        return best

    tri_group = {}
    used_plane = 0
    used_guide = 0
    for poly in ob.data.polygons:
        c = poly.center
        pname = nearest_plane(c)
        if pname is not None:
            pl = CUT_PLANES[pname]
            g = pl["distal"] if sd(pname, c) > 0 else pl["proximal"]
            used_plane += 1
        else:
            tally = {}
            for vi in poly.vertices:
                lb = vlabel[vi]
                if lb:
                    tally[lb] = tally.get(lb, 0) + 1
            g = max(tally.items(), key=lambda kv: kv[1])[0] if tally else "torso"
            used_guide += 1
        tri_group[poly.index] = g

    # ── 떠돌이 조각 회수 — `arm_*` 의 연결성분 중 **어깨 절단 링에 닿지 않는 것**은 torso 로.
    #   재질이 100% 저지이고 원래 몸통 면이었다. 원통 경계와 Guide 경계가 정확히
    #   일치하지 않아 남는 잔여물이며, 아무것에도 붙지 않은 채 허공에 뜬다.
    #   leg_*·ankle_* 의 계승 섬(양말·반바지)은 원본에 있던 것이므로 손대지 않는다.
    reclaimed = {}
    if mname == "Rider anatomical torso shoulders and pelvis":
        e2f = {}
        for poly in ob.data.polygons:
            for ek in poly.edge_keys:
                e2f.setdefault(ek, []).append(poly.index)
        for gname, pname in (("arm_l", "shoulder_l"), ("arm_r", "shoulder_r")):
            pl = CUT_PLANES[pname]
            P, N, R_lat = pl["point"], pl["normal"], pl["radius"] * 1.5
            members = {i for i, g in tri_group.items() if g == gname}
            seen, moved, comps_info = set(), 0, []
            for f0 in members:
                if f0 in seen:
                    continue
                stack, comp = [f0], []
                while stack:
                    fi = stack.pop()
                    if fi in seen:
                        continue
                    seen.add(fi); comp.append(fi)
                    for ek in ob.data.polygons[fi].edge_keys:
                        for fj in e2f.get(ek, ()):
                            if fj in members and fj not in seen:
                                stack.append(fj)
                # 어깨 링에 닿는가 — 평면에서 3mm 이내이면서 원통 안인 정점이 있는가
                touches = False
                dmin = 1e9
                for fi in comp:
                    for vi in ob.data.polygons[fi].vertices:
                        d = ob.data.vertices[vi].co - P
                        ax = d.dot(N)
                        lat = (d - N * ax).length
                        if lat <= R_lat:
                            dmin = min(dmin, abs(ax))
                        if abs(ax) <= 0.003 and lat <= R_lat:
                            touches = True
                comps_info.append({"faces": len(comp), "touchesRing": touches,
                                   "minDistToPlaneMm": round(dmin * 1000, 2) if dmin < 1e9 else None,
                                   "faceIdx": comp})
            # 지정 규칙("링에 닿지 않는 것")은 실측상 발동하지 않는다 — 잔여 조각이
            # 링에 **닿아 있기** 때문이다. 의도는 "arm_* 는 한 덩어리여야 한다" 이므로
            # **최대 성분만 남기고 나머지를 torso 로 돌려보낸다.** 판정에 쓴 거리도 남긴다.
            comps_info.sort(key=lambda d: -d["faces"])
            for ci in comps_info[1:]:
                for fi in ci["faceIdx"]:
                    tri_group[fi] = "torso"
                moved += ci["faces"]
            reclaimed[gname] = {"movedFaces": moved, "keptFaces": comps_info[0]["faces"] if comps_info else 0,
                                "components": [{k: v for k, v in c.items() if k != "faceIdx"} for c in comps_info]}
            if moved:
                print(f"    떠돌이 회수 {gname} → torso: {moved}면 "
                      f"(잔여 성분 {[c['faces'] for c in comps_info[1:]]} · 링 접촉 {[c['touchesRing'] for c in comps_info[1:]]} "
                      f"· 평면까지 {[c['minDistToPlaneMm'] for c in comps_info[1:]]}mm)")
        report["reclaimedStrayFaces"] = reclaimed

    groups = sorted(set(tri_group.values()))
    counts = {gname: sum(1 for v in tri_group.values() if v == gname) for gname in groups}
    report["cut"][mname] = {"weldedVerts": [before, welded], "vertsAfterBisect": after,
                            "planes": cut_stats, "trianglesPerGroup": counts,
                            "assignedByPlane": used_plane, "assignedByGuideLabel": used_guide,
                            "planeRadiusLimit": "절단 중심에서 반경 3배 이내 (= bisect 를 실제로 건 범위)",
                            "method": "joint_layout 유래 평면으로 bisect → 새 엣지 루프 생성. 귀속은 절단 반경 안=평면 부호, 밖=Guide 라벨"}
    print(f"  {mname}: 용접 {before}→{welded} · 절단후 {after} · {counts}")
    for gname in groups:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        kill = [f for f in bm.faces if tri_group[f.index] != gname]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        me = bpy.data.meshes.new(f"{gname}__{mname}")
        bm.to_mesh(me); bm.free()
        for mat in ob.data.materials:
            me.materials.append(mat)
        part = bpy.data.objects.new(f"{gname}__{mname}", me)
        bpy.context.collection.objects.link(part)
        split_parts.setdefault(gname, []).append(part)
    bpy.data.objects.remove(ob, do_unlink=True)
    del objs[mname]
report["guideTransferMaxMm"] = round(max_transfer_mm, 5)

# ── 2) 노드별 소스 수집 ───────────────────────────────────────────────────
print("=== [2] 노드별 소스 수집 ===")
members = {}
for node, spec in nodemap["nodes"].items():
    got = [objs[n] for n in spec["sourceNodes"] if n in objs]
    got += split_parts.get(node, [])
    members[node] = got
    if node != "static" and not got:
        report["warnings"].append(f"{node}: 소스 0개")
print("  " + " · ".join(f"{k}={len(v)}" for k, v in members.items()))


def join_into(name, parts):
    """여러 오브젝트를 하나로 합친다 (정점·삼각형·**머티리얼 슬롯** 보존).

    ⚠ bmesh 로 합치면 face.material_index 는 남지만 머티리얼 슬롯이 따라오지 않아
      재질이 전부 사라진다(실제로 24개를 잃었다). `bpy.ops.object.join()` 은 슬롯을
      병합하며 인덱스를 재매핑해 준다."""
    if not parts:
        return None
    for p in parts:
        if p.name not in bpy.context.collection.objects:
            try:
                bpy.context.collection.objects.link(p)
            except RuntimeError:
                pass
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


# ── 3) un-pose ────────────────────────────────────────────────────────────
print("=== [3] un-pose — 세그먼트 축을 rest(−Z Blender = −Y glTF) 로 ===")
CRANK_O = anchor_world("crank")


def crank_rest_rotation():
    """크랭크 메시 로컬 프레임 — 앱 계약 검증 결과 rest=Rz(+90°), phase0 override=Rz(+90°)
    라서 합계 Rz(180°) 가 pedalWorld('l',0) 와 일치한다(제품 실측). 따라서 로컬 메시는
    **+z 페달이 로컬 +Y(glTF) = +Z(Blender)** 를 향해야 한다."""
    ped = members["pedal_l"]
    pts = [v.co for p in ped for v in p.data.vertices]
    c = sum(pts, Vector()) / len(pts)
    u = Vector((c.x - CRANK_O.x, 0.0, c.z - CRANK_O.z))   # Blender: 시상면 = xz
    u.normalize()
    target = Vector((0.0, 0.0, 1.0))                       # glTF +Y
    return u.rotation_difference(target).to_matrix().to_4x4(), u


def unpose_rotation(node):
    o = anchor_world(node)
    if node in AXIS_CHILD:
        d = anchor_world(AXIS_CHILD[node]) - o
    elif node in WRIST:
        d = G2B(WRIST[node]) - o
    else:
        return None, None, o
    rot = d.normalized().rotation_difference(DOWN).to_matrix().to_4x4()
    return rot, d, o


built = {}
NODE_M = {}
PEDAL_DIR = None
ORDER = ["crank", "pedal_l", "pedal_r"] + [n for n in PARENT if n not in ("crank", "pedal_l", "pedal_r")]
for node in ORDER:
    parts = members.get(node, [])
    if not parts:
        report["nodes"][node] = {"error": "소스 없음"}
        continue
    ob = join_into(node, parts)
    if node == "crank":
        rot, u = crank_rest_rotation()
        globals()["PEDAL_DIR"] = u
        M = rot @ Matrix.Translation(-CRANK_O)
        q = rot.to_quaternion()
        report["unpose"][node] = {"kind": "crank-phase", "measuredPedalDirBlenderXZ": [round(u.x, 5), round(u.z, 5)],
                                  "bakeQuatBlender": [round(x, 8) for x in q],
                                  "note": "로컬 +Z(Blender)=+Y(glTF) 로 정렬 — pedal_l 로컬 T [0,+0.1725,+0.074] 와 맞춘다"}
    elif node in ("pedal_l", "pedal_r"):
        # 페달 플랫폼은 월드에서 이미 수평이고, 앱이 crank 회전을 상쇄한다(phase0: crank 180° · pedal −180°)
        # → rest 는 **월드 자세 그대로**, 이동만 한다.
        #
        # ⚠ 원점은 플랫폼 무게중심이 아니라 **페달 축(axle)** 이다. 노드 로컬 T
        #   [0, ±CRANK_ARM_M, ±PEDAL_HALF_Z] 가 가리키는 점이 축이기 때문이다.
        #   무게중심을 쓰면 플랫폼이 축에서 벗어난 만큼(실측 약 2.0/2.6mm) 어긋난다.
        lt = anchors["anchors"][node]["localTranslation"]      # crank 로컬, glTF
        arm, halfz = abs(lt[1]), lt[2]
        sign = 1.0 if node == "pedal_l" else -1.0
        axle = Vector((CRANK_O.x + PEDAL_DIR.x * arm * sign,
                       -halfz,
                       CRANK_O.z + PEDAL_DIR.z * arm * sign))
        M = Matrix.Translation(-axle)
        pts = [v.co for v in ob.data.vertices]
        cen = sum(pts, Vector()) / len(pts)
        report["unpose"][node] = {"kind": "translate-only",
                                  "axleWorldBlender": [round(x, 5) for x in axle],
                                  "platformCentroidBlender": [round(x, 5) for x in cen],
                                  "axleToCentroidMm": [round((cen[i] - axle[i]) * 1000, 3) for i in range(3)],
                                  "note": "축은 앵커의 crank 로컬 T(CRANK_ARM_M 0.1725)에서 파생한다. s5 메시의 크랭크 암 끝단은 173.41mm 라 약 0.9mm 차이가 남는다 — geometry.json 을 건드리지 않기로 한 결정(§3-1)의 결과이며 허용 범위다"}
    elif node in ("ankle_l", "ankle_r"):
        # 밑창 법선을 −Z(Blender) 로 정렬 (F31 — 발은 '뻗는 방향'이 아니라 '밑창 면'이 기준)
        best_n, best_a = None, 0.0
        acc = {}
        for p in ob.data.polygons:
            n = p.normal.copy()
            if n.z > -0.5:
                continue
            k = (round(n.x, 1), round(n.y, 1), round(n.z, 1))
            e = acc.setdefault(k, [Vector(), 0.0])
            e[0] += n * p.area
            e[1] += p.area
        for k, (nsum, area) in acc.items():
            if area > best_a:
                best_a, best_n = area, nsum.normalized()
        o = anchor_world(node)
        if best_n is None:
            rot = Matrix.Identity(4)
            report["warnings"].append(f"{node}: 밑창 면을 찾지 못해 회전 없이 진행")
            report["unpose"][node] = {"kind": "sole-normal", "found": False}
        else:
            rot = best_n.rotation_difference(DOWN).to_matrix().to_4x4()
            report["unpose"][node] = {"kind": "sole-normal", "found": True,
                                      "soleNormalBlender": [round(x, 5) for x in best_n],
                                      "soleAreaMm2": round(best_a * 1e6, 1)}
        M = rot @ Matrix.Translation(-o)
    elif node == "torso":
        o = anchor_world(node)
        M = Matrix.Translation(-o)
        report["unpose"][node] = {"kind": "translate-only",
                                  "note": "몸통은 정렬하지 않는다(앱은 롤만 준다) — decompose-v2-rider.py:75 와 같은 규약",
                                  "originBlender": [round(x, 5) for x in o]}
    else:
        rot, d, o = unpose_rotation(node)
        M = rot @ Matrix.Translation(-o)
        # ── 왕복 검산 (M0) — R⁻¹·(−Z) 가 원래 축과 같은가
        back = rot.to_3x3().inverted() @ DOWN
        err = math.degrees(back.angle(d.normalized()))
        fwd = rot.to_3x3() @ d.normalized()
        err_fwd = math.degrees(fwd.angle(DOWN))
        report["unpose"][node] = {
            "kind": "axis-to-restY",
            "axisBlender": [round(x, 6) for x in d.normalized()],
            "segmentLenMm": round(d.length * 1000, 3),
            "roundTripErrDeg": round(err, 6),
            "forwardErrDeg": round(err_fwd, 6),
        }
    ob.data.transform(M)
    ob.matrix_world = Matrix.Identity(4)
    NODE_M[node] = M.copy()
    built[node] = ob
    report["nodes"][node] = {"verts": len(ob.data.vertices), "tris": len(ob.data.polygons)}

# ── 3b) 7번째 절단면 — 고관절 좌우 (수퍼바이저 승인 2026-09-20) ──────────
# 평면은 **고관절 pivot 을 지나고 대퇴축에 수직**이다. un-pose 가 대퇴축을 로컬 −Z 로
# 정렬하고 pivot 을 원점으로 보냈으므로, 그 평면은 정확히 **로컬 z = 0** 이다.
# 임의 높이(--below-y 0.020 같은)를 쓰지 않는다 — 좌우 대칭도 정의상 보장된다.
#
# 왜 필요한가: 허벅지(반바지 Mesh_153/163)가 고관절 원점보다 위로 뻗어 있어
# (leg_l +81.2mm · leg_r +80.1mm) 페달링으로 회전하면 반바지 밖으로 나온다.
# segment-penetration 이 다리 스텁 3057px 로 잡은 것이 이것이고, 이 형상 결함은
# **포즈 각도와 무관**하므로 continuity/penetration 의 단계 C 유예 대상이 아니다.
hip_cut = {}
for node in ("leg_l", "leg_r"):
    ob = built.get(node)
    if ob is None:
        continue
    bm = bmesh.new(); bm.from_mesh(ob.data)
    tris_before = len(bm.faces)
    top_before = max((v.co.z for v in bm.verts), default=0.0)
    res = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                 plane_co=Vector((0, 0, 0)), plane_no=Vector((0, 0, 1)),
                                 clear_outer=True, clear_inner=False, use_snap_center=False)
    new_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    ring = [v for v in res["geom_cut"] if isinstance(v, bmesh.types.BMVert)]
    r = 0.0
    if ring:
        c = sum((v.co for v in ring), Vector()) / len(ring)
        r = sum((v.co - c).length for v in ring) / len(ring)
    bm.to_mesh(ob.data); bm.free()
    hip_cut[node] = {"trisBefore": tris_before, "trisAfter": len(ob.data.polygons),
                     "stubTopLocalMm": round(top_before * 1000, 2),
                     "newEdges": len(new_edges), "ringVerts": len(ring),
                     "ringRadiusMm": round(r * 1000, 2)}
    print(f"  고관절 절단 {node}: 스텁 상단 {top_before*1000:.1f}mm → 0 · 새 엣지 {len(new_edges)} · 링 반경 {r*1000:.1f}mm")
report["hipCut"] = {"planeDefinition": "고관절 pivot 통과 · 대퇴축 수직 = un-pose 후 로컬 z=0 (Blender). 임의 높이 없음.",
                    "symmetric": True, "approvedBy": "수퍼바이저 2026-09-20", "perNode": hip_cut}
HIP_PLANES = {f"hip_{side}": {"node": f"leg_{side}",
                              "radius": max(0.05, hip_cut.get(f"leg_{side}", {}).get("ringRadiusMm", 90) / 1000)}
              for side in ("l", "r") if f"leg_{side}" in hip_cut}

# static
st = join_into("static_merged", members.get("static", []))
if st:
    report["nodes"]["static"] = {"verts": len(st.data.vertices), "tris": len(st.data.polygons)}

# ── 4) 역검증 — 일부러 틀린 축을 넣어 게이트가 FAIL 을 내는가 ─────────────
print("=== [4] 역검증 (게이트가 실제로 FAIL 을 내는가) ===")
probe = []
for node in ("leg_l", "arm_l"):
    o = anchor_world(node)
    d = (anchor_world(AXIS_CHILD[node]) - o).normalized()
    good = d.rotation_difference(DOWN).to_matrix()
    ok_err = math.degrees((good @ d).angle(DOWN))
    for deg in (1.0, 5.0, 15.0):
        bad_axis = (Matrix.Rotation(math.radians(deg), 3, "Y") @ d).normalized()
        bad = bad_axis.rotation_difference(DOWN).to_matrix()
        bad_err = math.degrees((bad @ d).angle(DOWN))
        probe.append({"node": node, "injectedErrorDeg": deg,
                      "gateErrDeg": round(bad_err, 4), "detected": bad_err > 0.01})
    probe.append({"node": node, "injectedErrorDeg": 0.0, "gateErrDeg": round(ok_err, 6), "detected": ok_err > 0.01})
report["reverseVerification"] = {
    "method": "세그먼트 축을 Y축 기준 1°/5°/15° 틀어 넣고, 그 축으로 만든 회전을 **원래 축**에 적용했을 때 게이트가 그 오차를 잡아내는가",
    "probes": probe,
    "allInjectedDetected": all(p["detected"] for p in probe if p["injectedErrorDeg"] > 0),
    "cleanCaseIsZero": all(p["gateErrDeg"] < 1e-4 for p in probe if p["injectedErrorDeg"] == 0),
}

# ── 5) 노드 계층 조립 ─────────────────────────────────────────────────────
print("=== [5] 14노드 조립 ===")
root = bpy.data.objects.new("RiderBike", None)
bpy.context.collection.objects.link(root)
if st:
    st.parent = root
for node, ob in built.items():
    ob.name = node
    ob.data.name = node
for node, ob in built.items():
    p = PARENT[node]
    ob.parent = built[p] if p and p in built else root

# 로컬 T — anchors.json 대로. 회전 identity, scale 1. crank 만 rest Rz(+90°).
CRANK_REST_Z_DEG = 90.0
local_t = {}
for node, ob in built.items():
    a = anchors["anchors"][node]
    lt = a.get("localTranslation")
    if lt is None:
        w = anchor_world(node)
        pw = anchor_world(PARENT[node]) if PARENT[node] else Vector()
        if node in ("leg_l_shin", "leg_r_shin", "ankle_l", "ankle_r", "arm_l_fore", "arm_r_fore"):
            parent_axis_len = (w - pw).length
            lt_b = Vector((0.0, 0.0, -parent_axis_len))       # rest = 부모 로컬 −Z(Blender)
        else:
            lt_b = w - pw
    else:
        lt_b = G2B(lt)
        if PARENT[node]:
            lt_b = G2B(lt)          # pedal_* 는 crank 로컬 값이 이미 들어 있다
    ob.location = lt_b
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = (1, 0, 0, 0)
    ob.scale = (1, 1, 1)
    local_t[node] = [round(x, 6) for x in lt_b]
# glTF Rz(+90) == Blender Ry(-90).  gltf(x,y,z) = blender(x, z, -y) 이므로
# glTF z축 회전은 Blender **y축** 회전이고 부호도 뒤집힌다. Blender Rz 를 걸면
# glTF 에서는 y축(연직) 회전이 되어 크랭크가 엉뚱한 평면에서 돈다.
built["crank"].rotation_mode = "XYZ"
built["crank"].rotation_euler = (0.0, math.radians(-CRANK_REST_Z_DEG), 0.0)
report["crankRestAxisNote"] = ("glTF Rz(+90°) = Blender Ry(-90°). "
    "gltf(x,y,z)=blender(x,z,-y) 환산에서 glTF z축 = Blender -y축.")
report["localTranslationBlender"] = local_t
report["crankRestZDeg"] = CRANK_REST_Z_DEG

# ── 6) export ─────────────────────────────────────────────────────────────
print("=== [6] export ===")
out_glb = os.path.join(OUTDIR, "candidate-rider-stageB.glb")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", export_animations=False,
                          export_skins=False, export_yup=True, use_selection=True,
                          export_apply=False)
report["outGlb"] = out_glb
tot = sum(v.get("tris", 0) for v in report["nodes"].values() if isinstance(v, dict))
report["totalTriangles"] = tot
print(f"  삼각형 합 {tot}")

# 절단면을 인접 두 노드의 **로컬 좌표**로 환산해 캡 도구에 넘긴다.
local_planes = {}
for pname, pl in CUT_PLANES.items():
    entry = {"radiusM": pl["radius"], "worldPointBlender": [round(x, 6) for x in pl["point"]],
             "worldNormalBlender": [round(x, 6) for x in pl["normal"]], "nodes": {}}
    for side in ("proximal", "distal"):
        node = pl[side]
        M = NODE_M.get(node)
        if M is None:
            continue
        P = M @ pl["point"]
        N = (M.to_3x3() @ pl["normal"]).normalized()
        entry["nodes"][node] = {"side": side,
                                "centerLocalBlender": [round(x, 6) for x in P],
                                "normalLocalBlender": [round(x, 6) for x in N]}
    local_planes[pname] = entry
# 7번째 절단면 — 이미 로컬 z=0 이라 환산이 필요 없다
for pname, spec in HIP_PLANES.items():
    local_planes[pname] = {"radiusM": spec["radius"],
                           "worldPointBlender": None, "worldNormalBlender": None,
                           "note": "고관절 pivot + 대퇴축 = un-pose 후 로컬 z=0",
                           "nodes": {spec["node"]: {"side": "distal",
                                                    "centerLocalBlender": [0.0, 0.0, 0.0],
                                                    "normalLocalBlender": [0.0, 0.0, -1.0]}}}
with open(os.path.join(OUTDIR, "cut-planes-local.json"), "w", encoding="utf-8") as f:
    json.dump({"note": "캡 도구 입력 — 각 절단면을 인접 노드의 로컬(rest) 좌표로 환산한 것. Blender z-up.",
               "planes": local_planes}, f, ensure_ascii=False, indent=1)
print("saved cut-planes-local.json")

with open(os.path.join(OUTDIR, "unpose-report.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print("saved unpose-report.json")
