import difflib
import hashlib
import json
import pathlib
import zipfile

base = pathlib.Path(__file__).resolve().parent
root = base.parents[2]
evidence = base / 'evidence'
baseline = json.loads((evidence / 'baseline.json').read_text(encoding='utf-8'))
changes = []
patch = []
with zipfile.ZipFile(evidence / 'baseline.zip') as archive:
    paths = set(baseline['files'])
    for folder in ['apps/web/src', 'apps/web/e2e', 'apps/web/scripts']:
        paths.update(p.relative_to(root).as_posix() for p in (root / folder).rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.css', '.mjs', '.json', '.html'})
    for name in sorted(paths):
        source = root / name
        data = source.read_bytes() if source.exists() else b''
        digest = hashlib.sha256(data).hexdigest() if source.exists() else None
        before = baseline['files'].get(name)
        if before == digest:
            continue
        old = archive.read(name).decode('utf-8-sig') if name in baseline['files'] else ''
        new = data.decode('utf-8-sig')
        diff = list(difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True), fromfile='before/' + name, tofile='after/' + name))
        changes.append({'path': name, 'status': 'added' if before is None else 'deleted' if digest is None else 'modified', 'before': before, 'after': digest, 'added_lines': sum(line.startswith('+') and not line.startswith('+++') for line in diff), 'removed_lines': sum(line.startswith('-') and not line.startswith('---') for line in diff)})
        patch.extend(diff)
protected_failures = []
for name, expected in baseline['protected'].items():
    path = root / name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        protected_failures.append(name)
report = {'changes': changes, 'protected_count': len(baseline['protected']), 'protected_failures': protected_failures}
(evidence / 'supervisor-diff.patch').write_text(''.join(patch), encoding='utf-8')
(evidence / 'supervisor-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
