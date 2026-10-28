"""배포 산출물 지문과 공개 운영 번들 일치 여부를 기록한다."""
from pathlib import Path
import hashlib
import json
import re
import sys
import time
import urllib.request

root = Path(__file__).resolve().parents[3]
out = Path(__file__).resolve().parent / 'evidence' / 'deployment'
out.mkdir(parents=True, exist_ok=True)
dist = root / 'apps/web/dist'
origin = 'https://boxcycle-dc2df.web.app'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def get(path):
    url = origin + path + ('&' if '?' in path else '?') + 'verify=' + str(time.time_ns())
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read(), response.status

mode = sys.argv[1]
if mode == 'prepare':
    source_files = list((root / 'apps/web/src').rglob('*')) + list((root / 'apps/web/public').rglob('*'))
    source_files += [root / p for p in ('package.json', 'package-lock.json', 'firebase.json', '.firebaserc',
                                      'apps/web/package.json', 'apps/web/index.html', 'apps/web/vite.config.ts')]
    source_files += list((root / 'apps/web').glob('.env*'))
    sources = {p.relative_to(root).as_posix(): sha(p.read_bytes()) for p in source_files if p.is_file()}
    artifacts = {p.relative_to(dist).as_posix(): sha(p.read_bytes()) for p in dist.rglob('*') if p.is_file()}
    (out / 'manifest.json').write_text(json.dumps({'sources': sources, 'artifacts': artifacts}, indent=2), encoding='utf-8')
    previous, status = get('/')
    (out / 'before-index.html').write_bytes(previous)
    print(json.dumps({'source_count': len(sources), 'artifact_count': len(artifacts), 'before_http': status,
                      'before_assets': re.findall(r'(?:src|href)="(/assets/[^\"]+)"', previous.decode())}))
elif mode == 'verify':
    manifest = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
    drift = [name for name, digest in manifest['sources'].items() if not (root / name).is_file() or sha((root / name).read_bytes()) != digest]
    if drift:
        raise RuntimeError('배포 중 소스 지문 변경: ' + ', '.join(drift))
    live, status = get('/')
    (out / 'after-index.html').write_bytes(live)
    local = (dist / 'index.html').read_bytes()
    if live != local:
        raise RuntimeError('운영 index.html이 로컬 배포 산출물과 다름')
    paths = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', live.decode())
    results = []
    for path in paths:
        data, code = get(path)
        file = dist / path.lstrip('/')
        digest = sha(data)
        match = digest == sha(file.read_bytes()) == manifest['artifacts'][path.lstrip('/')]
        results.append({'path': path, 'http': code, 'sha256': digest, 'matches_local': match})
        if not match:
            raise RuntimeError('운영 번들 불일치: ' + path)
    record = {'origin': origin, 'index_http': status, 'index_matches_local': True, 'source_drift': drift, 'assets': results}
    (out / 'verified.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record, indent=2))
else:
    raise ValueError(mode)
