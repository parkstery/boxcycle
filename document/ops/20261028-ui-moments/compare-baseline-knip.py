from pathlib import Path
import json
import subprocess
import zipfile

base = Path(__file__).resolve().parent
root = base.parents[2]
snapshot = root / 'tmp/ui-moments-baseline-knip'
snapshot.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(base / 'evidence/baseline.zip') as archive:
    for name in archive.namelist():
        path = snapshot / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive.read(name))
for name in ['knip.config.mjs', 'dev-tools.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'index.html', 'vite.config.ts', 'devPort.ts']:
    source = root / 'apps/web' / name
    if source.exists():
        (snapshot / 'apps/web' / name).write_bytes(source.read_bytes())
result = subprocess.run(['node', str(root / 'node_modules/knip/bin/knip.js'), '--config', 'knip.config.mjs', '--reporter', 'json', '--no-exit-code', '--no-progress'], cwd=snapshot / 'apps/web', capture_output=True, text=True, encoding='utf-8', errors='replace')
(base / 'evidence/baseline-knip-raw.json').write_text(result.stdout, encoding='utf-8')
(base / 'evidence/baseline-knip-stderr.log').write_text(result.stderr, encoding='utf-8')
if result.returncode:
    print(json.dumps({'exit_code': result.returncode, 'error': result.stderr[-700:]}))
    raise SystemExit(result.returncode)
report = json.loads(result.stdout[result.stdout.index('{'):])
totals = {k: sum(len(issue.get(k, [])) for issue in report['issues'] if issue['file'].startswith('src/')) for k in ['files', 'exports', 'types', 'duplicates']}
print(json.dumps({'baseline': totals, 'note': 'read-only source snapshot; unchanged analyzer config, no secrets copied'}))
