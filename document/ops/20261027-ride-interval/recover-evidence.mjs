import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='C:/20.HDev/boxcycle';
const records=JSON.parse(fs.readFileSync(path.join(root,'document/ops/20261023-ui-redesign/evidence/instruction50/recovery-git-matches.json'),'utf8')).matches;
const output=path.join(root,'document/ops/20261027-ride-interval/evidence/accidental-captures');
fs.mkdirSync(output,{recursive:true});
for(const record of records){
 const bytes=execFileSync('git',['cat-file','blob',record.oid],{cwd:root,maxBuffer:5_000_000});
 const hash=crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
 if(hash!==record.hash) throw Error('hash mismatch '+record.target);
 const target=path.join(root,record.target);
 fs.copyFileSync(target,path.join(output,path.basename(target)));
 fs.writeFileSync(target,bytes);
 const actual=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex').toUpperCase();
 if(actual!==record.hash) throw Error('restore mismatch');
 console.log(path.basename(target)+' SHA256 verified');
}
