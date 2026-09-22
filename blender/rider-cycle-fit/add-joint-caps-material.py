"""관절 캡을 **재질 인덱스**로 단다 (단계 B · B16).

── 왜 신규 도구인가 ───────────────────────────────────────────────────────
`apps/web/scripts/rider-cycle-fit/add-joint-caps-v2.mjs` 는 **팔레트 아틀라스 텍스처**를
전제한다(`:123-124` 가 `baseColorTexture` 를 가진 머티리얼을 찾고 없으면 즉시 종료).
제품 GLB 는 `RTW_PBR_PALETTE` 1장으로 라이더 전체를 칠하므로 캡 UV 를 피부 텍셀
`#bc9179` 에 찍으면 색이 맞았다. 그런데 **신규 자산은 텍스처가 0장이고 상수 PBR 재질
24개**를 쓴다 — 그 개념이 성립하지 않는다.

여기서는 UV 대신 **캡이 붙는 경계 엣지의 인접 면이 쓰는 재질 인덱스**를 그대로 물려준다.
기존 도구는 고치지 않는다.

── 왜 평면 부채꼴이 아니라 타원체인가 (2026-09-20 재작업) ────────────────
1차는 절단 루프를 **평평한 부채꼴**로 막았다. 폐합은 됐지만 관절이 굽으면 두 원판이
바깥쪽에서 벌어져 쐐기 틈이 생긴다. 계측으로 확인했다 — 반경 70mm 무릎이 60° 굽으면
`2·R·sin(θ/2) ≈ 70mm` 이고 joint-continuity 실측 단절이 **70.2mm** 였다. 상수를 후보
실측값으로 바꿔도 1px 도 줄지 않았다(P9-diagnosis.json).

제품이 F36 에서 같은 문제("무릎이 끊어져 보이고 로봇 같다")를 푼 방법이 세그먼트 끝마다
**타원체 캡**을 달아 겹치게 하는 것이다(`add-joint-caps-v2.mjs` 머리말). 여기서는 그 방식을
옮기되 반경을 **하드코딩하지 않고 절단 루프에서 실측**한다 — 자산이 다르기 때문이다.

캡은 **자기 세그먼트 몸통의 반대쪽(= 관절 쪽)** 으로 부푼다. 부모 캡과 자식 캡이 서로를
향해 부풀어 겹치므로, 굽혀도 실루엣이 이어진다.

── 무엇을 막는가 ─────────────────────────────────────────────────────────
평면 절단으로 생긴 경계는 **닫힌 엣지 루프**다. 그대로 두면 관절에서 속이 보이고
(joint-continuity 의 '단절'), 회전하면 절단 뚜껑이 드러난다(segment-penetration 의
'절단뚜껑'). 루프를 메워야 한다.

── ⚠ 이 도구는 **아주 작은 루프도 돔으로 부풀린다** ──────────────────────
매칭 조건(수직 ≤3mm · 측면 ≤ 반경*2.5)만 맞으면 면 4개짜리 부스러기 루프에도 캡을
씌운다. 실제로 `arm_l`/`arm_r` 에 남아 있던 4면·3면짜리 잔여 조각이 이 도구를 지나며
54면·46면짜리 **덩어리**로 자랐고, 그걸 보고 "새로 생긴 결함"으로 의심했다. 아니다 —
잔여 조각은 절단 단계에서 이미 있었고 이 도구는 그걸 키웠을 뿐이다.

그러니 캡 이후에 낯선 덩어리가 보이면 **캡 도구가 아니라 절단 결과(연결 성분 개수)를
먼저 보라.** 잔여 제거는 decompose 쪽(최대 성분만 남기고 나머지는 torso 로)에서 한다.

── 계획 외 절단 금지 ─────────────────────────────────────────────────────
`cut-planes-local.json` 에 적힌 6개 절단면 **근처의 루프만** 메운다. 그 밖의 열린
경계(반바지 밑단·양말 끝·정적 부품)는 원래 그런 것이므로 건드리지 않는다.

실행:
  blender --background --factory-startup --python add-joint-caps-material.py -- \
      <in.glb> <out.glb> <cut-planes-local.json> <caps-report.json>
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector

_A = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, PLANES, REPORT = _A[:4]

planes = json.load(open(PLANES, encoding="utf-8"))["planes"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)

# 노드 → 그 노드에서 메워야 할 절단면 목록
per_node = {}
for pname, pl in planes.items():
    for node, spec in pl["nodes"].items():
        per_node.setdefault(node, []).append({
            "plane": pname,
            "center": Vector(spec["centerLocalBlender"]),
            "normal": Vector(spec["normalLocalBlender"]),
            "radius": pl["radiusM"],
        })

report = {"tool": "blender/rider-cycle-fit/add-joint-caps-material.py",
          "method": "평면 절단으로 생긴 닫힌 엣지 루프를 부채꼴(fan)로 메우고, 재질은 루프에 인접한 면의 material_index 를 최빈값으로 물려준다. UV·텍스처를 쓰지 않는다.",
          "perCutFace": {}, "perNode": {}, "skippedLoops": [], "totalCapTriangles": 0}


def boundary_loops(bm):
    """열린 경계 엣지들을 루프 단위로 묶는다."""
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


LAT = 3          # 돔 위도 링 수 (+ 꼭짓점 1). 삼각형 수와 매끈함의 절충.
HEIGHT_RATIO = 0.45   # 돔 높이 = 루프 평균반경 × 이 값. 0.45/0.65/1.0 실측 비교에서 스텁 최소·단절 동일.


def ordered_cycle(loop_edges):
    """열린 경계 엣지 묶음을 **정렬된 정점 고리**로 편다. 단순 고리가 아니면 None."""
    adj = {}
    for e in loop_edges:
        a, b = e.verts
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    if any(len(v) != 2 for v in adj.values()):
        return None                      # 분기·끝점 있음 → 단순 고리가 아니다
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


def build_dome(bm, cyc, outward):
    """루프를 그대로 두고 그 위에 타원체 돔을 세운다. 반환: 새로 만든 면 목록."""
    C = sum((v.co for v in cyc), Vector()) / len(cyc)
    r = sum((v.co - C).length for v in cyc) / len(cyc)
    h = r * HEIGHT_RATIO
    n = outward.normalized()
    rings = [cyc]
    for k in range(1, LAT + 1):
        phi = (k / (LAT + 1)) * (math.pi / 2)
        cs, sn = math.cos(phi), math.sin(phi)
        ring = [bm.verts.new(C + n * (h * sn) + (v.co - C) * cs) for v in cyc]
        rings.append(ring)
    apex = bm.verts.new(C + n * h)
    bm.verts.ensure_lookup_table()
    faces = []
    m = len(cyc)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        for i in range(m):
            j = (i + 1) % m
            try:
                faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
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


total = 0
for ob in list(bpy.data.objects):
    if ob.type != "MESH":
        continue
    specs = per_node.get(ob.name)
    if not specs:
        continue
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # ⚠ glTF 익스포터는 노멀 심에서 정점을 쪼갠다. 그대로 두면 **거의 모든 엣지가
    #   '면 1개'로 보여** 열린 경계로 오인된다(실측: 가짜 루프 6,351개). 먼저 용접한다.
    nv0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    welded_from_to = (nv0, len(bm.verts))
    bm.edges.ensure_lookup_table()
    report.setdefault("weld", {})[ob.name] = welded_from_to
    made_here = {}
    for loop in boundary_loops(bm):
        verts = {v for e in loop for v in e.verts}
        c = sum((v.co for v in verts), Vector()) / len(verts)
        # 이 루프가 어느 절단면의 것인가 — 중심이 가장 가까운 절단면, 반경의 2배 안일 때만
        # 매칭은 두 조건을 다 만족해야 한다 — (a) 루프가 그 평면 **위**에 있고
        # (b) 옆으로도 절단 반경 안이다. 중심거리만 보면 반바지 밑단처럼 평면에서
        # 벗어난 원래 경계가 잘못 걸린다.
        best, bd = None, 1e9
        for sp in specs:
            perp = abs((c - sp["center"]).dot(sp["normal"]))
            lat = ((c - sp["center"]) - sp["normal"] * (c - sp["center"]).dot(sp["normal"])).length
            if perp > 0.003 or lat > sp["radius"] * 2.5:
                continue
            if perp < bd:
                bd, best = perp, sp
        if best is None:
            report["skippedLoops"].append({"node": ob.name, "edges": len(loop),
                                           "centerLocal": [round(x, 5) for x in c],
                                           "nearestPlane": best["plane"] if best else None,
                                           "perpDistMm": round(bd * 1000, 1) if best else None,
                                           "reason": "절단면 근처가 아님 — 원래 열려 있던 경계(반바지 밑단·양말 끝 등)"})
            continue
        # 재질 — 루프에 인접한 면들의 최빈 material_index
        tally = {}
        for e in loop:
            for f in e.link_faces:
                tally[f.material_index] = tally.get(f.material_index, 0) + 1
        mat_idx = max(tally.items(), key=lambda kv: kv[1])[0] if tally else 0
        before = len(bm.faces)
        # ── 돔(타원체) 캡 — 몸통 반대쪽(관절 쪽)으로 부푼다
        cyc = ordered_cycle(loop)
        kind, dome_r, dome_h = "fan", None, None
        new_faces = []
        if cyc:
            body = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)   # 세그먼트 몸통 중심
            cC = sum((v.co for v in cyc), Vector()) / len(cyc)
            nrm = best["normal"].normalized()
            if nrm.dot(cC - body) < 0:
                nrm = -nrm                       # 반드시 몸통 **바깥** 을 향한다
            new_faces, dome_r, dome_h = build_dome(bm, cyc, nrm)
            kind = "dome"
        if not new_faces:
            res = bmesh.ops.holes_fill(bm, edges=loop, sides=0)
            new_faces = [f for f in res.get("faces", []) if f.is_valid]
            kind = "fan"
        if not new_faces:
            res = bmesh.ops.triangle_fill(bm, edges=loop, use_beauty=True, use_dissolve=False)
            new_faces = [f for f in res.get("geom", []) if isinstance(f, bmesh.types.BMFace)]
            kind = "fan"
        if not new_faces:
            report["skippedLoops"].append({"node": ob.name, "edges": len(loop),
                                           "plane": best["plane"], "reason": "채우기 실패(돔·holes_fill·triangle_fill 전부 0면)"})
            continue
        report.setdefault("capGeometry", {}).setdefault(ob.name, {})[best["plane"]] = {
            "kind": kind, "loopVerts": len(loop),
            "radiusMm": None if dome_r is None else round(dome_r * 1000, 2),
            "heightMm": None if dome_h is None else round(dome_h * 1000, 2)}
        bmesh.ops.triangulate(bm, faces=new_faces)
        bm.faces.ensure_lookup_table()
        added = [f for f in bm.faces if f.index >= before]
        for f in added:
            f.material_index = mat_idx
            f.smooth = True
        n = len(added)
        made_here[best["plane"]] = made_here.get(best["plane"], 0) + n
        report["perCutFace"][best["plane"]] = report["perCutFace"].get(best["plane"], 0) + n
        total += n
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    if made_here:
        report["perNode"][ob.name] = made_here
        print(f"  {ob.name}: {made_here}")

report["totalCapTriangles"] = total

# ── 폐합 검사 — 캡 후에도 절단면 근처에 열린 루프가 남았는가
still_open = []
for ob in bpy.data.objects:
    if ob.type != "MESH" or ob.name not in per_node:
        continue
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    for loop in boundary_loops(bm):
        verts = {v for e in loop for v in e.verts}
        c = sum((v.co for v in verts), Vector()) / len(verts)
        for sp in per_node[ob.name]:
            perp = abs((c - sp["center"]).dot(sp["normal"]))
            lat = ((c - sp["center"]) - sp["normal"] * (c - sp["center"]).dot(sp["normal"])).length
            if perp <= 0.003 and lat <= sp["radius"] * 2.5:
                still_open.append({"node": ob.name, "plane": sp["plane"], "edges": len(loop),
                                   "centerLocal": [round(x, 5) for x in c]})
    bm.free()
report["stillOpenNearCuts"] = still_open
report["allCutFacesClosed"] = len(still_open) == 0

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=False,
                          export_skins=False, export_yup=True, use_selection=True, export_apply=False)
with open(REPORT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print("cap triangles:", total, "| still open near cuts:", len(still_open))
print("saved", OUT)
