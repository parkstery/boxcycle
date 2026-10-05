"""One-time, fail-before-mutation migration for the 2026-10-05 document task."""
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote
import os

ROOT = Path(__file__).resolve().parents[3]
TASK = Path(__file__).resolve().parent
groups = {
    'product': ['260511-RTW-마스터-비전-및-종합계획', '260714-RTW-Ontology',
                '260517-제품-용어-Trailhead-Trail', '260518-Route-Token-경제-설계',
                '260519-사용자-tier-및-진입-정책', '260519-tier-quota-정책',
                '260519-tier-subscription-정책', '260717-퍼블릭-경로-자동등록-정책',
                '260924-RTW-UI-공간밀도-원칙'],
    'architecture': ['260703-Conquest-정복-레이어-설계', '260523-World-Activity-Presence-설계',
                     '260925-RTW-lib-도메인-경계와-의존-방향'],
    'operations': ['260523-Firebase-비용-운영-체크리스트', '260719-개발-워크플로-브랜치-커밋-게이트',
                   '260722-Skill-Harness-아키텍처', '260926-RTW-구조-게이트-운용-지침'],
}
moves = {f'document/{name}.md': f'document/reference/{group}/{name}.md'
         for group, names in groups.items() for name in names}
moves['document/260927-RTW-동행-지연과-경쟁-판정.md'] = 'document/ops/20260927-peer-competition/260927-RTW-동행-지연과-경쟁-판정.md'
old_bundle = ROOT / 'document/ops/20260929-ai-development-system'
for p in old_bundle.rglob('*'):
    if p.is_file():
        old = p.relative_to(ROOT).as_posix()
        moves[old] = old.replace('document/ops/', 'document/archive/ops/', 1)
for old, new in moves.items():
    src, dst = ROOT / old, ROOT / new
    assert src.is_file() and not dst.exists(), (old, new)
    assert src.resolve().is_relative_to(ROOT / 'document') and dst.resolve().is_relative_to(ROOT / 'document')
(TASK / 'moves.json').write_text(json.dumps(moves, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf8').split('\0')
files = set(tracked) | {p.relative_to(ROOT).as_posix() for p in TASK.iterdir() if p.is_file()}
link = re.compile(r'(!?\[[^\]\r\n]*\]\()(<[^>\r\n]+>|(?:[^()\r\n]|\([^()\r\n]*\))+)(\))')
changed = []
for old in sorted(files):
    p = ROOT / old
    if not p.is_file() or p.suffix not in {'.md', '.mdc', '.mjs', '.ts', '.tsx', '.js', '.json', '.ps1'}:
        continue
    # Keep task instructions, immutable movement map, and baseline as pre-migration evidence.
    if p.parent == TASK:
        continue
    data = p.read_bytes()
    try:
        text = data.decode('utf8')
    except UnicodeDecodeError:
        continue
    new = moves.get(old, old)
    def replace_link(m):
        target = m[2]
        angle = target.startswith('<') and target.endswith('>')
        raw = target[1:-1] if angle else target
        if re.match(r'^[a-z][a-z\d+.-]*:|^#|^//', raw, re.I) or re.search(r'[<>{}*]', raw):
            return m[0]
        parts = re.split(r'([#?].*)', raw, maxsplit=1)
        resolved = (p.parent / unquote(parts[0])).resolve()
        if not resolved.is_relative_to(ROOT):
            return m[0]
        resolved_rel = resolved.relative_to(ROOT).as_posix()
        mapped = moves.get(resolved_rel, resolved_rel)
        if new == old and mapped == resolved_rel:
            return m[0]
        rebased = Path(os.path.relpath(ROOT / mapped, (ROOT / new).parent)).as_posix()
        rebased = rebased.replace(' ', '%20') + ''.join(parts[1:])
        return m[1] + ('<' + rebased + '>' if angle else rebased) + m[3]
    result = link.sub(replace_link, text) if p.suffix in {'.md', '.mdc'} else text
    # Repository-absolute prose, source comments, commands, and routing strings.
    for src, dst in moves.items():
        result = result.replace(src, dst)
    result = result.replace('document/ops/20260929-ai-development-system/', 'document/archive/ops/20260929-ai-development-system/')
    if result != text:
        p.write_bytes(result.encode('utf8'))
        changed.append(old)
for old, new in moves.items():
    dst = ROOT / new
    dst.parent.mkdir(parents=True, exist_ok=True)
    (ROOT / old).rename(dst)
# Remove only the now-empty source directory; no recursive deletion.
old_bundle.rmdir()
(TASK / 'migration-changed-files.json').write_text(json.dumps(changed, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'Moved {len(moves)} files; updated references in {len(changed)} tracked files.')
