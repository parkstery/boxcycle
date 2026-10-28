from pathlib import Path
import hashlib,json,zipfile,difflib,subprocess
root=Path('C:/20.HDev/boxcycle')
out=root/'document/ops/20261028-compact-controls/evidence'
m=json.loads((out/'implementation-baseline.json').read_text(encoding='utf-8'))
changed=[]; image_changed=[];diff=[]
with zipfile.ZipFile(out/'implementation-baseline.zip') as z:
 for category,items in m.items():
  for name,oldhash in items.items():
   p=root/name
   data=p.read_bytes() if p.is_file() else b''
   if hashlib.sha256(data).hexdigest()!=oldhash:
    (changed if category=='sources' else image_changed).append(name)
    if category=='sources':
     try:diff.extend(difflib.unified_diff(z.read(name).decode('utf-8-sig').splitlines(True),data.decode('utf-8-sig').splitlines(True),fromfile='baseline/'+name,tofile=name))
     except UnicodeDecodeError:pass
current=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode('utf-8').split('\0')
new_sources=sorted({p for p in current if p.startswith(('apps/web/src/','apps/web/e2e/','apps/web/scripts/')) and p not in m['sources'] and (root/p).is_file()})
result={'changed_sources':changed,'new_sources':new_sources,'changed_protected_images':image_changed,'protected_image_count':len(m['images'])}
(out/'audit-current.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'audit-current.diff').write_text(''.join(diff),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
