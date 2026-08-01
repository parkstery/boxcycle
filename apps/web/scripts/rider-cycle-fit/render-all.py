"""
라이더–사이클 피팅 **필수 렌더 전수 생성**(시각 보고 지시 §2·§3·§5).

fit_ik.py 를 헤드까지만 exec 해 장면·포즈 함수를 재사용하고, 여기서 필수 뷰를 전부 굽는다.
개발자가 카메라를 임의로 고르지 못하도록 뷰 목록은 required-views.mjs 정본을 읽는다.

실행:
  blender --background --python render-all.py -- <scale> <lean> <profile> <candidateId> <outDir> <inputHash> <jointsPath>

산출:
  <outDir>/<필수 id>.png            — 29장
  <outDir>/render-manifest.json     — 예상 목록 vs 실제 생성(§5)
  contact-sheet 는 make-contact-sheet.py 가 별도로 만든다(§3).
"""
import bpy, sys, os, json, subprocess

_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SCALE_S = _ARGV[0] if len(_ARGV) > 0 else "0.88"
LEAN_S = _ARGV[1] if len(_ARGV) > 1 else "78"
PROFILE_S = _ARGV[2] if len(_ARGV) > 2 else "hip"
CANDIDATE_ID = _ARGV[3] if len(_ARGV) > 3 else "unknown"
OUT_DIR = _ARGV[4] if len(_ARGV) > 4 else os.getcwd()
INPUT_HASH = _ARGV[5] if len(_ARGV) > 5 else "unknown"
JOINTS_PATH = _ARGV[6] if len(_ARGV) > 6 else None
# cycle GLB 오버라이드 — 프레임 후보(신프레임)를 결합 렌더에 쓰기 위함. 미지정 시 fit_ik.py 기본.
CYCLE_PATH = _ARGV[7] if len(_ARGV) > 7 else None

WF = r"C:\Users\kdrea\OneDrive\Documents\img\v2_4_cyclefit"
REPO = r"C:\20.HDev\boxcycle\apps\web"
VIEWS_MJS = os.path.join(REPO, "scripts", "rider-cycle-fit", "required-views.mjs")

os.makedirs(OUT_DIR, exist_ok=True)

# ── 뷰 정본을 node 로 읽어온다(정본 이중화 금지) ──
_dump = subprocess.run(
    ["node", os.path.join(REPO, "scripts", "rider-cycle-fit", "dump-views.mjs")],
    capture_output=True, text=True, check=True)
VIEWS = json.loads(_dump.stdout)
print("뷰 정본 로드: 필수 %d장" % len(VIEWS["required"]))

# ── fit_ik.py 헤드(장면 구성 + apply_phase/rotate_cranks/measure) 재사용 ──
sys.argv = ["blender", "--", SCALE_S, LEAN_S, PROFILE_S, "x"]
_src = open(os.path.join(WF, "fit_ik.py"), encoding="utf-8").read()
if JOINTS_PATH:
    _src = _src.replace(
        'JOINTS = WF + r"\\ik-joints-v2.json"',
        "JOINTS = r%r" % os.path.abspath(JOINTS_PATH))
if CYCLE_PATH:
    _src = _src.replace(
        'CYCLE = WF + r"\\cycle-only.glb"',
        "CYCLE = r%r" % os.path.abspath(CYCLE_PATH))
    print("cycle GLB 오버라이드: %s" % os.path.abspath(CYCLE_PATH))

# ── 크랭크 회전 대상 필터 교정(2026-08-01, F5 §1) ──────────────────────────
# fit_ik.py 원본 필터 `abs(cx) > 0.02`(전후 20mm 초과)는 **크랭크암의 BB쪽 끝단을 놓친다.**
# 실측: Mesh_146/147/149/152 는 fwd=0·lat=±58(스핀들 반폭)·BB 높이에 있어 이 조건에서 탈락한다.
# 그 결과 페달과 크랭크암 바깥쪽만 회전하고 BB 쪽 끝은 rest(수평)에 남아, 위상 렌더에서
# 크랭크가 끊겨 보이고 "발이 수평에 있다"는 오독을 유발했다(감리 F5 §1 지적의 실제 원인).
# 교정: 전후 거리 대신 **BB 중심으로부터의 반경**으로 판정한다. 크랭크계는 회전 반경
# (크랭크암 172.5mm + 페달 여유) 안에 있고 좌우로 스핀들 반폭(58mm) 이상 벌어져 있다.
# 프레임(중앙평면 |lat|<30)·시트스테이(위쪽)는 그대로 배제된다.
_OLD_FILTER = "if abs(cx) < 0.35 and cy < 0.5 and abs(cz) > 0.03 and abs(cx) > 0.02:"
_NEW_FILTER = ("if (abs(cx) < 0.35 and abs(cy - BB_UP) < 0.30 and abs(cz) > 0.03\n"
               "                    and ((cx * cx + (cy - BB_UP) ** 2) ** 0.5) < 0.30):")
if _OLD_FILTER not in _src:
    raise RuntimeError("크랭크 필터 치환 실패 — fit_ik.py 원본이 바뀌었다. 확인 필요.")
_src = _src.replace(_OLD_FILTER, _NEW_FILTER)
print("크랭크 회전 필터 교정 적용(BB 반경 기준) — BB쪽 크랭크암 끝단 포함")

# ── crank_rot 부호: fit_ik.py 정본(-crankDeg-90) 유지 (F6 §1 에서 F5 치환 철회) ──
# F5 는 `-crank_deg + 90` 으로 치환했으나 **그것이 좌우를 뒤집는 쪽이었다.**
# 해석 기하 검산(우크랭크 rest x=+172.5 수평, BB up=270.5):
#   rot = -cd - 90 → phase0 좌 98(BDC)/우 443(TDC), phase0.5 좌 443/우 98  ← joints 와 일치
#   rot = -cd + 90 → phase0 좌 443/우 98            , phase0.5 좌 98/우 443  ← 정확히 반대
# F5 주석의 전제("좌 페달축 BB원점 -172.5 = BDC")는 옳았으나 결론이 반대였다.
# 그 결과 오른발 BDC 를 요구한 phase 0.500 렌더에 rot=270°가 적용돼 **수평**으로 나왔다.
# 정본을 그대로 쓰므로 치환하지 않는다. 대신 아래 _assert_crank_phase() 로 매 렌더 검증한다.
print("crank_rot: fit_ik.py 정본(-crankDeg-90) 사용 — F5 부호 치환 철회(F6 §1)")

_cut = _src.index("SWEEP = len(_ARG)")
exec(compile(_src[:_cut], "fit_ik_head", "exec"), globals())

# ── 팬츠 판정색 RED (F5-1) ────────────────────────────────────────────────
# 팬츠(검정)와 안장(검정)이 렌더에서 구분되지 않아 착좌 위치를 육안 판정할 수 없었다.
# 팔레트 텍스처의 팬츠 셀 픽셀만 바꾼다 — 형상·치수·자세는 건드리지 않는다.
# RTW_RECOLOR_SHORTS=0 으로 끌 수 있다(구색 비교가 필요할 때).
if os.environ.get("RTW_RECOLOR_SHORTS", "1") != "0":
    _rc = os.path.join(r"C:\20.HDev\boxcycle\blender\rider-cycle-fit", "recolor-rider-shorts.py")
    _ns = {}
    exec(compile(open(_rc, encoding="utf-8").read(), "recolor_shorts", "exec"), _ns)
    _ns["recolor_shorts"]()

setup_render()
sc = bpy.context.scene
sc.render.resolution_x = 900
sc.render.resolution_y = 700

import datetime as _dt
# 렌더 루프 시작 시각 — 검증기가 "이미지가 이 시각 이후에 생성됐는가"로 재사용을 잡는다.
RENDER_STARTED_AT = _dt.datetime.now().isoformat(timespec="seconds")

_generated = []
_measures = {}

# ── 프레임 회귀 차단 assert (F7-A §1-3) ───────────────────────────────────
# F6 은 구프레임 GLB(7/30, MD5 78e61ce7…)로 렌더했는데 `geometry.json` 의 headTubeLength 85
# 는 맞았기 때문에 아무도 못 잡았다. **SSoT 수치가 맞아도 렌더에 쓰인 GLB 가 그 수치로
# 구워졌는지는 별개다.** 그래서 로드된 메시에서 직접 실측해 SSoT 와 대조한다.
_FRAME_ASSERT = {}


def _load_geometry():
    p = os.path.join(REPO, "src", "lib", "riderPrototype", "geometry.json")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _assert_frame(tol_mm=1.0):
    """헤드튜브 길이·탑튜브 후단 y 를 메시에서 실측해 geometry.json 과 대조."""
    g = _load_geometry()
    bb_up = g["bbHeight"] / 1000.0
    ht_mm = float(g["headTubeLength"])
    top = g["coords"]["headTop"]
    bot = g["coords"]["headBot"]
    HT = Vector((top[0] / 1000.0, 0.0, top[1] / 1000.0 + bb_up))
    HB = Vector((bot[0] / 1000.0, 0.0, bot[1] / 1000.0 + bb_up))
    u = (HT - HB).normalized()

    # 헤드튜브 = 축 위에 놓이고(perp 작음), 축 중심이 L/2 부근이며, 축길이가 L 인 관.
    dg = bpy.context.evaluated_depsgraph_get()
    best, best_err = None, 1e9
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data.vertices:
            continue
        ev = o.evaluated_get(dg)
        ws = [ev.matrix_world @ v.co for v in ev.data.vertices]
        c = sum(ws, Vector((0, 0, 0))) / len(ws)
        d = c - HB
        t = d.dot(u)
        perp = (d - u * t).length
        if perp > 0.010:
            continue
        ts = [(p - HB).dot(u) for p in ws]
        span = (max(ts) - min(ts)) * 1000.0
        err = abs(span - ht_mm) + abs(t * 1000.0 - ht_mm / 2.0)
        if err < best_err:
            best_err, best = err, (o.name, span, t * 1000.0)

    measured = None if best is None else round(best[1], 2)
    rec = {
        "headTubeExpectedMm": ht_mm,
        "headTubeMeasuredMm": measured,
        "headTubeMeshName": None if best is None else best[0],
        "toleranceMm": tol_mm,
    }
    # 탑튜브 후단(시트튜브 junction) y — riderRig 가 export 하면 그 값으로, 없으면 생략.
    stj = g.get("coords", {}).get("seatTubeJunction")
    if stj:
        rec["seatTubeJunctionExpectedMm"] = stj[1]
    rec["pass"] = measured is not None and abs(measured - ht_mm) <= tol_mm
    _FRAME_ASSERT.update(rec)
    print("  [프레임검증] 헤드튜브 실측 %s / SSoT %.1f mm (±%.1f)  mesh=%s  %s" % (
        measured, ht_mm, tol_mm, rec["headTubeMeshName"],
        "OK" if rec["pass"] else "FAIL"))
    if not rec["pass"]:
        raise RuntimeError(
            "프레임 회귀 감지: 헤드튜브 실측 %s mm ≠ geometry.json %.1f mm. "
            "구프레임 GLB 로 렌더하고 있다(F6 반려 사유). cycle GLB 를 확인하라."
            % (measured, ht_mm))


_assert_frame()


# ── joints 신선도 검사 (F9 §3-3) ──────────────────────────────────────────
# F9 에서 드러난 사고: OneDrive `ik-joints-v2.json` 이 7/30 자로 낡아 shin 420·hipDrop 65
# 를 들고 있는데도 렌더는 성공했다. 구프레임 GLB 와 **같은 종류의 사고**다.
# 입력이 낡으면 렌더 자체를 막는다.
_JOINTS_FRESH = {}


def _assert_joints_fresh(tol_mm=1.0):
    g = _load_geometry()
    bb_up = g["bbHeight"]
    saddle = g["coords"]["saddle"]
    # joints 의 saddleContact 는 지면좌표(mm). geometry 는 BB원점 → bbHeight 를 더해 비교.
    want_saddle_y = saddle[1] + bb_up
    got_saddle = JD.get("saddleContact")
    got_saddle_y = None if not got_saddle else float(got_saddle[1])
    shin_mm = JD.get("v2Bones", {}).get("shin")
    shin_mm = None if shin_mm is None else shin_mm * 1000.0
    scale = JD.get("scale")
    rec = {
        "jointsPath": os.path.abspath(JOINTS_PATH) if JOINTS_PATH else None,
        "saddleContactYExpectedMm": round(want_saddle_y, 2),
        "saddleContactYMeasuredMm": None if got_saddle_y is None else round(got_saddle_y, 2),
        "shinAppliedMm": None if shin_mm is None else round(shin_mm, 2),
        "shinRestMm": None if (shin_mm is None or not scale) else round(shin_mm / scale, 1),
        "scale": scale,
        "hipDropMm": JD.get("hipDropMm"),
        "toleranceMm": tol_mm,
    }
    bad = []
    if got_saddle_y is None or abs(got_saddle_y - want_saddle_y) > tol_mm:
        bad.append("saddleContact.y %s ≠ geometry 파생 %.2f"
                   % (got_saddle_y, want_saddle_y))
    rec["pass"] = not bad
    _JOINTS_FRESH.update(rec)
    print("  [joints신선도] saddleContact.y %s / %.1f  shin %s(rest %s)  hipDrop %s  %s" % (
        rec["saddleContactYMeasuredMm"], want_saddle_y, rec["shinAppliedMm"],
        rec["shinRestMm"], rec["hipDropMm"], "OK" if rec["pass"] else "FAIL"))
    if bad:
        raise RuntimeError(
            "낡은 joints 감지: %s. 현재 geometry.json 으로 재생성하라(F9 §2)." % "; ".join(bad))


_assert_joints_fresh()


# ── 발–페달 접촉 assert (F9 §3-3, 이번 지시의 핵심) ────────────────────────
# "발이 안 닿는데 렌더는 성공"이 F6·F8 두 번 반복됐다. 닿지 않으면 실패로 처리한다.
_FOOT_CONTACT = {}


def _assert_foot_contact(pkey, tol_mm=5.0):
    """실제 발목(SHIN tail) 위치와 joints 의 발목 목표를 대조한다."""
    d = JD["phases"][pkey]
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    rec = {"phase": pkey, "toleranceMm": tol_mm, "sides": {}}
    bad = []
    for side in ("L", "R"):
        actual = eval_tail("SHIN_" + side)
        target = g2b(d["foot" + side])
        err = (actual - target).length * 1000.0
        rec["sides"][side] = {
            "ankleActualMm": vec_mm(actual),
            "ankleTargetMm": vec_mm(target),
            "errorMm": round(err, 2),
        }
        if err > tol_mm:
            bad.append("%s %.1fmm" % (side, err))
    rec["pass"] = not bad
    _FOOT_CONTACT[pkey] = rec
    print("  [발접촉] %s  좌 %.1fmm  우 %.1fmm  (허용 %.1f)  %s" % (
        pkey, rec["sides"]["L"]["errorMm"], rec["sides"]["R"]["errorMm"],
        tol_mm, "OK" if rec["pass"] else "FAIL"))
    if bad:
        raise RuntimeError(
            "발이 페달 목표에 닿지 않았다(%s): %s > 허용 %.1fmm. "
            "안장 높이·다리 길이·가정값 정합을 확인하라(F9 §3-3)." % (pkey, ", ".join(bad), tol_mm))


def _file_meta(path):
    """GLB 출처 기록용(F7-A §1-2) — 경로·해시·수정시각."""
    import hashlib
    if not path or not os.path.exists(path):
        return None
    raw = open(path, "rb").read()
    return {
        "path": os.path.abspath(path),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "md5": hashlib.md5(raw).hexdigest(),
        "bytes": len(raw),
        "mtime": _dt.datetime.fromtimestamp(
            os.path.getmtime(path)).isoformat(timespec="seconds"),
    }


def shoot(name, loc, look):
    cd = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    dd = (Vector(look) - Vector(loc)); dd.normalize()
    cam.rotation_euler = dd.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.use_stamp = True
    sc.render.use_stamp_note = True
    sc.render.use_stamp_date = False
    sc.render.use_stamp_time = False
    sc.render.use_stamp_render_time = False
    sc.render.use_stamp_frame = False
    sc.render.use_stamp_frame_range = False
    sc.render.use_stamp_memory = False
    sc.render.use_stamp_hostname = False
    sc.render.use_stamp_camera = False
    sc.render.use_stamp_lens = False
    sc.render.use_stamp_scene = False
    sc.render.use_stamp_marker = False
    sc.render.use_stamp_filename = False
    sc.render.stamp_note_text = "%s | SCALE %s | %s" % (
        CANDIDATE_ID, SCALE_S, name.replace("_", " "))
    # ⚠ 필수: 새 카메라의 matrix_world 는 즉시 반영되지 않는다. 갱신 없이 렌더하면
    #   카메라가 엉뚱한 방향을 본다(실측: 주시 대상이 화면좌표 (1.41,0.88,-0.34) =
    #   화면 밖·depth 음수 → 갱신 후 (0.50,0.50,0.60) 정중앙). 확대 뷰에서 대상이
    #   프레임 밖으로 사라지는 원인이었다.
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    path = os.path.join(OUT_DIR, name + ".png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    _generated.append(name)
    return path


def resolve_cam(view, anchors):
    """뷰 정의 → (loc, look).

    loc/look 이 직접 있으면 그대로. anchor+dir 이면 **앵커가 화면 정중앙**에 오도록
    앵커에서 dir 방향으로 dist 만큼 떨어진 곳에 카메라를 둔다(지시: 확대 패널은
    판정 대상 접점이 중앙에 없으면 렌더 실패로 처리).
    """
    if "loc" in view and view.get("loc") is not None:
        return view["loc"], view["look"]
    look = Vector(anchors[view["anchor"]])
    d = Vector(view["dir"]); d.normalize()
    dist = view.get("dist") or CLOSEUP_DIST
    loc = look + d * dist
    return list(loc), list(look)


CLOSEUP_DIST = VIEWS["closeupDist"]


_RIDER_MESH = next((x for x in bpy.data.objects
                    if x.type == "MESH" and "RIDER" in x.name.upper()), None)
_VGI = {g.name: g.index for g in _RIDER_MESH.vertex_groups} if _RIDER_MESH else {}
_FOOT_IDX = {}
for _s in ("L", "R"):
    _g = _VGI.get("FOOT_" + _s)
    if _g is not None:
        _FOOT_IDX[_s] = [v.index for v in _RIDER_MESH.data.vertices
                         if any(gg.group == _g and gg.weight > 0.5 for gg in v.groups)]


def foot_center(side):
    """현재 포즈에서 발 메시 중심(world). 확대 카메라가 겨냥할 실제 대상."""
    idx = _FOOT_IDX.get(side)
    if not idx:
        return None
    dg = bpy.context.evaluated_depsgraph_get()
    ev = _RIDER_MESH.evaluated_get(dg)
    me = ev.to_mesh()
    acc = Vector((0.0, 0.0, 0.0))
    for i in idx:
        acc += _RIDER_MESH.matrix_world @ me.vertices[i].co
    acc /= len(idx)
    ev.to_mesh_clear()
    return list(acc)


def anchors_for(pkey):
    """해당 위상의 실측 앵커. 페달축·발 중심은 위상마다 움직이므로 매번 갱신한다."""
    d = JD["phases"][pkey]
    a = dict(VIEWS["anchors"])
    a["pedalAxleL"] = list(g2b(d["pedalAxleL"]))
    a["pedalAxleR"] = list(g2b(d["pedalAxleR"]))
    a["bb"] = [0.0, 0.0, BB_UP]
    # 발 확대는 페달축이 아니라 발 메시 중심을 겨냥한다(발이 페달축 뒤로 크게 뻗어 잘림).
    for s in ("L", "R"):
        c = foot_center(s)
        a["footCenter" + s] = c if c else a["pedalAxle" + s]
    return a


def vec_mm(v):
    return [round(float(v.x) * 1000, 3),
            round(float(v.y) * 1000, 3),
            round(float(v.z) * 1000, 3)]


def scene_aabb(objects):
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != "MESH":
            continue
        ev = obj.evaluated_get(dg)
        for c in ev.bound_box:
            pts.append(ev.matrix_world @ Vector(c))
    if not pts:
        return None
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return {"minMm": vec_mm(lo), "maxMm": vec_mm(hi), "sizeMm": vec_mm(hi - lo)}


def point_measures(pkey):
    d = JD["phases"][pkey]
    result = {}
    for side in ("L", "R"):
        ankle = eval_tail("SHIN_" + side)
        ball = eval_tail("FOOT_" + side)
        cleat_contact = cleat_of(ankle)
        pedal = g2b(d["pedalAxle" + side])
        result[side] = {
            "ANKLE_CENTER_mm": vec_mm(ankle),
            "BALL_CENTER_mm": vec_mm(ball),
            "CLEAT_CONTACT_mm": vec_mm(cleat_contact),
            "PEDAL_AXLE_mm": vec_mm(pedal),
            "ballToPedalErrorMm": round((ball - pedal).length * 1000, 3),
            "cleatContactToPedalErrorMm": round((cleat_contact - pedal).length * 1000, 3),
        }
    return result


# ── 크랭크 위상 실측 검증(F6 §1-2) ────────────────────────────────────────
# "맞아 보인다"를 근거로 인정하지 않는다. 회전 직후 **페달 메시 실측 y** 가 joints 의
# pedalAxle 과 일치하는지 매번 확인하고, 어긋나면 렌더를 진행하지 않고 실패시킨다.
# 이 검증이 있었다면 F5 의 부호 치환이 즉시 드러났을 것이다.
_PHASE_ASSERT = {}


def _pedal_mesh_y(side):
    """회전이 적용된 페달 메시 중심의 up 좌표(mm, 지면원점). side='L'|'R'."""
    dg = bpy.context.evaluated_depsgraph_get()
    ys, cnt = 0.0, 0
    for o in bpy.data.objects:
        if o.type != "MESH" or o.parent is None or o.parent.name != "CRANK_PIVOT":
            continue
        ev = o.evaluated_get(dg)
        pts = [ev.matrix_world @ v.co for v in ev.data.vertices]
        if not pts:
            continue
        cy = sum(p.y for p in pts) / len(pts)
        # 페달 본체만(좌우로 충분히 벌어진 것). 크랭크암은 y 가 0 에 가깝다.
        if abs(cy) < 0.065:
            continue
        if (side == "L" and cy > 0) or (side == "R" and cy < 0):
            continue
        ys += sum(p.z for p in pts) / len(pts)
        cnt += 1
    return None if cnt == 0 else round(ys / cnt * 1000, 1)


FULL_SIDE_DIST = 3.3   # 전신 정측면 카메라 거리(머리·양 바퀴가 프레임에 들어오는 실측값)


def bdc_lowpoint_measure(side):
    """발 최저점 vs 페달 최저점(F6 §1-2·§3-2).

    "닿지 않더라도 두 최저점 위치를 확인"하려는 계측이므로, 접촉 여부와 무관하게
    두 최저점의 절대 좌표와 **수직거리**를 낸다. 양수 = 발이 페달보다 위.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    out = {"side": side}
    idx = _FOOT_IDX.get(side)
    if idx and _RIDER_MESH is not None:
        ev = _RIDER_MESH.evaluated_get(dg)
        me = ev.to_mesh()
        pts = [_RIDER_MESH.matrix_world @ me.vertices[i].co for i in idx]
        lo = min(pts, key=lambda p: p.z)
        out["footLowestMm"] = vec_mm(lo)
        ev.to_mesh_clear()
    ped = []
    for o in bpy.data.objects:
        if o.type != "MESH" or o.parent is None or o.parent.name != "CRANK_PIVOT":
            continue
        e2 = o.evaluated_get(dg)
        ps = [e2.matrix_world @ v.co for v in e2.data.vertices]
        if not ps:
            continue
        cy = sum(p.y for p in ps) / len(ps)
        if abs(cy) < 0.065:
            continue
        if (side == "L" and cy > 0) or (side == "R" and cy < 0):
            continue
        ped += ps
    if ped:
        lo = min(ped, key=lambda p: p.z)
        out["pedalLowestMm"] = vec_mm(lo)
    if out.get("footLowestMm") and out.get("pedalLowestMm"):
        out["verticalGapMm"] = round(out["footLowestMm"][2] - out["pedalLowestMm"][2], 1)
        out["note"] = "양수=발 최저점이 페달 최저점보다 위. 접촉 여부와 무관한 위치 계측."
    return out


def _assert_crank_phase(pkey, tol_mm=12.0):
    d = JD["phases"][pkey]
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    rec = {"crankDeg": d["crankDeg"], "appliedRotDeg": crank_rot(d["crankDeg"])}
    bad = []
    for side in ("L", "R"):
        want = float(d["pedalAxle" + side][1])          # joints(지면원점 mm)
        got = _pedal_mesh_y(side)
        rec["expected" + side] = want
        rec["measured" + side] = got
        rec["delta" + side] = None if got is None else round(got - want, 1)
        if got is None or abs(got - want) > tol_mm:
            bad.append("%s: joints %.1f vs mesh %s" % (side, want, got))
    rec["pass"] = not bad
    _PHASE_ASSERT[pkey] = rec
    print("  [위상검증] %s crank%5d° rot%6.1f°  좌 %s/%s  우 %s/%s  %s" % (
        pkey, d["crankDeg"], rec["appliedRotDeg"],
        rec["measuredL"], rec["expectedL"], rec["measuredR"], rec["expectedR"],
        "OK" if rec["pass"] else "FAIL"))
    if bad:
        raise RuntimeError("크랭크 위상 불일치(%s): %s" % (pkey, "; ".join(bad)))


# ── Static Fit: crank 0° 자세로 Rider Only 4방향 + 결합 7방향 + 접점 확대 ──
apply_phase("0.000")
rotate_cranks(crank_rot(JD["phases"]["0.000"]["crankDeg"]))
_assert_crank_phase("0.000")
_measures["static"] = {k: round(v, 1) for k, v in measure("0.000")}
print("[Static] " + "  ".join("%s=%.0fmm" % (k, v) for k, v in measure("0.000")))
_anch = anchors_for("0.000")
_cycle_meshes = [o for o in bpy.data.objects if o.type == "MESH" and o not in v2objs]
for o in _cycle_meshes:
    o.hide_render = True
for v in VIEWS["riderOnlyViews"]:
    loc, look = resolve_cam(v, _anch)
    shoot("RIDER_ONLY_" + v["id"], loc, look)
for o in _cycle_meshes:
    o.hide_render = False
for v in VIEWS["staticViews"] + VIEWS["staticCloseups"]:
    loc, look = resolve_cam(v, _anch)
    shoot("STATIC_" + v["id"], loc, look)

# ── Pedal Fit: 4위상 × 4뷰 ──
for p in VIEWS["phases"]:
    pkey, deg = p["key"], p["deg"]
    apply_phase(pkey)
    rotate_cranks(crank_rot(JD["phases"][pkey]["crankDeg"]))
    _assert_crank_phase(pkey)
    _assert_foot_contact(pkey)
    _measures["phase_%d" % deg] = {k: round(v, 1) for k, v in measure(pkey)}
    _measures["phase_%d_points" % deg] = point_measures(pkey)
    print("[%3d°] " % deg + "  ".join("%s=%.0fmm" % (k, v) for k, v in measure(pkey)))
    _anch = anchors_for(pkey)
    for v in VIEWS["phaseViews"]:
        loc, look = resolve_cam(v, _anch)
        shoot("PHASE_%d_%s" % (deg, v["id"]), loc, look)

    # ── F6 §1-2: 오른발 BDC 정측면 + 최저점 확대 ──
    # phase 0.500 = 오른발 BDC(98) · 왼발 TDC(443). 감리 차단 조건.
    if pkey == "0.500":
        # ⚠ 카메라는 **우측면**(+y)이어야 한다. 좌측면에서는 오른쪽 크랭크·페달이
        #   프레임과 좌측 크랭크에 가려 "두 발이 수평"으로 오독된다(F5→F6 재발 원인).
        #   오른발이 BDC 임을 눈으로 확인하려면 오른쪽에서 봐야 한다.
        shoot("FULL_BDC_R", [0, FULL_SIDE_DIST, 0.72], [0, 0, 0.72])
        # 좌측면도 함께 남겨 좌우 대칭(왼발 TDC)을 같이 확인한다.
        shoot("FULL_BDC_R_SIDE_L", [0, -FULL_SIDE_DIST, 0.72], [0, 0, 0.72])
        _measures["bdcRight"] = bdc_lowpoint_measure("R")
        lp = _measures["bdcRight"]
        # 발/페달 최저점을 한 화면에. 두 최저점 중간을 겨냥해 둘 다 보이게 한다.
        if lp.get("footLowestMm") and lp.get("pedalLowestMm"):
            mid_z = (lp["footLowestMm"][2] + lp["pedalLowestMm"][2]) / 2000.0
            mid_x = (lp["footLowestMm"][0] + lp["pedalLowestMm"][0]) / 2000.0
            # 오른발이므로 우측(+y)에서. 좌측에서 보면 왼쪽 페달·크랭크가 앞을 가린다.
            shoot("BDC_R_LOWPOINT",
                  [mid_x + 0.30, 0.95, mid_z + 0.26], [mid_x, 0.074, mid_z])
        print("  [BDC우] 발최저 %s / 페달최저 %s / 수직거리 %s mm" % (
            lp.get("footLowestMm"), lp.get("pedalLowestMm"), lp.get("verticalGapMm")))

# ── render-manifest.json (§5) ──
import hashlib
import datetime


def png_meta(path):
    """PNG 해시·크기·해상도·생성시각. 빈/재사용 이미지를 검증기가 잡을 근거."""
    raw = open(path, "rb").read()
    w = h = None
    # PNG IHDR: 8바이트 시그니처 + 4(len) + 4("IHDR") 뒤 8바이트가 width/height
    if raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[12:16] == b"IHDR":
        w = int.from_bytes(raw[16:20], "big")
        h = int.from_bytes(raw[20:24], "big")
    return {
        "sha256": hashlib.sha256(raw).hexdigest()[:16],
        "bytes": len(raw),
        "width": w,
        "height": h,
        "mtime": datetime.datetime.fromtimestamp(
            os.path.getmtime(path)).isoformat(timespec="seconds"),
    }


required = VIEWS["required"]
missing = [r for r in required if r not in _generated]
extra = [g for g in _generated if g not in required]
images = {}
for name in _generated:
    p = os.path.join(OUT_DIR, name + ".png")
    if os.path.exists(p):
        images[name] = png_meta(p)

# 동일 해시 = 서로 다른 뷰인데 그림이 같다 → 카메라 미적용 의심(검증기가 실패 처리)
_byhash = {}
for n, m in images.items():
    _byhash.setdefault(m["sha256"], []).append(n)
dup = {k: v for k, v in _byhash.items() if len(v) > 1}

manifest = {
    "candidateId": CANDIDATE_ID,
    "inputHash": INPUT_HASH,
    # 렌더 루프 **시작** 시각. 이미지 mtime 은 이보다 뒤여야 한다(이전 후보 재사용 차단).
    "renderStartedAt": RENDER_STARTED_AT,
    "renderedAt": datetime.datetime.now().isoformat(timespec="seconds"),
    "params": {
        "scale": SCALE_S,
        "lean": LEAN_S,
        "profile": PROFILE_S,
        "commonAssumptionsUnconfirmed": {
            "ANKLE_BACK_mm": 149.4,
            "ANKLE_UP_mm": 81.0,
            "hipDrop_mm": 65.0,
        },
        "locked": ["pelvis reference", "world axes", "saddle", "frame", "handlebar",
                   "crank geometry", "IK tuning"],
    },
    "outDir": OUT_DIR,
    "resolution": [sc.render.resolution_x, sc.render.resolution_y],
    "required": required,
    "generated": _generated,
    "missing": missing,
    "extra": extra,
    "images": images,
    "duplicateHashes": dup,
    "coordinateSystem": {
        "blender": "metres; +x forward, +y lateral, +z up",
        "sourceGltf": "millimetres; +x forward, +y up, +z left",
        "g2b": "[x/1000, -z/1000, y/1000]",
    },
    "referencePoint": {"name": "HIP_MID", "worldMm": vec_mm(HIP_MID)},
    "appliedTransform": {
        "pivotMatrixWorld": [[round(float(x), 9) for x in row] for row in pivot.matrix_world],
        "armatureMatrixWorld": [[round(float(x), 9) for x in row] for row in arm.matrix_world],
    },
    "aabb": {
        "rider": scene_aabb([o for o in v2objs if o.type == "MESH"]),
        "cycle": scene_aabb(_cycle_meshes),
        "combined": scene_aabb([o for o in bpy.data.objects if o.type == "MESH"]),
    },
    "jointDistancesMm": {
        "hipWidth": round((eval_head("THIGH_L") - eval_head("THIGH_R")).length * 1000, 3),
        "shoulderWidth": round((eval_head("UPPER_ARM_L") - eval_head("UPPER_ARM_R")).length * 1000, 3),
        "thighL": round(arm.pose.bones["THIGH_L"].bone.length * SCALE * 1000, 3),
        "shinL": round(arm.pose.bones["SHIN_L"].bone.length * SCALE * 1000, 3),
        "footL": round(arm.pose.bones["FOOT_L"].bone.length * SCALE * 1000, 3),
        "torsoHipToShoulderL": round((eval_head("THIGH_L") - eval_head("UPPER_ARM_L")).length * 1000, 3),
    },
    "measures": _measures,
    # F6 §1-2: "눈으로 맞아 보인다"를 인정하지 않으므로 위상 실측 증명을 남긴다.
    "crankPhaseAssertions": _PHASE_ASSERT,
    # F7-A §1-3: 렌더에 쓰인 GLB 가 SSoT 수치로 구워졌는지 실측 증명.
    "frameAssertions": _FRAME_ASSERT,
    # F9 §3-3: 발이 실제로 페달 목표에 닿았는가 — 닿지 않으면 렌더가 중단된다.
    "footContactAssertions": _FOOT_CONTACT,
    # F9 §2: joints 가 현재 geometry 로 재생성된 것인가(낡은 입력 재사용 차단).
    "jointsFreshness": _JOINTS_FRESH,
    # F7-A §1-2: 어떤 자전거·라이더로 렌더했는지 사후 감리가 가능하도록 출처를 남긴다.
    #   F6 은 이 기록이 없어 구프레임 렌더를 사후에 특정하기 어려웠다.
    "inputAssets": {
        "cycleGlb": _file_meta(globals().get("CYCLE")),
        "riderGlb": _file_meta(globals().get("V2")),
        "jointsJson": _file_meta(JOINTS_PATH),
    },
    "jointAngles": {
        ("phase_%d" % p["deg"]): {
            "kneeDegL": JD["phases"][p["key"]]["kneeDegL"],
            "kneeDegR": JD["phases"][p["key"]]["kneeDegR"],
            "elbowDegL": JD["phases"][p["key"]]["elbowDegL"],
        } for p in VIEWS["phases"]
    },
    "contactSheets": [],
}
with open(os.path.join(OUT_DIR, "render-manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print("\n생성 %d장 / 필수 %d장  누락 %d  초과 %d"
      % (len(_generated), len(required), len(missing), len(extra)))
if missing:
    print("누락:", missing)
