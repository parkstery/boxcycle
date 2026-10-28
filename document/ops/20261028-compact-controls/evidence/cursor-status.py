import sqlite3,sys,re
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
p='file:C:/Users/kdrea/.cursor/chats/7f44416b1184e6b2e7ae01093c84e8b9/6282cd78-ea0d-48ae-9bb0-3b04f5f76e99/store.db?mode=ro'
c=sqlite3.connect(p,uri=True)
for (data,) in c.execute('select data from blobs order by rowid desc limit 12'):
 text=data.decode('utf-8',errors='ignore')
 matches=re.findall(r'[^\x00-\x08\x0b-\x1f]{0,80}(?:Timeout|passed|failed|Error:|playwright test|npm run|npx tsc)[^\x00-\x08\x0b-\x1f]{0,200}',text)
 for match in matches[-2:]: print(match[:280])
