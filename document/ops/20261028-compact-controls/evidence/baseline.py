from pathlib import Path
import subprocess, hashlib, json, zipfile

root=Path('C:/20.HDev/boxcycle')
out=root/'document/ops/20261028-compact-controls/evidence'
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode('utf-8').split('\0')
prefixes=('apps/web/src/','apps/web/e2e/','apps/web/scripts/')
config={'apps/web/package.json','apps/web/playwright.config.ts','apps/web/dep-layers.json','AGENTS.md','CLAUDE.md'}
sources=sorted({p for p in paths if (p.startswith(prefixes) or p in config) and (root/p).is_file()})
images=sorted({p for p in paths if p.startswith('document/') and p.endswith('.png') and '20261028-compact-controls' not in p and (root/p).is_file()})
manifest={'sources':{},'images':{}}
with zipfile.ZipFile(out/'implementation-baseline.zip','x',zipfile.ZIP_DEFLATED) as z:
 for category,items in [('sources',sources),('images',images)]:
  for p in items:
   data=(root/p).read_bytes()
   manifest[category][p]=hashlib.sha256(data).hexdigest()
   z.writestr(p,data)
(out/'implementation-baseline.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print({k:len(v) for k,v in manifest.items()})
