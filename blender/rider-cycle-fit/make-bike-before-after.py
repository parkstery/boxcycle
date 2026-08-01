"""자전거 단독 Before/After 를 동일 카메라 뷰별로 좌우 배열한다(F1-R §R-2(4)).

render-frame-compare.py 가 구운 BIKE_BEFORE_* / BIKE_AFTER_* 를 짝지어 한 장으로 만든다.
좌=BEFORE(헤드튜브 165·탑튜브 seatTop 직결), 우=AFTER(헤드튜브 130·junction 접합).

실행:
  blender --background --python make-bike-before-after.py -- <bikeDir> <outPng>
"""
import bpy, sys, os, json

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BIKE_DIR = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.join(BIKE_DIR, "bike-before-after.png")

VIEWS = ["SIDE_ORTHO", "SIDE", "Q_FRONT", "CU_HEADTUBE", "CU_SEATJUNCTION"]
CELL_W, CELL_H = 700, 500

rows = []
for v in VIEWS:
    b = os.path.join(BIKE_DIR, "BIKE_BEFORE_%s.png" % v)
    a = os.path.join(BIKE_DIR, "BIKE_AFTER_%s.png" % v)
    if os.path.exists(b) and os.path.exists(a):
        rows.append((v, b, a))
    else:
        print("누락 — 스킵: %s" % v)

canvas = bpy.data.images.new("bike-ba", width=CELL_W * 2, height=CELL_H * len(rows), alpha=True)
pixels = [0.08, 0.08, 0.08, 1.0] * (CELL_W * 2 * CELL_H * len(rows))


def paste(src_path, col, row):
    img = bpy.data.images.load(src_path, check_existing=False)
    img.scale(CELL_W, CELL_H)
    src = list(img.pixels)
    y0 = (len(rows) - 1 - row) * CELL_H
    x0 = col * CELL_W
    width = CELL_W * 2
    for y in range(CELL_H):
        dst = ((y0 + y) * width + x0) * 4
        off = y * CELL_W * 4
        pixels[dst:dst + CELL_W * 4] = src[off:off + CELL_W * 4]
    bpy.data.images.remove(img)


for r, (v, b, a) in enumerate(rows):
    paste(b, 0, r)
    paste(a, 1, r)

canvas.pixels[:] = pixels
canvas.filepath_raw = OUT
canvas.file_format = "PNG"
canvas.save()
json.dump({
    "image": OUT,
    "layout": "좌=BEFORE(헤드튜브165·seatTop직결), 우=AFTER(헤드튜브130·junction접합)",
    "rows": [v for v, _, _ in rows],
    "cell": [CELL_W, CELL_H],
}, open(os.path.splitext(OUT)[0] + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("저장 %s (행 %d)" % (OUT, len(rows)))
