from pathlib import Path
import hashlib
import json
import shutil
import subprocess

base = Path(__file__).resolve().parent
root = base.parents[2]
before = json.loads((base / 'evidence/baseline.json').read_text(encoding='utf-8'))['protected']
bad = {name: digest for name, digest in before.items() if not (root / name).exists() or hashlib.sha256((root / name).read_bytes()).hexdigest() != digest}
wanted = set(bad.values())
matches = {}
scanned = 0
for folder in ['document', '.out', 'tmp']:
    for source in (root / folder).rglob('*.png'):
        if not wanted:
            break
        if source.as_posix().endswith(tuple(bad)):
            continue
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        scanned += 1
        if digest in wanted:
            matches[digest] = source
            wanted.remove(digest)
for name, digest in bad.items():
    if digest in matches:
        continue
    result = subprocess.run(['git', 'show', 'HEAD:' + name], cwd=root, capture_output=True)
    if result.returncode == 0 and hashlib.sha256(result.stdout).hexdigest() == digest:
        backup = base / 'evidence/recovered-head' / name
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_bytes(result.stdout)
        matches[digest] = backup
recovered = []
for name, digest in bad.items():
    if digest not in matches:
        continue
    dest = root / name
    new_capture = base / 'evidence/superseded-captures' / name
    new_capture.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.copyfile(dest, new_capture)
    shutil.copyfile(matches[digest], dest)
    recovered.append({'path': name, 'from': str(matches[digest])})
report = {'scanned': scanned, 'recovered': recovered, 'unrecovered': [name for name, digest in bad.items() if digest not in matches]}
(base / 'evidence/recovery-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
