import hashlib
import json
import pathlib
import subprocess
import zipfile

root = pathlib.Path(__file__).resolve().parents[3]
out = pathlib.Path(__file__).resolve().parent / 'evidence'
out.mkdir(exist_ok=True)
files = []
for folder in ['apps/web/src', 'apps/web/e2e', 'apps/web/scripts']:
    files.extend(p for p in (root / folder).rglob('*') if p.is_file() and p.suffix in {'.ts', '.tsx', '.css', '.mjs', '.json', '.html'})
files.extend(root / p for p in ['apps/web/dep-layers.json', 'apps/web/package.json', 'apps/web/playwright.config.ts'])
manifest = {}
with zipfile.ZipFile(out / 'baseline.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(set(files)):
        if not path.is_file():
            continue
        data = path.read_bytes()
        name = path.relative_to(root).as_posix()
        manifest[name] = hashlib.sha256(data).hexdigest()
        archive.writestr(name, data)
protected = {}
for folder in ['document/archive/ride-verify-evidence', 'document/ops/20261023-ui-redesign/evidence', 'document/ops/20261017-entry-location/evidence']:
    for path in (root / folder).rglob('*'):
        if path.is_file() and path.suffix in {'.png', '.json'}:
            protected[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
result = {'files': manifest, 'protected': protected, 'status': subprocess.run(['git', 'status', '--porcelain'], cwd=root, capture_output=True, text=True, encoding='utf-8').stdout}
(out / 'baseline.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'source_files': len(manifest), 'protected_evidence': len(protected)}))
