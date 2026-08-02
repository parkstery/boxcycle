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
# F12: 골반 후방 경사(deg). 라이더를 강체로 뒤로 세운다. 0 = F11 이전과 동일 동작.
PELVIS_TILT_DEG = float(_ARGV[8]) if len(_ARGV) > 8 else 0.0
# F13: 상완 rest 길이(mm, 0 = 원본 유지). 팔꿈치 굽힘을 만들기 위해 늘린다.
# ⚠ F14 에서 신발 축소(F13-A)를 전면 취소하며 `SHOE_SCALE` 인자를 제거했다. 사용자가
#   "지시한 바 없는 신발 각도 변화"를 지적했고, 축소를 되돌리면 각도도 함께 되돌아간다
#   (발이 짧아지면 발 중심이 발목 쪽으로 당겨져 발목→접점 축이 가팔라지는 필연).
#   신발 관련 인자·함수를 되살리지 마라 — "취소"이지 "재설계"가 아니다.
UPPER_ARM_REST_MM = float(_ARGV[9]) if len(_ARGV) > 9 else 0.0

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

# ── 좌/우 라벨 반전 교정 + 접점 목표 교정 (F10-B) ──────────────────────────
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
    ("발 aim: 접점을 페달축 **위 CONTACT_LIFT** 로 조준",
     '    for side in ("L", "R"):\n'
     '        # 발볼(FOOT tail)이 페달축에 오도록 조준. json 의 pedalAxle* 가 페달축 정본이다.\n'
     '        akey = "pedalAxle" + side\n'
     '        cleat = g2b(d[akey]) if akey in d else cleat_of(eval_tail("SHIN_" + side))\n'
     '        aim_bone("FOOT_" + side, cleat)\n'
     '        # TOE 는 클릿에서 발끝 방향(앞·수평)으로 — 발이 페달을 감싸는 자연스러운 각.\n'
     '        aim_bone("TOE_" + side, cleat + Vector((TOE_AIM_FWD, 0.0, -TOE_AIM_DOWN)))\n',
     '    for side in ("L", "R"):\n'
     '        bs = BONE_OF[side]\n'
     '        # 접점(FOOT tail)은 **페달축 위 CONTACT_LIFT**. 접점을 페달축에 직접 두면\n'
     '        # 밑창·클릿 두께만큼 발이 페달을 관통한다(contact_target 는 JD 에서 역산).\n'
     '        tgt = contact_target(d, side)\n'
     '        aim_bone("FOOT_" + bs, tgt)\n'
     '        aim_bone("TOE_" + bs, tgt + Vector((TOE_AIM_FWD, 0.0, -TOE_AIM_DOWN)))\n'),
    ("골반 후방 경사(F12) — 라이더를 강체로 뒤로 세운다",
     '    lean = math.radians(LEAN_DEG)\n'
     '    for bn, fr in zip(("SPINE_01", "SPINE_02", "CHEST"), SPINE_FR):\n',
     '    # ── F12: 골반을 뒤로 눕혀 상체 전체를 강체로 세운다 ──────────────────\n'
     '    #   사용자 지시: "BDC 에 접한 발바닥을 중심축으로 오른쪽(주행 반대)으로 10도 회전".\n'
     '    #   PELVIS 는 SPINE·THIGH 의 부모라 여기서 돌리면 몸통·목·머리가 함께 강체로 돈다.\n'
     '    #   다리는 아래에서 페달 목표로 다시 aim 되므로 **발은 페달에 그대로 남는다**.\n'
     '    #   엉덩이 위치는 joints 의 hip 이 정하고 realign_saddle 이 맞춘다(회전과 독립).\n'
     '    #   부호: 로컬 X **음수** 가 뒤로 세우는 쪽(F12 실측 −10° → 몸통각 +10.00°).\n'
     '    if PELVIS_TILT_DEG:\n'
     '        _pp = arm.pose.bones["PELVIS"]; _pp.rotation_mode = "XYZ"\n'
     '        _pp.rotation_euler.x = math.radians(-PELVIS_TILT_DEG)\n'
     '        bpy.context.view_layer.update()\n'
     '        # ⚠ 필수: 골반이 돌면 그 자식인 THIGH head(고관절)가 HIP_MID 에서 벗어난다.\n'
     '        #   그 자리에서 무릎을 조준하면 본이 목표에 못 미쳐 발이 페달에서 떨어진다\n'
     '        #   (F12 실측: 이 재정렬이 없으면 발접촉 R 6.6mm FAIL). 다리 aim 전에 되돌린다.\n'
     '        realign_saddle()\n'
     '    lean = math.radians(LEAN_DEG)\n'
     '    for bn, fr in zip(("SPINE_01", "SPINE_02", "CHEST"), SPINE_FR):\n'),
    ("measure 발목: 본 side 변환",
     '    for side, key in (("L", "footL"), ("R", "footR")):\n'
     '        out.append(("발목"+side, (eval_tail("SHIN_" + side) - g2b(d[key])).length * 1000))\n',
     '    for side in ("L", "R"):\n'
     '        out.append(("발목"+side, (eval_tail("SHIN_" + BONE_OF[side])\n'
     '                                 - g2b(d["foot" + side])).length * 1000))\n'),
    ("measure 클릿 → 접점(실제 접점): 본 side 변환 + CONTACT_LIFT 목표",
     '    for side, key in (("L", "pedalAxleL"), ("R", "pedalAxleR")):\n'
     '        if key not in d:\n'
     '            continue\n'
     '        out.append(("클릿"+side, (eval_tail("FOOT_" + side) - g2b(d[key])).length * 1000))\n',
     '    for side in ("L", "R"):\n'
     '        if ("pedalAxle" + side) not in d:\n'
     '            continue\n'
     '        out.append(("접점"+side, (eval_tail("FOOT_" + BONE_OF[side])\n'
     '                                 - contact_target(d, side)).length * 1000))\n'),
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
#   apply_phase("0.500") 직후 : 접점 본 tail (  0.37, 74.00, 117.87)  발 최저 z 103.12  ← 정확
#   렌더 1회 뒤              : 접점 본 tail (181.77, 67.36, 325.84)  발 최저 z 271.47  ← 뒤바뀜
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


# ── 발 뼈를 **메시 접점 실측**에 맞춘다 (F10-B) ────────────────────────────
# fit_ik.py 의 `resize_feet` 는 FOOT rest 169.8mm(=world 149.4)로 줄이는데, joints 가
# 요구하는 발목→페달축 거리는 **221.06mm** 다. 71.6mm 가 구조적으로 모자라 접점이
# 페달에 영영 닿지 못한다(F9 로그 "클릿L=76mm 클릿R=81mm" 의 정체).
#
# 원인은 길이만이 아니다. FOOT 본의 rest **방향**도 메시 접점 방향과 12.7° 어긋나 있어
# 본을 조준해도 메시는 다른 곳을 본다. 그래서 본 tail 을 **메시 접점 위치 그 자체**로
# 재정의한다 — 그러면 본 축 = 발목→접점이 되어 조준한 곳에 메시 접점이 정확히 간다.
# rest 상태에서 edit_bone 을 옮기는 것은 메시를 변형하지 않는다(rest 에서 deform = I).
_CONTACT_DROP = {}   # 본 side → rest 에서 발목 대비 접점 하강량(m)
_CONTACT_VIDX = {}   # 본 side → rest 에서 접점로 판정된 정점 index 목록(포즈 추적용)


# ── 접점 위치는 JD 의 ANKLE_BACK 이 정한다 (F11) ───────────────────────────
# F10-R1 까지는 밴드를 "전방 x 상위 25%"로 **고정**했다. 그건 ANKLE_BACK 217.94(발끝)에
# 우연히 맞았을 뿐이고, F11 에서 접점이 발 중심(93.03)으로 옮겨지면 곧바로 어긋난다 —
# 218mm 짜리 본을 94mm 앞 목표로 조준하면 tail 이 124mm 지나쳐 발이 앞으로 삐져나오는데
# **발목 기준 assert 는 그래도 0.0mm 로 PASS 한다**(감리 §3-3 이 경고한 함정).
# 그래서 밴드를 **ANKLE_BACK 이 가리키는 x 위치**에서 잡는다. 상수 하드코딩이 아니라
# JD 역산이므로, ANKLE_BACK 을 바꾸면 접점·본 길이·CONTACT_LIFT 가 전부 따라온다.
_d0 = JD["phases"]["0.000"]
ANKLE_UP_MM = round(float(_d0["footL"][1]) - float(_d0["pedalAxleL"][1]), 2)
ANKLE_BACK_MM = round(float(_d0["pedalAxleL"][0]) - float(_d0["footL"][0]), 2)
_HEEL_VIDX = {}    # 본 side → 뒤꿈치 정점 index (포즈에서 발 중심·비율 산출용)
_TOE_VIDX = {}     # 본 side → 발끝 정점 index
_FOOT_LEN = {}     # 본 side → rest 발 길이(m, scale 후)
_HEEL_BACK = {}    # 본 side → 발목에서 뒤꿈치까지(m, rest)
_ANKLE_TO_SOLE = {}  # 본 side → 발목에서 밑창까지 수직(m, rest). 축 기울기 판정용.


def _mesh_contact_world(rider, me, bone_side, ankle):
    """rest 발 메시의 접점 = **발목에서 ANKLE_BACK 앞** 밴드 중 하부 25% 의 centroid.

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
    heel_x = min(p.x for p in pts)
    toe_x = max(p.x for p in pts)
    flen = toe_x - heel_x
    _FOOT_LEN[bone_side] = flen
    _HEEL_BACK[bone_side] = ankle.x - heel_x   # 발목 뒤 뒤꿈치까지(rest)
    _ANKLE_TO_SOLE[bone_side] = ankle.z - min(p.z for p in pts)   # 발목→밑창(rest)
    # 뒤꿈치·발끝 끝단(각 5%)을 추적해 포즈에서 발 중심·페달축 비율을 낸다(F11 §3-5).
    _HEEL_VIDX[bone_side] = [i for i, p in ipts if p.x <= heel_x + flen * 0.05]
    _TOE_VIDX[bone_side] = [i for i, p in ipts if p.x >= toe_x - flen * 0.05]
    # 접점 밴드 = ANKLE_BACK 이 가리키는 x 위치 ±8% 중 하부 25%(밑창쪽).
    target_x = ankle.x + ANKLE_BACK_MM / 1000.0
    near = [(i, p) for i, p in ipts if abs(p.x - target_x) <= flen * 0.08]
    if not near:
        near = ipts
    zs = sorted(p.z for _, p in near)
    band = [(i, p) for i, p in near if p.z <= zs[int(len(zs) * 0.25)]] or near
    bp = [p for _, p in band]
    ball = sum(bp, Vector((0.0, 0.0, 0.0))) / len(bp)
    # 같은 정점을 포즈에서도 추적해 "메시가 본을 따라왔는가"를 판정한다(F10-B).
    _CONTACT_VIDX[bone_side] = [i for i, _ in band]
    tip = max(pts, key=lambda p: p.x)          # 발끝 = 최전방 정점
    gi_toe = vgi.get("TOE_" + bone_side)
    if gi_toe is not None:
        tidx = [v.index for v in rider.data.vertices
                if any(g.group == gi_toe and g.weight > 0.5 for g in v.groups)]
        tpts = [rider.matrix_world @ me.vertices[i].co for i in tidx]
        if tpts:
            tip = max(tpts, key=lambda p: p.x)
    return ball, tip


_ARM_REST0 = {}   # 연장 **전** 상완·전완 rest 길이(mm). 비교안 배율의 기준.


def resize_arm_bones(u_rest_mm, f_rest_mm=None):
    """상완(·전완) rest 길이를 바꾸고 자식을 delta 만큼 재부착한다(F13-B).

    `extend_shin()` 과 같은 계열 — 검증된 패턴을 그대로 쓴다. 팔은 `solve_elbow()` 가
    본 길이를 읽어 팔꿈치를 배치하므로, 길이만 바꾸면 굽힘각이 따라온다.
    """
    if not u_rest_mm:
        return
    if not _ARM_REST0:      # 원본 rest 길이 1회 캡처 — 비교안(§5-3) 배율의 기준이 된다
        for s in ("L", "R"):
            _ARM_REST0["U" + s] = arm.pose.bones["UPPER_ARM_" + s].bone.length * 1000
            _ARM_REST0["F" + s] = arm.pose.bones["FOREARM_" + s].bone.length * 1000
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for side in ("L", "R"):
        for bname, target in (("UPPER_ARM_" + side, u_rest_mm),
                              ("FOREARM_" + side, f_rest_mm)):
            if not target:
                continue
            b = arm.data.edit_bones.get(bname)
            if b is None:
                continue
            d = b.tail - b.head
            if d.length < 1e-6:
                continue
            new_tail = b.head + d.normalized() * (target / 1000.0)
            delta = new_tail - b.tail
            b.tail = new_tail
            for ch in b.children:            # FOREARM / HAND 를 끝에 다시 붙인다
                ch.head = ch.head + delta
                ch.tail = ch.tail + delta
                for gch in ch.children:
                    gch.head = gch.head + delta
                    gch.tail = gch.tail + delta
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    print("  [팔길이] 상완 rest %.2fmm (world %.2f) / 전완 %s"
          % (u_rest_mm, u_rest_mm * SCALE,
             ("rest %.2fmm" % f_rest_mm) if f_rest_mm else "불변"))


resize_arm_bones(UPPER_ARM_REST_MM)


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
        ball, tip = _mesh_contact_world(rider, me, bs, ankle)
        if ball is None:
            continue
        plan[bs] = (ball.copy(), tip.copy())
        _CONTACT_DROP[bs] = ankle.z - ball.z

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
        pct = (_HEEL_BACK[bs] * 1000 + ANKLE_BACK_MM) / (_FOOT_LEN[bs] * 1000) * 100
        print("  [발뼈재정의] FOOT_%s world %.2fmm / TOE_%s %.2fmm / 접점하강 %.2fmm"
              % (bs, arm.pose.bones["FOOT_" + bs].bone.length * SCALE * 1000,
                 bs, arm.pose.bones["TOE_" + bs].bone.length * SCALE * 1000,
                 _CONTACT_DROP[bs] * 1000))
        print("  [접점위치] %s 발길이 %.2fmm (뒤꿈치 %.2f ~ 발끝 %.2f) — 접점은 발목앞 %.2f "
              "= **발길이의 %.1f%%** (F10-R1 99%% 발끝 → F11 목표 50%% 발중심)"
              % (bs, _FOOT_LEN[bs] * 1000, _HEEL_BACK[bs] * 1000,
                 _FOOT_LEN[bs] * 1000 - _HEEL_BACK[bs] * 1000, ANKLE_BACK_MM, pct))
        # 발목→밑창 축 기울기 — 사용자가 F13 에서 "지시한 바 없는 각도 변화"로 지적한 값.
        # 발이 짧아지면 ANKLE_BACK 이 당겨져 이 각이 커지고 뒤꿈치가 들린다(F14 §1).
        import math as _m3
        _tilt = _m3.degrees(_m3.atan2(_ANKLE_TO_SOLE[bs] * 1000, ANKLE_BACK_MM))
        print("  [발기울기] %s 발목→밑창 %.2fmm / 발목앞 %.2fmm → **축 기울기 %.2f°** "
              "(F12=F14 기준 13.31° · F13 축소 시 15.34°)"
              % (bs, _ANKLE_TO_SOLE[bs] * 1000, ANKLE_BACK_MM, _tilt))


refit_foot_bones()


# ── 접점 목표 = 페달축 위 CONTACT_LIFT ───────────────────────────────────────
# joints 는 발목을 페달축 뒤 ANKLE_BACK · **위 ANKLE_UP** 에 둔다. ANKLE_UP 은
# "발바닥 22.0 + 밑창·클릿 15.0". 접점(뼈)은 발목보다 _CONTACT_DROP 만큼 아래이므로,
# 접점이 놓일 곳은 **페달축 위 (ANKLE_UP − CONTACT_DROP)** 이다.
# 상수로 박지 않고 JD·메시에서 매번 역산한다 — 선언값과 적용값이 갈라진 것이 anti#8 의 사고였다.
CONTACT_LIFT = {s: (ANKLE_UP_MM / 1000.0) - _CONTACT_DROP.get(BONE_OF[s], 0.0) for s in ("L", "R")}
print("  [접점목표] ANKLE_BACK %.2f / ANKLE_UP %.2f (JD 역산)  →  페달축 위 L %.2f · R %.2f mm"
      % (ANKLE_BACK_MM, ANKLE_UP_MM, CONTACT_LIFT["L"] * 1000, CONTACT_LIFT["R"] * 1000))


def contact_target(d, side):
    """접점(FOOT tail)이 놓여야 할 world — 페달축 바로 위 CONTACT_LIFT."""
    p = g2b(d["pedalAxle" + side])
    return Vector((p.x, p.y, p.z + CONTACT_LIFT[side]))


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
        #   접점(FOOT tail)이 페달축 위 CONTACT_LIFT 에 왔는가로 판정한다(memory: fit-ik-measure-not-contact).
        ball = eval_tail("FOOT_" + bs)
        btgt = contact_target(d, side)
        ped = g2b(d["pedalAxle" + side])
        rec["sides"][side] = {
            "boneSide": bs,
            "ankleActualMm": vec_mm(actual),
            "ankleTargetMm": vec_mm(target),
            "errorMm": round(err, 2),
            "contactActualMm": vec_mm(ball),
            "contactTargetMm": vec_mm(btgt),
            "contactErrorMm": round((ball - btgt).length * 1000.0, 2),
            "contactAbovePedalAxleMm": round((ball.z - ped.z) * 1000.0, 2),
            "contactLiftExpectedMm": round(CONTACT_LIFT[side] * 1000.0, 2),
        }
        mb = mesh_contact_posed(bs)
        if mb is not None:
            rec["sides"][side]["meshContactMm"] = vec_mm(mb)
            rec["sides"][side]["meshContactVsBoneTailMm"] = round((mb - ball).length * 1000.0, 2)
            rec["sides"][side]["meshContactToPedalMm"] = round((mb - ped).length * 1000.0, 2)
        # F11 새 판정 지표 — 페달축이 발의 어느 지점 아래인가(발끝 99% → 발 중심 50%).
        ax = foot_axis_posed(bs)
        if ax is not None:
            heel, toe, center = ax
            v = toe - heel
            t = (ped - heel).dot(v) / max(1e-9, v.length_squared)
            rec["sides"][side].update({
                "footHeelMm": vec_mm(heel),
                "footToeMm": vec_mm(toe),
                "footCenterMm": vec_mm(center),
                "footLengthMm": round(v.length * 1000.0, 2),
                "pedalAxlePercentOfFoot": round(t * 100.0, 1),
                "pedalAxleToFootCenterHorizMm": round(
                    (((center.x - ped.x) ** 2 + (center.y - ped.y) ** 2) ** 0.5) * 1000.0, 2),
            })
        if err > tol_mm:
            bad.append("%s %.1fmm" % (side, err))
    rec["pass"] = not bad
    _FOOT_CONTACT[pkey] = rec
    print("  [발접촉] %s  발목 좌 %.1f / 우 %.1fmm (허용 %.1f)  %s   |  접점(본) 좌 %.1f / 우 %.1f"
          "   |  접점(메시)→페달 좌 %s / 우 %s   메시↔본 좌 %s / 우 %s" % (
              pkey, rec["sides"]["L"]["errorMm"], rec["sides"]["R"]["errorMm"],
              tol_mm, "OK" if rec["pass"] else "FAIL",
              rec["sides"]["L"]["contactErrorMm"], rec["sides"]["R"]["contactErrorMm"],
              rec["sides"]["L"].get("meshContactToPedalMm"), rec["sides"]["R"].get("meshContactToPedalMm"),
              rec["sides"]["L"].get("meshContactVsBoneTailMm"), rec["sides"]["R"].get("meshContactVsBoneTailMm")))
    _sL, _sR = rec["sides"]["L"], rec["sides"]["R"]
    if "pedalAxlePercentOfFoot" in _sL:
        print("  [발중심] %s  페달축↔발중심 수평 좌 %.1f / 우 %.1fmm   "
              "페달축 위치 좌 %.1f%% / 우 %.1f%% of 발길이 (목표 50%%)" % (
                  pkey, _sL["pedalAxleToFootCenterHorizMm"], _sR["pedalAxleToFootCenterHorizMm"],
                  _sL["pedalAxlePercentOfFoot"], _sR["pedalAxlePercentOfFoot"]))
    # 접점 오차는 이번 지시에서 **차단 조건이 아니다**(합격 기준 §3-3 은 발목 기준).
    # 다만 실제 접점이므로 크게 어긋나면 눈에 띄게 남긴다 — 차단 승격은 감리 판단.
    for side in ("L", "R"):
        if rec["sides"][side]["contactErrorMm"] > 10.0:
            print("  ⚠ [접점경고] %s %s 접점이 목표에서 %.1fmm — 접점 판정은 렌더로 확인하라"
                  % (pkey, side, rec["sides"][side]["contactErrorMm"]))
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


def shoot(name, loc, look, note=None):
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
    # note = 판정 수치를 그림에 **직접 박는다**(지시 §4-2·§4-3). 별도 표를 봐야만 읽히는
    # 그림은 사용자 판정 재료로 부족하다.
    sc.render.stamp_note_text = "%s | SCALE %s | %s%s" % (
        CANDIDATE_ID, SCALE_S, name.replace("_", " "),
        ("   ||  " + note) if note else "")
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


def mesh_contact_posed(bone_side):
    """rest 에서 접점로 판정된 **바로 그 정점들**의 현재 포즈 centroid(world).

    본 tail 과 이 값이 벌어지면 = 메시가 본을 따라오지 않는다는 뜻이다.
    본 좌표만 보고 "발이 닿았다"고 판정하는 것이 F6~F9 에서 반복된 오판의 형태다
    (memory: fit-ik-measure-not-contact). 접점 판정은 반드시 **메시**로 한다.
    """
    idx = _CONTACT_VIDX.get(bone_side)
    if not idx or _RIDER_MESH is None:
        return None
    me = _RIDER_MESH.evaluated_get(_fresh_dg()).data
    pts = [_RIDER_MESH.matrix_world @ me.vertices[i].co for i in idx]
    return sum(pts, Vector((0.0, 0.0, 0.0))) / len(pts)   # centroid — rest 정의와 동일해야 한다


def foot_axis_posed(bone_side):
    """포즈 상태의 (뒤꿈치, 발끝, 발 중심) — 전부 centroid 라 강체변환 equivariant.

    F11 의 새 판정 지표(페달축이 발길이의 몇 % 지점인가 · 페달축↔발 중심 수평거리)를
    **메시에서 직접** 내기 위한 것이다. AABB 는 회전에 민감해 쓰지 않는다.
    """
    hi, ti = _HEEL_VIDX.get(bone_side), _TOE_VIDX.get(bone_side)
    if not hi or not ti or _RIDER_MESH is None:
        return None
    me = _RIDER_MESH.evaluated_get(_fresh_dg()).data

    def _c(ii):
        return sum((_RIDER_MESH.matrix_world @ me.vertices[i].co for i in ii),
                   Vector((0.0, 0.0, 0.0))) / len(ii)

    heel, toe = _c(hi), _c(ti)
    return heel, toe, (heel + toe) / 2


def torso_angle_measured():
    """실제 몸통각 = (어깨중점 − 엉덩이중점) 의 시상면 수평 기준 각도(deg) — **본에서 실측**.

    ⚠ joints 의 `torsoAngleDeg`(TA) 와 다르다. joints 는 hip 에서 TA 방향으로 어깨를
      **가상 배치**할 뿐이고, `fit_ik.py` 는 그 값을 쓰지 않는다(어깨는 GLB 본 계층 +
      LEAN_DEG 스파인 굽힘의 결과). F12 실측: joints 42° vs 렌더 34.66° — 7.3° 차이가
      그동안 아무도 모르게 남아 있었다. **사용자가 보는 각도는 이쪽이다.**
    """
    import math as _m
    hip = (eval_head("THIGH_L") + eval_head("THIGH_R")) / 2
    sho = (eval_head("UPPER_ARM_L") + eval_head("UPPER_ARM_R")) / 2
    d = sho - hip
    return _m.degrees(_m.atan2(d.z, d.x)), hip, sho


def ischial_points():
    """좌골 = PELVIS 정점군의 후하방 지지 밴드 **centroid**(median 금지, F12 §4-1).

    안장을 읽기 전에 rider 메시만으로 확정한다(순환 정의 금지 — HARNESS 안장 게이트 규약).
    F12-B 는 이 높이에 안장 상면을 맞춘다.
    """
    if _RIDER_MESH is None:
        return None
    gi = _VGI.get("PELVIS")
    if gi is None:
        return None
    idx = [v.index for v in _RIDER_MESH.data.vertices
           if any(g.group == gi and g.weight >= 0.25 for g in v.groups)]
    me = _RIDER_MESH.evaluated_get(_fresh_dg()).data
    pts = [(i, _RIDER_MESH.matrix_world @ me.vertices[i].co) for i in idx]
    out = {}
    for side, sign in (("L", 1), ("R", -1)):
        half = [(i, p) for i, p in pts if p.y * sign > 0]
        if not half:
            continue
        xs = sorted(p.x for _, p in half)
        post = [(i, p) for i, p in half if p.x <= xs[int(len(xs) * 0.45)]]   # 후방 45%
        zs = sorted(p.z for _, p in post)
        band = [(i, p) for i, p in post if p.z <= zs[int(len(zs) * 0.20)]] or post  # 하부 20%
        c = sum((p for _, p in band), Vector((0.0, 0.0, 0.0))) / len(band)
        out[side] = {"centroidMm": vec_mm(c), "verts": len(band)}
    if "L" in out and "R" in out:
        out["midZMm"] = round((out["L"]["centroidMm"][2] + out["R"]["centroidMm"][2]) / 2, 2)
        out["midXMm"] = round((out["L"]["centroidMm"][0] + out["R"]["centroidMm"][0]) / 2, 2)
    return out


def elbow_measure():
    """팔꿈치 굽힘각·손 오차를 **본에서 실측**한다(F13-B). 굽힘 0° = 완전 신전."""
    import math as _m
    hood = {"L": g2b(JD["phases"]["0.500"]["handL"]),
            "R": g2b(JD["phases"]["0.500"]["handR"])}
    out = {}
    for s in ("L", "R"):
        sh = eval_head("UPPER_ARM_" + s)
        el = eval_tail("UPPER_ARM_" + s)
        hd = eval_tail("FOREARM_" + s)
        tgt = hood["L"] if (sh.y * hood["L"].y) > 0 else hood["R"]
        v1 = (sh - el).normalized()
        v2 = (hd - el).normalized()
        inner = _m.degrees(_m.acos(max(-1.0, min(1.0, v1.dot(v2)))))
        out[s] = {
            "shoulderMm": vec_mm(sh), "elbowMm": vec_mm(el), "handMm": vec_mm(hd),
            "hoodMm": vec_mm(tgt),
            "upperArmWorldMm": round(arm.pose.bones["UPPER_ARM_" + s].bone.length * SCALE * 1000, 2),
            "forearmWorldMm": round(arm.pose.bones["FOREARM_" + s].bone.length * SCALE * 1000, 2),
            "shoulderToHoodMm": round((tgt - sh).length * 1000, 2),
            "elbowBendDeg": round(180.0 - inner, 2),
            "handToHoodMm": round((hd - tgt).length * 1000, 2),
        }
    return out


def draw_arm_guides(em, side="L"):
    """팔꿈치 각도선(상완=주황, 전완=자홍)을 씬에 얹는다 — 그림으로 판정하기 위함.

    ⚠ 기본은 **L**(파이프라인 좌 = Blender +y). 렌더 카메라가 +y 에 있으므로 R 로 그리면
      선이 라이더 뒤에 숨어 보이지 않는다(F13 1차 렌더에서 실제로 그랬다).
    """
    d = em[side]
    y = -0.34 if side == "R" else 0.34
    sh = Vector((d["shoulderMm"][0] / 1000, y, d["shoulderMm"][2] / 1000))
    el = Vector((d["elbowMm"][0] / 1000, y, d["elbowMm"][2] / 1000))
    hd = Vector((d["handMm"][0] / 1000, y, d["handMm"][2] / 1000))
    return _bars([("ARM_UPPER", sh, el, (1.0, 0.45, 0.0)),
                  ("ARM_FORE", el, hd, (1.0, 0.2, 0.8))])


def _bars(specs, rad=0.008):
    made = []
    for name, p0, p1, rgb in specs:
        v = p1 - p0
        if v.length < 1e-6:
            continue
        bpy.ops.mesh.primitive_cylinder_add(radius=rad, depth=v.length,
                                            location=(p0 + p1) / 2)
        o = bpy.context.object
        o.name = name
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = v.to_track_quat("Z", "Y")
        m = bpy.data.materials.new(name + "_M")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*rgb, 1)
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = 2.0
        o.data.materials.append(m)
        made.append(o)
    return made


def draw_posture_guides(hip, sho):
    """몸통각을 **그림에서 눈으로 판정**할 수 있도록 각도선을 씬에 그린다(F12 §7-2).

    수치표만 내면 "숫자만 보고 그림을 안 본다"는 지적이 반복된다. 몸통선(청록)과
    수평 기준선(노랑)을 실제 메시로 얹어 렌더에 남긴다.
    """
    y = 0.30                      # 라이더 바깥(카메라 쪽)으로 빼서 몸에 가리지 않게
    h = Vector((hip.x, y, hip.z))
    s = Vector((sho.x, y, sho.z))
    return _bars([("POSTURE_TORSO", h, s, (0.0, 0.85, 0.85)),                 # 몸통선(청록)
                  ("POSTURE_HORIZ", h, h + Vector((0.45, 0.0, 0.0)),
                   (1.0, 0.85, 0.0))])                                        # 수평기준(노랑)


def hip_saddle_gap():
    """엉덩이(THIGH head 중점)와 안장 접촉점의 **수평 간격**(mm, +면 엉덩이가 앞).

    F11 은 라이더만 앞으로 옮기므로 엉덩이가 안장 앞으로 나간다. **버그가 아니라
    의도된 중간 상태**이며(지시 §3-4), 사용자가 이 수치로 자전거를 결정한다.
    """
    hip = (eval_head("THIGH_L") + eval_head("THIGH_R")) / 2
    saddle_x = _load_geometry()["coords"]["saddle"][0] / 1000.0
    return hip, saddle_x, (hip.x - saddle_x) * 1000.0


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
        # 클릿 접촉면 = 접점 바로 아래 CONTACT_LIFT(=발바닥+클릿 두께). 이상적으로 페달축과 일치.
        cleat_contact = Vector((ball.x, ball.y, ball.z - CONTACT_LIFT[side]))
        result[side] = {
            "boneSide": bs,
            "ANKLE_CENTER_mm": vec_mm(ankle),
            "CONTACT_BONE_mm": vec_mm(ball),
            "CLEAT_CONTACT_mm": vec_mm(cleat_contact),
            "PEDAL_AXLE_mm": vec_mm(pedal),
            "contactBoneToPedalErrorMm": round((ball - pedal).length * 1000, 3),
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
        mb = mesh_contact_posed(bs)
        if mb is not None:
            result[side]["MESH_CONTACT_mm"] = vec_mm(mb)
            result[side]["meshContactVsBoneTailMm"] = round((mb - ball).length * 1000, 3)
            result[side]["meshContactToPedalErrorMm"] = round((mb - pedal).length * 1000, 3)
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
        # 같은 함수 안에서 접점 centroid 와 AABB 를 같이 남긴다 — 두 계측이 어긋나면
        # 계측 자체를 의심해야 한다(F10-B 에서 실제로 어긋났다).
        out["footAabbMinMm"] = [round(min(p[i] for p in pts) * 1000, 2) for i in range(3)]
        out["footAabbMaxMm"] = [round(max(p[i] for p in pts) * 1000, 2) for i in range(3)]
        mb = mesh_contact_posed(BONE_OF[side])
        if mb is not None:
            out["meshContactMm"] = vec_mm(mb)
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
        _fc = _FOOT_CONTACT["0.500"]["sides"]["R"]
        # 발/페달 최저점을 한 화면에. 두 최저점 중간을 겨냥해 둘 다 보이게 한다.
        if lp.get("footLowestMm") and lp.get("pedalLowestMm"):
            mid_z = (lp["footLowestMm"][2] + lp["pedalLowestMm"][2]) / 2000.0
            mid_x = (lp["footLowestMm"][0] + lp["pedalLowestMm"][0]) / 2000.0
            # 오른발이므로 우측(+y)에서. 좌측에서 보면 왼쪽 페달·크랭크가 앞을 가린다.
            shoot("BDC_R_LOWPOINT",
                  [mid_x + 0.30, 0.95, mid_z + 0.26], [mid_x, 0.074, mid_z],
                  note="수직거리 %.1fmm | 페달축 = 발길이의 %.1f%% 지점 (목표 50%%)"
                       % (lp.get("verticalGapMm", 0.0),
                          _fc.get("pedalAxlePercentOfFoot", 0.0)))
        print("  [BDC우] 발최저 %s / 페달최저 %s / 수직거리 %s mm" % (
            lp.get("footLowestMm"), lp.get("pedalLowestMm"), lp.get("verticalGapMm")))

        # ── POSTURE_ANGLE (F12 §7-2) — 몸통각을 눈으로 판정하는 그림 ──
        _ta, _hip, _sho = torso_angle_measured()
        _isch = ischial_points()
        _measures["posture"] = {
            "pelvisTiltDeg": PELVIS_TILT_DEG,
            "torsoAngleMeasuredDeg": round(_ta, 2),
            "torsoAngleJointsTA": JD.get("torsoAngleDeg"),
            "hipMidMm": vec_mm(_hip),
            "shoulderMidMm": vec_mm(_sho),
            "ischial": _isch,
            "note": "torsoAngleMeasuredDeg 가 사용자가 보는 각도. joints TA 와 다르다.",
        }
        _g = draw_posture_guides(_hip, _sho)
        shoot("POSTURE_ANGLE", [0, FULL_SIDE_DIST, 0.72], [0, 0, 0.72],
              note="몸통각 실측 %.1f° (청록=몸통선, 노랑=수평기준) | 골반 후방경사 %.0f°"
                   % (_ta, PELVIS_TILT_DEG))
        for _o in _g:
            bpy.data.objects.remove(_o, do_unlink=True)
        print("  [자세] 몸통각 실측 %.2f° (joints TA %s) / 골반경사 %.0f° / 엉덩이 %s"
              % (_ta, JD.get("torsoAngleDeg"), PELVIS_TILT_DEG, vec_mm(_hip)))
        if _isch and "midZMm" in _isch:
            print("  [좌골] 중점 높이 %.2f · x %.2f  (L %s / R %s)"
                  % (_isch["midZMm"], _isch["midXMm"],
                     _isch["L"]["centroidMm"], _isch["R"]["centroidMm"]))

        # ── ARM_ELBOW (F13-B §8-3) — 팔꿈치 굽힘을 눈으로 판정하는 그림 ──
        _em = elbow_measure()
        _measures["elbow"] = _em
        _ag = draw_arm_guides(_em, "L")
        _sx0 = _em["L"]["shoulderMm"][0] / 1000.0
        _hx0 = _em["L"]["hoodMm"][0] / 1000.0
        _cxa, _cza = (_sx0 + _hx0) / 2.0, 0.98
        shoot("ARM_ELBOW", [_cxa + 0.10, 1.75, _cza + 0.22], [_cxa, 0.0, _cza],
              note="팔꿈치 굽힘 실측 %.1f° (주황=상완 %.0fmm, 자홍=전완 %.0fmm) | 손-후드 %.1fmm"
                   % (_em["R"]["elbowBendDeg"], _em["R"]["upperArmWorldMm"],
                      _em["R"]["forearmWorldMm"], _em["R"]["handToHoodMm"]))
        for _o in _ag:
            bpy.data.objects.remove(_o, do_unlink=True)
        print("  [팔꿈치] 굽힘 좌 %.2f° / 우 %.2f°  손-후드 좌 %.1f / 우 %.1fmm  "
              "어깨→후드 %.2fmm  상완 %.2f / 전완 %.2f"
              % (_em["L"]["elbowBendDeg"], _em["R"]["elbowBendDeg"],
                 _em["L"]["handToHoodMm"], _em["R"]["handToHoodMm"],
                 _em["R"]["shoulderToHoodMm"], _em["R"]["upperArmWorldMm"],
                 _em["R"]["forearmWorldMm"]))

        # ── SADDLE_GAP (F11 §4-2) — 사용자가 자전거를 결정하는 그림 ──
        # 라이더만 앞으로 옮겼으므로 엉덩이가 안장 앞에 놓인다. **보정 금지**(지시 §3-4).
        # 안장·엉덩이·시트포스트가 한 화면에 들어오도록 두 x 의 중간을 겨냥한다.
        _hip, _sx, _gap = hip_saddle_gap()
        _geo = _load_geometry()
        _saddle_z = (_geo["coords"]["saddle"][1] + _geo["bbHeight"])          # 안장 상면(지면 mm)
        _rec = {
            "hipMidMm": vec_mm(_hip),
            "saddleContactXMm": round(_sx * 1000, 2),
            "saddleTopZMm": round(_saddle_z, 2),
            "saddleHeightMm": _geo["saddleHeight"],
            "seatTubeAngleDeg": _geo["seatTubeAngle"],
            "saddleSetbackMm": _geo["saddleSetback"],
            "hipToSaddleHorizontalMm": round(_gap, 2),
            "note": "양수 = 엉덩이가 안장보다 앞.",
        }
        # ⚠ 시트튜브는 `coords.seatTop`(560×sinSTA=536.9)이 아니라 **junction 에서 끝난다**
        #   (F4-2 사용자 확정. `generate-rider-prototype-glb.mjs:304` 의 `void seatTop`).
        #   F12~F16 이 유물 필드 seatTop 과 안장을 비교해 "물리적 불가능"이라 오판했다.
        #   실제 판정값은 **junction 위로 노출된 시트포스트 길이**다.
        import math as _m4
        _junc_y = ((_geo["seatTubeLength"] - 150.0)
                   * _m4.sin(_m4.radians(_geo["seatTubeAngle"])) + _geo["bbHeight"])
        _rec["seatTubeJunctionZMm"] = round(_junc_y, 2)
        _rec["seatpostExposedMm"] = round(_saddle_z - _junc_y, 2)
        _rec["legacySeatTopZMm"] = round(
            _geo["seatTubeLength"] * _m4.sin(_m4.radians(_geo["seatTubeAngle"]))
            + _geo["bbHeight"], 2)
        _rec["$note_seatTop"] = "legacySeatTopZMm 은 메시에 안 그려지는 유물. 판정에 쓰지 말 것."
        if _isch and "midZMm" in _isch:
            # F12-B 판정: 안장 상면이 **좌골 높이**에 왔는가 / 좌골이 안장보다 얼마나 뒤인가
            _rec["ischialMidZMm"] = _isch["midZMm"]
            _rec["ischialMidXMm"] = _isch["midXMm"]
            _rec["saddleTopVsIschialZMm"] = round(_saddle_z - _isch["midZMm"], 2)
            _rec["ischialVsSaddleXMm"] = round(_isch["midXMm"] - _sx * 1000, 2)
        _measures["hipSaddleGap"] = _rec
        # 프레이밍은 **좌골–안장 구간**에 맞춘다. 엉덩이·몸통에 맞추면 안장이 화면 밖으로
        # 나가 판정이 불가능하다(F12 1차 렌더에서 실제로 그랬다). 시트포스트도 들어와야 한다.
        if "ischialMidZMm" in _rec:
            _cx = (_rec["ischialMidXMm"] + _sx * 1000) / 2000.0
            _cz = (_rec["ischialMidZMm"] + _saddle_z) / 2000.0
        else:
            _cx, _cz = (_hip.x + _sx) / 2.0, 0.93
        _n = "엉덩이-안장 수평 %.1fmm" % _gap
        if "saddleTopVsIschialZMm" in _rec:
            _n = ("안장상면 %.1f · 좌골 %.1f (차 %.1fmm) | 노출 시트포스트 %.1fmm | "
                  "좌골이 안장보다 %.1fmm 뒤"
                  % (_rec["saddleTopZMm"], _rec["ischialMidZMm"],
                     _rec["saddleTopVsIschialZMm"], _rec["seatpostExposedMm"],
                     -_rec["ischialVsSaddleXMm"]))
        shoot("SADDLE_GAP", [_cx + 0.18, 2.25, _cz + 0.42], [_cx, 0.0, _cz], note=_n)
        # 시트포스트가 화면에 들어오도록 junction 까지 포함해 한 번 더(§4-1 SADDLE_SEAT).
        _cz2 = (_rec["seatTubeJunctionZMm"] + _rec["ischialMidZMm"]) / 2000.0
        shoot("SADDLE_SEAT", [_cx + 0.20, 1.95, _cz2 + 0.38], [_cx, 0.0, _cz2], note=_n)
        print("  [안장간격] 엉덩이 x %.1f / 안장 x %.1f → 수평간격 %.1fmm"
              % (_hip.x * 1000, _sx * 1000, _gap))
        if "saddleTopVsIschialZMm" in _rec:
            print("  [안장-좌골] 안장상면 %.1f / 좌골 %.1f → **높이차 %.1fmm** · "
                  "좌골 x %.1f / 안장 x %.1f → **앞뒤 어긋남 %.1fmm(좌골이 뒤)**"
                  % (_saddle_z, _rec["ischialMidZMm"], _rec["saddleTopVsIschialZMm"],
                     _rec["ischialMidXMm"], _sx * 1000, -_rec["ischialVsSaddleXMm"]))

# ── ARM_ALT_PROPORTIONAL (F13 §5-3) — 사용자 선택용 비교 1장 ───────────────
# 정본은 "상완만 연장"이지만 그러면 상완/전완 비가 1.29 → 1.57 이 되어 사람 비율
# (대략 1.0~1.3)에서 벗어난다. 상완·전완을 **같은 비율로** 늘려 같은 도달을 만드는 안을
# 나란히 낸다. **정본은 바꾸지 않는다** — 이 렌더 뒤에 나오는 산출물은 없다.
if UPPER_ARM_REST_MM:
    _e0 = _measures.get("elbow", {}).get("R", {})
    # ⚠ 기준은 **연장 전** 원본 길이다. 이미 늘어난 상완을 기준으로 잡으면 배율이 1.0 이 되어
    #   비교안이 정본과 같아진다(F13 1차 렌더에서 실제로 그랬다).
    _u0 = _ARM_REST0.get("UR", 0.0)
    _f0 = _ARM_REST0.get("FR", 0.0)
    _D = _e0.get("shoulderToHoodMm", 0.0)
    if _u0 and _f0 and _D:
        import math as _mm2
        _c = _mm2.cos(_mm2.radians(170.0))
        _base = _mm2.sqrt((_u0 * SCALE) ** 2 + (_f0 * SCALE) ** 2
                          - 2 * (_u0 * SCALE) * (_f0 * SCALE) * _c)
        _k = _D / _base
        resize_arm_bones(_u0 * _k, _f0 * _k)
        apply_phase("0.500")
        rotate_cranks(crank_rot(JD["phases"]["0.500"]["crankDeg"]))
        _ea = elbow_measure()
        _measures["elbowAltProportional"] = {
            "scaleFactor": round(_k, 4),
            "upperArmWorldMm": _ea["R"]["upperArmWorldMm"],
            "forearmWorldMm": _ea["R"]["forearmWorldMm"],
            "ratioUtoF": round(_ea["R"]["upperArmWorldMm"] / _ea["R"]["forearmWorldMm"], 3),
            "elbowBendDeg": _ea["R"]["elbowBendDeg"],
            "handToHoodMm": _ea["R"]["handToHoodMm"],
        }
        _ag2 = draw_arm_guides(_ea, "L")
        _sx1 = _ea["L"]["shoulderMm"][0] / 1000.0
        _hx1 = _ea["L"]["hoodMm"][0] / 1000.0
        _cxb = (_sx1 + _hx1) / 2.0
        shoot("ARM_ALT_PROPORTIONAL", [_cxb + 0.10, 1.75, 1.20], [_cxb, 0.0, 0.98],
              note="[비교안] 상완·전완 동시 ×%.4f — 상완 %.0f / 전완 %.0f (비 %.2f) "
                   "| 굽힘 %.1f° | 손-후드 %.1fmm"
                   % (_k, _ea["R"]["upperArmWorldMm"], _ea["R"]["forearmWorldMm"],
                      _ea["R"]["upperArmWorldMm"] / _ea["R"]["forearmWorldMm"],
                      _ea["R"]["elbowBendDeg"], _ea["R"]["handToHoodMm"]))
        for _o in _ag2:
            bpy.data.objects.remove(_o, do_unlink=True)
        print("  [비교안] 동시배율 %.4f — 상완 %.2f / 전완 %.2f (비 %.3f) 굽힘 %.2f° 손 %.1fmm"
              % (_k, _ea["R"]["upperArmWorldMm"], _ea["R"]["forearmWorldMm"],
                 _ea["R"]["upperArmWorldMm"] / _ea["R"]["forearmWorldMm"],
                 _ea["R"]["elbowBendDeg"], _ea["R"]["handToHoodMm"]))

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
        # 접점(FOOT tail)이 놓일 페달축 위 높이 = ANKLE_UP - 발목대비 접점 하강(메시 실측).
        "contactLiftMm": {s: round(CONTACT_LIFT[s] * 1000, 2) for s in ("L", "R")},
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
