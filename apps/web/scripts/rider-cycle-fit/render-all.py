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

# ── 좌/우 라벨 반전 교정 + 발볼 목표 교정 (F10-B) ──────────────────────────
# **F9 "무릎 32mm 어긋남"의 진짜 원인.** 두 층의 좌/우 라벨이 서로 반대다.
#   실측(Blender world mm, 배치 후 rest):
#     rider 본 THIGH_L head  y = +81.4   |  joints hipL(g2b) y = -81.4
#     |THIGH_L head - g2b(kneeL)| = 410.41 > 허벅지 378.40  → **도달 불가**
#     |THIGH_L head - g2b(kneeR)| = 378.40 = 허벅지          → 이쪽이 정답 짝
#   즉 `aim_bone("THIGH_L", kneeL)` 은 다리를 **몸 반대편으로** 조준한다. 닿을 수 없으니
#   본은 그 방향으로 378.4mm 만 가서 멈추고(무릎이 32mm 어긋남), SHIN 이 그 잘못된 무릎에서
#   발목을 겨눠 29.2mm 가 남는다. F9 실측 무릎(-182.6,-65.2,514.4)·발목(-215.2,-73.3,164.1)이
#   이 모델로 **소수점까지 재현**된다 — solver 차이(감리 §3-2 가정)가 아니다.
#
# 파이프라인 규약은 건드리지 않는다: joints·자전거 페달 메시·required-views 앵커·카메라는
# 이미 서로 일치한다("L" = Blender -y). **어긋난 것은 rider 본 이름 하나뿐**이므로,
# rider 본을 만지는 지점에서만 BONE_OF 로 변환한다(하드코딩 아님 — 부호 실측으로 결정).
_SUBS = [
    ("다리 aim: joints side → rider 본 side",
     '    for side in ("L", "R"):\n'
     '        aim_bone("THIGH_" + side, g2b(d["knee" + side]))\n'
     '        aim_bone("SHIN_" + side, g2b(d["foot" + side]))\n',
     '    for side in ("L", "R"):\n'
     '        bs = BONE_OF[side]   # ⚠ side 는 joints 규약, 본 이름은 반대일 수 있다(F10-B)\n'
     '        aim_bone("THIGH_" + bs, g2b(d["knee" + side]))\n'
     '        aim_bone("SHIN_" + bs, g2b(d["foot" + side]))\n'),
    ("발 aim: 발볼을 페달축 **위 BALL_LIFT** 로 조준",
     '    for side in ("L", "R"):\n'
     '        # 발볼(FOOT tail)이 페달축에 오도록 조준. json 의 pedalAxle* 가 페달축 정본이다.\n'
     '        akey = "pedalAxle" + side\n'
     '        cleat = g2b(d[akey]) if akey in d else cleat_of(eval_tail("SHIN_" + side))\n'
     '        aim_bone("FOOT_" + side, cleat)\n'
     '        # TOE 는 클릿에서 발끝 방향(앞·수평)으로 — 발이 페달을 감싸는 자연스러운 각.\n'
     '        aim_bone("TOE_" + side, cleat + Vector((TOE_AIM_FWD, 0.0, -TOE_AIM_DOWN)))\n',
     '    for side in ("L", "R"):\n'
     '        bs = BONE_OF[side]\n'
     '        # 발볼(FOOT tail)은 **페달축 위 BALL_LIFT**. 발볼을 페달축에 직접 두면\n'
     '        # 밑창·클릿 두께만큼 발이 페달을 관통한다(ball_target 는 JD 에서 역산).\n'
     '        tgt = ball_target(d, side)\n'
     '        aim_bone("FOOT_" + bs, tgt)\n'
     '        aim_bone("TOE_" + bs, tgt + Vector((TOE_AIM_FWD, 0.0, -TOE_AIM_DOWN)))\n'),
    ("measure 발목: 본 side 변환",
     '    for side, key in (("L", "footL"), ("R", "footR")):\n'
     '        out.append(("발목"+side, (eval_tail("SHIN_" + side) - g2b(d[key])).length * 1000))\n',
     '    for side in ("L", "R"):\n'
     '        out.append(("발목"+side, (eval_tail("SHIN_" + BONE_OF[side])\n'
     '                                 - g2b(d["foot" + side])).length * 1000))\n'),
    ("measure 클릿 → 발볼(실제 접점): 본 side 변환 + BALL_LIFT 목표",
     '    for side, key in (("L", "pedalAxleL"), ("R", "pedalAxleR")):\n'
     '        if key not in d:\n'
     '            continue\n'
     '        out.append(("클릿"+side, (eval_tail("FOOT_" + side) - g2b(d[key])).length * 1000))\n',
     '    for side in ("L", "R"):\n'
     '        if ("pedalAxle" + side) not in d:\n'
     '            continue\n'
     '        out.append(("발볼"+side, (eval_tail("FOOT_" + BONE_OF[side])\n'
     '                                 - ball_target(d, side)).length * 1000))\n'),
]
for _label, _old, _new in _SUBS:
    if _old not in _src:
        raise RuntimeError("치환 실패(%s) — fit_ik.py 원본이 바뀌었다. 확인 필요." % _label)
    _src = _src.replace(_old, _new)
    print("치환 적용: %s" % _label)

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


# ── 【F10-B 핵심】 라이더 GLB 내장 애니메이션 제거 ─────────────────────────
# **F5·F6·F8·F9 에서 반복된 "계산은 0mm 인데 렌더는 미달"의 진짜 원인.**
#
# 라이더 GLB 는 액션 `Pedal_Loop`·`Riding_Idle` 을 들고 오며 `Pedal_Loop` 이 armature 에
# **활성 상태로 할당**돼 있다(NLA 트랙 2개 포함). `bpy.ops.render.render()` 는 렌더 직전
# 씬을 프레임 평가하는데, 그때 애니메이션 시스템이 **우리가 세운 IK 포즈를 덮어쓴다.**
#
# 실측(F10-B, diag-when):
#   apply_phase("0.500") 직후 : 발볼 본 tail (  0.37, 74.00, 117.87)  발 최저 z 103.12  ← 정확
#   렌더 1회 뒤              : 발볼 본 tail (181.77, 67.36, 325.84)  발 최저 z 271.47  ← 뒤바뀜
#   렌더 2회 뒤              : 동일(한 번 덮이면 그대로 남는다)
# 즉 **계측은 우리 포즈를, 이미지는 GLB 애니메이션을 보고 있었다.** assert 가 PASS 인데
# 그림에서 발이 페달에 없던 이유가 이것이다. 포즈를 세우기 전에 반드시 끊는다.
if arm.animation_data is not None:
    _acts = [t.name for t in arm.animation_data.nla_tracks]
    _cur = getattr(arm.animation_data.action, "name", None)
    arm.animation_data_clear()
    bpy.context.view_layer.update()
    print("  [애니제거] 라이더 armature 애니메이션 해제 — action=%s nla=%s "
          "(렌더 시 IK 포즈를 덮어쓰던 원인)" % (_cur, _acts))
    _ANIM_STRIPPED = {"action": _cur, "nlaTracks": _acts}
else:
    _ANIM_STRIPPED = None


# ── joints side → rider 본 side (F10-B) ───────────────────────────────────
# 하드코딩하지 않는다. 배치된 본의 **좌우 부호를 실측**해 정한다 —
# 팔이 후드를 고르는 방식(`sh.y * HOOD_L.y > 0`)과 같은 원리다. 자산이 바뀌어도 자동 정합.
def _resolve_bone_of():
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    bone_l = eval_head("THIGH_L")
    joint_l = g2b(JD["hipL"])
    same = (bone_l.y * joint_l.y) > 0
    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()
    m = {"L": "L", "R": "R"} if same else {"L": "R", "R": "L"}
    print("  [좌우매핑] joints L→본 %s, joints R→본 %s   "
          "(THIGH_L y=%+.1f / joints hipL y=%+.1f mm)"
          % (m["L"], m["R"], bone_l.y * 1000, joint_l.y * 1000))
    return m


BONE_OF = _resolve_bone_of()


# ── 발 뼈를 **메시 발볼 실측**에 맞춘다 (F10-B) ────────────────────────────
# fit_ik.py 의 `resize_feet` 는 FOOT rest 169.8mm(=world 149.4)로 줄이는데, joints 가
# 요구하는 발목→페달축 거리는 **221.06mm** 다. 71.6mm 가 구조적으로 모자라 발볼이
# 페달에 영영 닿지 못한다(F9 로그 "클릿L=76mm 클릿R=81mm" 의 정체).
#
# 원인은 길이만이 아니다. FOOT 본의 rest **방향**도 메시 발볼 방향과 12.7° 어긋나 있어
# 본을 조준해도 메시는 다른 곳을 본다. 그래서 본 tail 을 **메시 발볼 위치 그 자체**로
# 재정의한다 — 그러면 본 축 = 발목→발볼이 되어 조준한 곳에 메시 발볼이 정확히 간다.
# rest 상태에서 edit_bone 을 옮기는 것은 메시를 변형하지 않는다(rest 에서 deform = I).
_BALL_DROP = {}   # 본 side → rest 에서 발목 대비 발볼 하강량(m)
_BALL_VIDX = {}   # 본 side → rest 에서 발볼로 판정된 정점 index 목록(포즈 추적용)


def _mesh_ball_world(rider, me, bone_side):
    """rest 발 메시의 발볼 지점 = 전방 밴드(x 상위 25% 중 z 하위 25%)의 **중심(centroid)**.

    ⚠ measure-assumptions.py(F8)는 같은 밴드의 **좌표별 median** 을 쓴다. 그 값은 x·y·z 를
      따로 중앙값 내는 합성점이라 실제 메시 위의 점도, 밴드의 중심도 아니다 —
      실측(F10-B): median 은 밴드 중심에서 좌우로 **41.8mm 편심**한다(발 폭이 86mm 인데
      median y=123.2, 밴드 정점은 y 44~130).
      그 편심점을 본 축(tail)으로 삼으면 조준할 때 발 전체가 축을 중심으로 비틀려,
      본은 목표에 닿는데 **메시는 76mm 벗어난다**(F10-B 1차 렌더에서 실제로 발생).
    centroid 는 강체변환에 대해 equivariant 하므로(median 은 아니다) 본을 조준하면
    메시 중심이 목표에 **정확히** 간다 — 이 성질이 접점 판정의 전제다.
    """
    vgi = {g.name: g.index for g in rider.vertex_groups}
    gi = vgi.get("FOOT_" + bone_side)
    if gi is None:
        return None, None
    idx = [v.index for v in rider.data.vertices
           if any(g.group == gi and g.weight > 0.5 for g in v.groups)]
    pts = [rider.matrix_world @ me.vertices[i].co for i in idx]
    if not pts:
        return None, None
    ipts = list(zip(idx, pts))
    xs = sorted(p.x for p in pts)
    fwd = [(i, p) for i, p in ipts if p.x >= xs[int(len(xs) * 0.75)]]
    zs = sorted(p.z for _, p in fwd)
    band = [(i, p) for i, p in fwd if p.z <= zs[int(len(zs) * 0.25)]] or fwd
    bp = [p for _, p in band]
    ball = sum(bp, Vector((0.0, 0.0, 0.0))) / len(bp)
    # 같은 정점을 포즈에서도 추적해 "메시가 본을 따라왔는가"를 판정한다(F10-B).
    _BALL_VIDX[bone_side] = [i for i, _ in band]
    tip = max(pts, key=lambda p: p.x)          # 발끝 = 최전방 정점
    gi_toe = vgi.get("TOE_" + bone_side)
    if gi_toe is not None:
        tidx = [v.index for v in rider.data.vertices
                if any(g.group == gi_toe and g.weight > 0.5 for g in v.groups)]
        tpts = [rider.matrix_world @ me.vertices[i].co for i in tidx]
        if tpts:
            tip = max(tpts, key=lambda p: p.x)
    return ball, tip


def refit_foot_bones():
    rider = next((o for o in bpy.data.objects
                  if o.type == "MESH" and "RIDER" in o.name.upper()), None)
    if rider is None:
        print("  [발뼈재정의] rider 메시 없음 — 건너뜀"); return
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = rider.evaluated_get(dg).data
    plan = {}
    for bs in ("L", "R"):
        ankle = eval_tail("SHIN_" + bs)
        ball, tip = _mesh_ball_world(rider, me, bs)
        if ball is None:
            continue
        plan[bs] = (ball.copy(), tip.copy())
        _BALL_DROP[bs] = ankle.z - ball.z

    w2a = arm.matrix_world.inverted()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bs, (ball, tip) in plan.items():
        fb = arm.data.edit_bones.get("FOOT_" + bs)
        if fb is None:
            continue
        fb.tail = w2a @ ball
        tb = arm.data.edit_bones.get("TOE_" + bs)
        if tb is not None:
            tb.head = w2a @ ball
            tb.tail = w2a @ tip
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.data.pose_position = "POSE"
    bpy.context.view_layer.update()
    for bs in plan:
        print("  [발뼈재정의] FOOT_%s world %.2fmm (구 149.42) / TOE_%s %.2fmm / 발볼하강 %.2fmm"
              % (bs, arm.pose.bones["FOOT_" + bs].bone.length * SCALE * 1000,
                 bs, arm.pose.bones["TOE_" + bs].bone.length * SCALE * 1000,
                 _BALL_DROP[bs] * 1000))


refit_foot_bones()


# ── 발볼 목표 = 페달축 위 BALL_LIFT ───────────────────────────────────────
# joints 는 발목을 페달축 뒤 ANKLE_BACK · **위 ANKLE_UP** 에 둔다. ANKLE_UP 은
# "발바닥 22.0 + 밑창·클릿 15.0". 발볼(뼈)은 발목보다 _BALL_DROP 만큼 아래이므로,
# 발볼이 놓일 곳은 **페달축 위 (ANKLE_UP - BALL_DROP)** 이다.
# 상수로 박지 않고 JD·메시에서 매번 역산한다 — 선언값과 적용값이 갈라진 것이 anti#8 의 사고였다.
_d0 = JD["phases"]["0.000"]
ANKLE_UP_MM = round(float(_d0["footL"][1]) - float(_d0["pedalAxleL"][1]), 2)
ANKLE_BACK_MM = round(float(_d0["pedalAxleL"][0]) - float(_d0["footL"][0]), 2)
BALL_LIFT = {s: (ANKLE_UP_MM / 1000.0) - _BALL_DROP.get(BONE_OF[s], 0.0) for s in ("L", "R")}
print("  [발볼목표] ANKLE_BACK %.2f / ANKLE_UP %.2f (JD 역산)  →  페달축 위 L %.2f · R %.2f mm"
      % (ANKLE_BACK_MM, ANKLE_UP_MM, BALL_LIFT["L"] * 1000, BALL_LIFT["R"] * 1000))


def ball_target(d, side):
    """발볼(FOOT tail)이 놓여야 할 world — 페달축 바로 위 BALL_LIFT."""
    p = g2b(d["pedalAxle" + side])
    return Vector((p.x, p.y, p.z + BALL_LIFT[side]))


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
        bs = BONE_OF[side]
        actual = eval_tail("SHIN_" + bs)
        target = g2b(d["foot" + side])
        err = (actual - target).length * 1000.0
        # ⚠ 위 발목 오차는 **IK 도달**이지 접점이 아니다. 실제 발-페달 접점은
        #   발볼(FOOT tail)이 페달축 위 BALL_LIFT 에 왔는가로 판정한다(memory: fit-ik-measure-not-contact).
        ball = eval_tail("FOOT_" + bs)
        btgt = ball_target(d, side)
        ped = g2b(d["pedalAxle" + side])
        rec["sides"][side] = {
            "boneSide": bs,
            "ankleActualMm": vec_mm(actual),
            "ankleTargetMm": vec_mm(target),
            "errorMm": round(err, 2),
            "ballActualMm": vec_mm(ball),
            "ballTargetMm": vec_mm(btgt),
            "ballErrorMm": round((ball - btgt).length * 1000.0, 2),
            "ballAbovePedalAxleMm": round((ball.z - ped.z) * 1000.0, 2),
            "ballLiftExpectedMm": round(BALL_LIFT[side] * 1000.0, 2),
        }
        mb = mesh_ball_posed(bs)
        if mb is not None:
            rec["sides"][side]["meshBallMm"] = vec_mm(mb)
            rec["sides"][side]["meshBallVsBoneTailMm"] = round((mb - ball).length * 1000.0, 2)
            rec["sides"][side]["meshBallToPedalMm"] = round((mb - ped).length * 1000.0, 2)
        if err > tol_mm:
            bad.append("%s %.1fmm" % (side, err))
    rec["pass"] = not bad
    _FOOT_CONTACT[pkey] = rec
    print("  [발접촉] %s  발목 좌 %.1f / 우 %.1fmm (허용 %.1f)  %s   |  발볼(본) 좌 %.1f / 우 %.1f"
          "   |  발볼(메시)→페달 좌 %s / 우 %s   메시↔본 좌 %s / 우 %s" % (
              pkey, rec["sides"]["L"]["errorMm"], rec["sides"]["R"]["errorMm"],
              tol_mm, "OK" if rec["pass"] else "FAIL",
              rec["sides"]["L"]["ballErrorMm"], rec["sides"]["R"]["ballErrorMm"],
              rec["sides"]["L"].get("meshBallToPedalMm"), rec["sides"]["R"].get("meshBallToPedalMm"),
              rec["sides"]["L"].get("meshBallVsBoneTailMm"), rec["sides"]["R"].get("meshBallVsBoneTailMm")))
    # 발볼 오차는 이번 지시에서 **차단 조건이 아니다**(합격 기준 §3-3 은 발목 기준).
    # 다만 실제 접점이므로 크게 어긋나면 눈에 띄게 남긴다 — 차단 승격은 감리 판단.
    for side in ("L", "R"):
        if rec["sides"][side]["ballErrorMm"] > 10.0:
            print("  ⚠ [발볼경고] %s %s 발볼이 목표에서 %.1fmm — 접점 판정은 렌더로 확인하라"
                  % (pkey, side, rec["sides"][side]["ballErrorMm"]))
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
# ⚠ 키는 **파이프라인(joints) side** 다 — 앵커·카메라·페달 메시가 모두 그 규약이다.
#   정점 그룹만 rider 본 이름이므로 BONE_OF 로 뒤집어 읽는다(F10-B).
_FOOT_IDX = {}
for _s in ("L", "R"):
    _g = _VGI.get("FOOT_" + BONE_OF[_s])
    if _g is not None:
        _FOOT_IDX[_s] = [v.index for v in _RIDER_MESH.data.vertices
                         if any(gg.group == _g and gg.weight > 0.5 for gg in v.groups)]


def _fresh_dg():
    """⚠ 필수: 메시 실측 전 depsgraph 를 **강제 재평가**한다.

    갱신 없이 `evaluated_get` 하면 **이전 위상의 포즈**를 읽는다. 실측(F10-B):
    phase 0.500 에서 `bdc_lowpoint_measure` 가 발 최저점을 271.5mm 로 보고했는데
    실제는 103.1mm 였다 — 0.250 위상(크랭크 3시)의 발을 읽고 있었다. 그 값으로
    "발이 페달보다 183mm 위"라는 **허위 계측**이 보고서에 올라갈 뻔했다.
    카메라 matrix_world 함정(shoot 참조)과 같은 종류의 사고다.
    """
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    return dg


def foot_center(side):
    """현재 포즈에서 발 메시 중심(world). 확대 카메라가 겨냥할 실제 대상."""
    idx = _FOOT_IDX.get(side)
    if not idx:
        return None
    me = _RIDER_MESH.evaluated_get(_fresh_dg()).data
    acc = Vector((0.0, 0.0, 0.0))
    for i in idx:
        acc += _RIDER_MESH.matrix_world @ me.vertices[i].co
    acc /= len(idx)
    return list(acc)


def mesh_ball_posed(bone_side):
    """rest 에서 발볼로 판정된 **바로 그 정점들**의 현재 포즈 centroid(world).

    본 tail 과 이 값이 벌어지면 = 메시가 본을 따라오지 않는다는 뜻이다.
    본 좌표만 보고 "발이 닿았다"고 판정하는 것이 F6~F9 에서 반복된 오판의 형태다
    (memory: fit-ik-measure-not-contact). 접점 판정은 반드시 **메시**로 한다.
    """
    idx = _BALL_VIDX.get(bone_side)
    if not idx or _RIDER_MESH is None:
        return None
    me = _RIDER_MESH.evaluated_get(_fresh_dg()).data
    pts = [_RIDER_MESH.matrix_world @ me.vertices[i].co for i in idx]
    return sum(pts, Vector((0.0, 0.0, 0.0))) / len(pts)   # centroid — rest 정의와 동일해야 한다


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
        bs = BONE_OF[side]
        ankle = eval_tail("SHIN_" + bs)
        ball = eval_tail("FOOT_" + bs)
        pedal = g2b(d["pedalAxle" + side])
        # 클릿 접촉면 = 발볼 바로 아래 BALL_LIFT(=발바닥+클릿 두께). 이상적으로 페달축과 일치.
        cleat_contact = Vector((ball.x, ball.y, ball.z - BALL_LIFT[side]))
        result[side] = {
            "boneSide": bs,
            "ANKLE_CENTER_mm": vec_mm(ankle),
            "BALL_CENTER_mm": vec_mm(ball),
            "CLEAT_CONTACT_mm": vec_mm(cleat_contact),
            "PEDAL_AXLE_mm": vec_mm(pedal),
            "ballToPedalErrorMm": round((ball - pedal).length * 1000, 3),
            "cleatContactToPedalErrorMm": round((cleat_contact - pedal).length * 1000, 3),
        }
        # 무릎 내각 **실측**(계산값 재인용 금지) — 목표 BDC 10°.
        hip = eval_head("THIGH_" + bs)
        knee = eval_tail("THIGH_" + bs)
        a1 = (hip - knee).normalized()
        a2 = (ankle - knee).normalized()
        import math as _mt
        result[side]["kneeAngleMeasuredDeg"] = round(
            180.0 - _mt.degrees(_mt.acos(max(-1.0, min(1.0, a1.dot(a2))))), 2)
        result[side]["KNEE_mm"] = vec_mm(knee)
        # ⚠ 위는 전부 **본** 좌표다. 실제로 페달에 닿는 것은 메시이므로 같이 잰다.
        mb = mesh_ball_posed(bs)
        if mb is not None:
            result[side]["MESH_BALL_mm"] = vec_mm(mb)
            result[side]["meshBallVsBoneTailMm"] = round((mb - ball).length * 1000, 3)
            result[side]["meshBallToPedalErrorMm"] = round((mb - pedal).length * 1000, 3)
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
    dg = _fresh_dg()
    out = {"side": side}
    idx = _FOOT_IDX.get(side)
    if idx and _RIDER_MESH is not None:
        # ⚠ `ev.to_mesh()` 로 읽지 마라 — 렌더를 한 번이라도 거치면 **이전 위상의 메시**를
        #   돌려준다(F10-B 실측: phase 0.500 인데 0.250 의 발을 읽어 "페달보다 183mm 위"라는
        #   허위 계측이 나왔다. 실제는 5.1mm). 평가된 데이터블록 `.data` 를 직접 읽는다 —
        #   바로 아래 페달 계측이 처음부터 그렇게 하고 있어 페달 값만 늘 정확했다.
        me = _RIDER_MESH.evaluated_get(dg).data
        pts = [_RIDER_MESH.matrix_world @ me.vertices[i].co for i in idx]
        lo = min(pts, key=lambda p: p.z)
        out["footLowestMm"] = vec_mm(lo)
        # 같은 함수 안에서 발볼 centroid 와 AABB 를 같이 남긴다 — 두 계측이 어긋나면
        # 계측 자체를 의심해야 한다(F10-B 에서 실제로 어긋났다).
        out["footAabbMinMm"] = [round(min(p[i] for p in pts) * 1000, 2) for i in range(3)]
        out["footAabbMaxMm"] = [round(max(p[i] for p in pts) * 1000, 2) for i in range(3)]
        mb = mesh_ball_posed(BONE_OF[side])
        if mb is not None:
            out["meshBallMm"] = vec_mm(mb)
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
        # F9 에서 메시 실측값으로 교체됐다. **JD 에서 역산**하므로 선언값=적용값이 보장된다.
        "anklePlacement": {
            "ANKLE_BACK_mm": ANKLE_BACK_MM,
            "ANKLE_UP_mm": ANKLE_UP_MM,
            "hipDrop_mm": JD.get("hipDropMm"),
            "source": "ik-joints-v2.json 역산(F8 메시 실측 → F9 적용)",
        },
        # F10-B: 렌더 시 IK 포즈를 덮어쓰던 GLB 내장 애니메이션을 끊었다는 증거.
        "animationStripped": _ANIM_STRIPPED,
        # F10-B: 두 층의 좌/우 라벨이 반대라 다리가 몸을 가로질러 조준됐다. 부호 실측으로 교정.
        "sideMapping": {
            "jointsToRiderBone": BONE_OF,
            "note": "joints·페달메시·앵커·카메라는 'L'=Blender -y 로 일치. rider 본 이름만 반대.",
        },
        # 발볼(FOOT tail)이 놓일 페달축 위 높이 = ANKLE_UP - 발목대비 발볼 하강(메시 실측).
        "ballLiftMm": {s: round(BALL_LIFT[s] * 1000, 2) for s in ("L", "R")},
        "footBoneWorldMm": {
            bs: round(arm.pose.bones["FOOT_" + bs].bone.length * SCALE * 1000, 2)
            for bs in ("L", "R")
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
