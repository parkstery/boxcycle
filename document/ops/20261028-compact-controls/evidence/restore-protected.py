from pathlib import Path
import json,zipfile,hashlib
root=Path('C:/20.HDev/boxcycle').resolve()
out=root/'document/ops/20261028-compact-controls/evidence'
manifest=json.loads((out/'implementation-baseline.json').read_text(encoding='utf-8'))
restored=[]
with zipfile.ZipFile(out/'implementation-baseline.zip') as z:
 for name,expected in manifest['images'].items():
  p=(root/name).resolve()
  if not p.is_relative_to(root/'document'):raise RuntimeError('Outside document root')
  current=p.read_bytes() if p.exists() else b''
  if hashlib.sha256(current).hexdigest()==expected:continue
  saved=out/'relocated-first-pass'/name
  saved.parent.mkdir(parents=True,exist_ok=True)
  if current:saved.write_bytes(current)
  original=z.read(name)
  if hashlib.sha256(original).hexdigest()!=expected:raise RuntimeError('Baseline mismatch')
  p.write_bytes(original)
  restored.append({'path':name,'restored_sha256':expected,'generated_capture_sha256':hashlib.sha256(current).hexdigest()})
(out/'protected-restoration.json').write_text(json.dumps(restored,ensure_ascii=False,indent=2),encoding='utf-8')
print({'restored':len(restored)})
