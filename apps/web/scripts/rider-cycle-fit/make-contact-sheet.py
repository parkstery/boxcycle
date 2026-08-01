"""
종합판(contact sheet) 생성 — 시각 보고 지시 §3.

PIL 없이 Blender 내장 기능만 사용한다(Blender 파이썬에 PIL 미포함).
각 셀에 candidateId·단계·카메라 방향·크랭크 위상·PASS/FAIL·관절각·접점 오차를 **그림 위에**
직접 새긴다(§3). 라벨은 bpy.data.images 픽셀 버퍼에 비트맵 폰트로 직접 찍는다 —
Blender 의 텍스트 렌더는 3D 씬을 거쳐야 해서 합성용으로는 과하다.

실행:
  blender --background --python make-contact-sheet.py -- <outDir>

산출: <outDir>/contact-sheet-static.png, <outDir>/contact-sheet-pedal.png
"""
import bpy, sys, os, json

_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_DIR = _ARGV[0] if _ARGV else os.getcwd()
MANIFEST = os.path.join(OUT_DIR, "render-manifest.json")

with open(MANIFEST, encoding="utf-8") as f:
    MF = json.load(f)

CANDIDATE = MF["candidateId"]
MEAS = MF.get("measures", {})
ANG = MF.get("jointAngles", {})

# ── 5x7 비트맵 폰트(라벨 각인용). 대문자·숫자·기호만. ──
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    "F": ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
    "Y": ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
    "°": ["01100", "10010", "01100", "00000", "00000", "00000", "00000"],
    "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
    ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
    "?": ["01110", "10001", "00010", "00100", "00100", "00000", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


class Canvas:
    """RGBA float 버퍼. Blender image 픽셀과 같은 (하단 원점) 배열."""

    def __init__(self, w, h, bg=(0.10, 0.11, 0.13, 1.0)):
        self.w, self.h = w, h
        self.px = list(bg) * (w * h)

    def blit(self, img, x0, y0, tw, th):
        """Blender image 를 (x0,y0) 에 tw×th 로 최근접 축소해 그린다."""
        sw, sh = img.size
        src = list(img.pixels)
        for ty in range(th):
            sy = int(ty * sh / th)
            for tx in range(tw):
                sx = int(tx * sw / tw)
                si = (sy * sw + sx) * 4
                dx, dy = x0 + tx, y0 + ty
                if 0 <= dx < self.w and 0 <= dy < self.h:
                    di = (dy * self.w + dx) * 4
                    self.px[di:di + 4] = src[si:si + 4]

    def text(self, s, x0, y0, scale=2, color=(1.0, 1.0, 1.0, 1.0)):
        """비트맵 폰트로 문자열을 찍는다. y0 는 글자 하단."""
        cx = x0
        for ch in s.upper():
            g = FONT.get(ch)
            if g is None:
                cx += 6 * scale
                continue
            for ry, row in enumerate(g):
                for rx, bit in enumerate(row):
                    if bit != "1":
                        continue
                    for sy in range(scale):
                        for sx in range(scale):
                            dx = cx + rx * scale + sx
                            dy = y0 + (6 - ry) * scale + sy
                            if 0 <= dx < self.w and 0 <= dy < self.h:
                                di = (dy * self.w + dx) * 4
                                self.px[di:di + 4] = list(color)
            cx += 6 * scale

    def rect(self, x0, y0, w, h, color):
        for dy in range(y0, min(y0 + h, self.h)):
            for dx in range(x0, min(x0 + w, self.w)):
                if dx < 0 or dy < 0:
                    continue
                di = (dy * self.w + dx) * 4
                self.px[di:di + 4] = list(color)

    def save(self, path):
        img = bpy.data.images.new("sheet", self.w, self.h, alpha=True)
        img.pixels = self.px
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)


def load(name):
    p = os.path.join(OUT_DIR, name + ".png")
    if not os.path.exists(p):
        return None
    return bpy.data.images.load(p)


def build(sheet_name, rows, title):
    """rows = [(제목, [(이미지id, 라벨줄들), ...]), ...]

    글자 겹침·잘림 방지(지시): 셀 폭에서 실제로 들어가는 글자 수를 폰트 폭으로 계산해
    자르고, 라벨 영역 높이를 줄 수 × 줄높이로 확보한다. 셀 경계에는 여백을 둔다.
    """
    cols = max(len(r[1]) for r in rows)
    CW, CH = 340, 264          # 셀 이미지 크기(전신이 잘리지 않게 여유)
    TS = 2                     # 텍스트 배율
    CHW = 6 * TS               # 글자 하나 폭(폰트 5px + 1px 간격)
    LINEH = 7 * TS + 5         # 줄 높이(폰트 7px + 여백)
    TPAD = 6                   # 라벨 좌우 여백
    MAXCH = (CW - TPAD * 2) // CHW   # 한 줄에 들어가는 최대 글자 수
    NLINES = max(len(c[1]) for r in rows for c in r[1])
    LBL = LINEH * NLINES + 10
    PADX, PADY = 12, 12
    HDR = 46
    ROWH = CH + LBL + PADY
    W = PADX + cols * (CW + PADX)
    H = HDR + len(rows) * ROWH + PADY
    cv = Canvas(W, H)
    cv.text(title[:(W - PADX * 2) // (6 * 3)], PADX, H - HDR + 14, scale=3)

    y = H - HDR - ROWH
    for _row_title, cells in rows:
        for ci, (img_id, labels) in enumerate(cells):
            x = PADX + ci * (CW + PADX)
            img = load(img_id)
            if img is None:
                cv.rect(x, y + LBL, CW, CH, (0.30, 0.05, 0.05, 1))
                cv.text("MISSING", x + 10, y + LBL + CH // 2, 2, (1, 0.4, 0.4, 1))
            else:
                cv.blit(img, x, y + LBL, CW, CH)
                bpy.data.images.remove(img)
            cv.rect(x, y, CW, LBL, (0.16, 0.17, 0.20, 1))
            # 라벨은 위에서 아래로. 마지막 줄이 셀 하단에 닿지 않도록 5px 띄운다.
            for li, line in enumerate(labels):
                col = (1, 1, 1, 1)
                if "FAIL" in line:
                    col = (1, 0.45, 0.45, 1)
                elif "PASS" in line:
                    col = (0.5, 1, 0.6, 1)
                elif line.startswith("?"):
                    col = (1, 0.85, 0.45, 1)
                ly = y + LBL - LINEH * (li + 1) + 5
                cv.text(line[:MAXCH], x + TPAD, ly, TS, col)
        y -= ROWH

    out = os.path.join(OUT_DIR, sheet_name)
    cv.save(out)
    print("종합판 저장: %s (%dx%d, 셀당 %d자)" % (out, W, H, MAXCH))
    return sheet_name


# ── Static 종합판 ──
st = MEAS.get("static", {})


def err(d, k):
    v = d.get(k)
    return "?" if v is None else "%dMM" % round(v)


static_note1 = "ANKLE %s/%s CLEAT %s/%s" % (
    err(st, "발목L"), err(st, "발목R"), err(st, "클릿L"), err(st, "클릿R"))
static_note2 = "HAND %s/%s" % (err(st, "손L"), err(st, "손R"))

VIEW_LABELS = [
    ("STATIC_SIDE_L", "SIDE LEFT"), ("STATIC_SIDE_R", "SIDE RIGHT"),
    ("STATIC_FRONT", "FRONT"), ("STATIC_REAR", "REAR"),
    ("STATIC_TOP", "TOP"), ("STATIC_Q_FRONT", "3/4 FRONT"),
    ("STATIC_Q_REAR", "3/4 REAR"),
]
CU_LABELS = [
    ("STATIC_CU_SADDLE", "SADDLE-PELVIS"), ("STATIC_CU_HAND_L", "HAND L-HOOD"),
    ("STATIC_CU_HAND_R", "HAND R-HOOD"), ("STATIC_CU_FOOT_L", "FOOT L-PEDAL"),
    ("STATIC_CU_FOOT_R", "FOOT R-PEDAL"), ("STATIC_CU_KNEE_FRONT", "KNEE-FRAME"),
]


def cells(pairs, n1, n2):
    out = []
    for iid, lab in pairs:
        out.append((iid, ["STATIC " + lab, "?UNJUDGED", n1, n2]))
    return out


rows_static = []
for i in range(0, len(VIEW_LABELS), 4):
    rows_static.append(("views", cells(VIEW_LABELS[i:i + 4], static_note1, static_note2)))
for i in range(0, len(CU_LABELS), 4):
    rows_static.append(("closeups", cells(CU_LABELS[i:i + 4], static_note1, static_note2)))

# ── Rider Only 분절 수치(지시: 각 그림에 신장·고관절–무릎·무릎–발목·어깨–팔꿈치·팔꿈치–손목)
#    measure-segments.py 산출물을 manifest 의 riderSegments 로 넣어두면 그림 위에 새긴다.
_seg = MF.get("riderSegments", {}).get("displayMm", {})


def _sv(k):
    v = _seg.get(k)
    return "?" if v is None else "%d" % round(v)


seg_line1 = "STATURE %s  HIP-KNEE %s" % (_sv("stature"), _sv("hipToKnee"))
seg_line2 = "KNEE-ANKLE %s  SHO-ELB %s" % (_sv("kneeToAnkle"), _sv("shoulderToElbow"))
seg_line3 = "ELB-WRIST %s MM" % _sv("elbowToWrist")


def rider_labels(title):
    return [title, "SCALE %s  ?UNJUDGED" % MF["params"]["scale"],
            seg_line1, seg_line2, seg_line3]


sheets = []
sheets.append(build(
    "contact-sheet-rider-only.png",
    [("rider only", [
        ("RIDER_ONLY_SIDE_L", rider_labels("RIDER ONLY SIDE LEFT")),
        ("RIDER_ONLY_FRONT", rider_labels("RIDER ONLY FRONT")),
        ("RIDER_ONLY_REAR", rider_labels("RIDER ONLY REAR")),
        ("RIDER_ONLY_Q_FRONT", rider_labels("RIDER ONLY 3/4")),
    ])],
    "RIDER ONLY  CAND %s  SCALE %s" % (CANDIDATE, MF["params"]["scale"])))
sheets.append(build("contact-sheet-static.png", rows_static,
                    "STATIC FIT  CAND %s" % CANDIDATE))

# ── Pedal 종합판 ──
rows_pedal = []
for deg in (0, 90, 180, 270):
    m = MEAS.get("phase_%d" % deg, {})
    a = ANG.get("phase_%d" % deg, {})
    note1 = "ANKLE %s/%s CLEAT %s/%s" % (
        err(m, "발목L"), err(m, "발목R"), err(m, "클릿L"), err(m, "클릿R"))
    knee = "KNEE L%s R%s" % (a.get("kneeDegL", "?"), a.get("kneeDegR", "?"))
    cs = []
    for vid, vlab in (("FULL", "FULL SIDE"), ("FOOT_L", "FOOT L"),
                      ("FOOT_R", "FOOT R"), ("CRANKSYNC", "CRANK SYNC")):
        cs.append(("PHASE_%d_%s" % (deg, vid),
                   ["PEDAL %d° %s" % (deg, vlab), "?UNJUDGED", knee, note1]))
    rows_pedal.append(("phase %d" % deg, cs))

sheets.append(build("contact-sheet-pedal.png", rows_pedal,
                    "PEDAL FIT  CAND %s" % CANDIDATE))

MF["contactSheets"] = sheets
with open(MANIFEST, "w", encoding="utf-8") as f:
    json.dump(MF, f, ensure_ascii=False, indent=2)
print("manifest 갱신: contactSheets =", sheets)
