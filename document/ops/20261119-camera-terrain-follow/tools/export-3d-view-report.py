"""11-26 3D View 보고서를 HTML·ZIP으로 내보낸다(외부 의존·배포 없음). 11-23 판(export-fps-report.py)과 같은 화면 형식."""
from pathlib import Path
from html import escape
from html.parser import HTMLParser
import json
import re
import zipfile

folder = Path(__file__).resolve().parent.parent
ops = folder.parent
source = folder / '20261126-3d-view-report.md'
output = folder / 'exports'
output.mkdir(exist_ok=True)
name = 'spinatlas-3d-view-report-20261126'
markdown = source.read_text(encoding='utf-8')


def inline(value):
    pattern = r'`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*'
    result, position = [], 0
    for match in re.finditer(pattern, value):
        result.append(escape(value[position:match.start()]))
        if match[1] is not None:
            result.append('<code>' + escape(match[1]) + '</code>')
        elif match[2] is not None:
            result.append('<a href="' + escape(match[3], quote=True) + '">' + escape(match[2]) + '</a>')
        else:
            result.append('<strong>' + escape(match[4]) + '</strong>')
        position = match.end()
    return ''.join(result) + escape(value[position:])


def render(text):
    lines, blocks, index = text.splitlines(), [], 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        if line.startswith('#'):
            heading = re.match(r'^(#{1,6}) (.*)$', line)
            level = str(len(heading[1]))
            blocks.append('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>')
        elif line.startswith('|'):
            rows = []
            while index < len(lines) and lines[index].startswith('|'):
                cells = [item.strip() for item in lines[index].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                    rows.append(cells)
                index += 1
            head = '<thead><tr>' + ''.join('<th>' + inline(cell) + '</th>' for cell in rows[0]) + '</tr></thead>'
            body = '<tbody>' + ''.join('<tr>' + ''.join('<td>' + inline(cell) + '</td>' for cell in row) + '</tr>' for row in rows[1:]) + '</tbody>'
            blocks.append('<div class="table-wrap"><table>' + head + body + '</table></div>')
            continue
        elif re.match(r'^(- |\d+\. )', line):
            ordered = bool(re.match(r'^\d+\. ', line))
            tag, items = ('ol' if ordered else 'ul'), []
            while index < len(lines) and re.match(r'^\d+\. ' if ordered else r'^- ', lines[index]):
                items.append('<li>' + inline(re.sub(r'^(?:- |\d+\. )', '', lines[index])) + '</li>')
                index += 1
            blocks.append('<' + tag + '>' + ''.join(items) + '</' + tag + '>')
            continue
        else:
            blocks.append('<p>' + inline(line) + '</p>')
        index += 1
    return '\n'.join(blocks)


# 묶음 안에서 링크가 그대로 열리도록 원기록은 원래 폴더 구조(20261119…/·20261124…/)로 넣는다.
references = sorted(set(re.findall(r'\]\(((?:\.\./20261124-terrain-off-3d-plan/)?[^():/]+\.md)\)', markdown)))
html_body = render(markdown)
html = '''<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spinatlas 3D View 보고서 — 지형 OFF·3D 최대 표시 확정</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#202b3b;font:15px/1.8 system-ui,"Malgun Gothic",sans-serif}
main{max-width:1100px;margin:28px auto;padding:36px 44px;background:white;border-radius:12px}
h1{font-size:28px;line-height:1.4}h2{font-size:21px;margin-top:36px;border-bottom:2px solid #e0e6ef;padding-bottom:8px}h3{font-size:17px;margin-top:24px}
p,li,td{word-break:keep-all;overflow-wrap:anywhere}a{color:#1859a7}code{font-size:.88em;background:#f0f3f7;padding:2px 4px;border-radius:3px}
.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.65}
td,th{border:1px solid #d4dde8;padding:10px;text-align:left;vertical-align:top}th{background:#e9eff8}tr:nth-child(even){background:#fafbfd}
.downloads{padding:12px 16px;background:#e9eff8;border-radius:6px}
@media(max-width:700px){main{margin:0;padding:18px}h1{font-size:24px}}
@media print{@page{size:A4;margin:14mm}body{background:white;font-size:10pt}main{margin:0;padding:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}table{font-size:8pt}.downloads{display:none}a{color:inherit;text-decoration:none}}
</style><main><nav class="downloads">다운로드: <a download href="''' + name + '.zip">전체 묶음 ZIP</a> · <a download href="' + name + '.md">원본 Markdown</a></nav>' + html_body + '</main></html>'
HTMLParser().feed(html)
assert html.count('<h1>') == 1 and '595c3e3d' in html and '안개' in html
(output / (name + '.html')).write_text(html, encoding='utf-8')
(output / (name + '.md')).write_text(markdown, encoding='utf-8')
archive = output / (name + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    # 보고서는 20261119 폴더 안에 둬야 ../20261124… 상대 링크가 묶음 안에서도 맞는다.
    for extension in ['.md', '.html']:
        package.write(output / (name + extension), '20261119-camera-terrain-follow/' + name + extension)
    for reference in references:
        path = (folder / reference).resolve()
        if ops.resolve() not in path.parents or not path.exists():
            raise ValueError('Unexpected reference path: ' + reference)
        package.write(path, path.relative_to(ops.resolve()).as_posix())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    names = package.namelist()
print(json.dumps({'report': str(source), 'zipBytes': archive.stat().st_size, 'files': names}, ensure_ascii=False))
