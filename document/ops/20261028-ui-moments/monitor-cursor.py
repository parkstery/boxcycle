import json
import pathlib
import hashlib

base = pathlib.Path(__file__).resolve().parent
root = base.parents[2]
path = base / 'evidence/cursor-review-fixes.log'
if not path.exists():
    path = base / 'evidence/cursor-implementation-elevated.log'
raw = path.read_bytes() if path.exists() else b''
text = raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8', errors='replace')
events = []
for line in text.splitlines():
    try:
        item = json.loads(line)
        if isinstance(item, dict) and item.get('type') != 'thinking':
            tool = item.get('tool_call') or {}
            events.append({'type': item.get('type'), 'subtype': item.get('subtype'), 'tools': list(tool.keys())})
    except (ValueError, TypeError):
        pass
baseline = json.loads((base / 'evidence/baseline.json').read_text(encoding='utf-8'))['files']
changed = []
for name, before in baseline.items():
    source = root / name
    if source.exists() and hashlib.sha256(source.read_bytes()).hexdigest() != before:
        changed.append(name)
added = [p.relative_to(root).as_posix() for folder in ['apps/web/src', 'apps/web/e2e', 'apps/web/scripts'] for p in (root / folder).rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.css', '.mjs', '.json', '.html'} and p.relative_to(root).as_posix() not in baseline]
newest = sorted(changed + added, key=lambda name: (root / name).stat().st_mtime)[-3:]
print(json.dumps({'log': path.name, 'log_bytes': len(raw), 'events': len(events), 'last_events': events[-2:], 'changed_count': len(changed), 'added_count': len(added), 'newest': newest, 'ready': (base / 'IMPLEMENTATION_READY').exists(), 'result': (base / '02-result-cursor.md').exists(), 'fix_result': (base / '05-result-review-fixes.md').exists()}, ensure_ascii=False))
