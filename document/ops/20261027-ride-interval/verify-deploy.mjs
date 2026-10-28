import fs from 'node:fs';
import crypto from 'node:crypto';
const evidenceName=process.argv[2]??'';
if(evidenceName&&!/^[a-z0-9-]+$/.test(evidenceName))throw new Error('Invalid evidence name');
const root='C:/20.HDev/boxcycle/document/ops/20261027-ride-interval/evidence'+(evidenceName?'/'+evidenceName:'');
const manifest=JSON.parse(fs.readFileSync(root+'/deploy-manifest.json','utf8'));
const origin='https://boxcycle-dc2df.web.app';
const response=await fetch(origin+'/?verifyInterval='+Date.now(),{signal:AbortSignal.timeout(30_000),headers:{'Cache-Control':'no-cache'}});
if(!response.ok) throw Error('index HTTP '+response.status);
const html=await response.text();
const paths=[...new Set([...html.matchAll(/\/assets\/[^"'\s<>]+\.(?:js|css)/g)].map(match=>match[0]))];
if(!paths.length) throw Error('No entry assets');
const assets=[];
for(const url of paths){
 const result=await fetch(origin+url,{signal:AbortSignal.timeout(30_000)});
 if(!result.ok) throw Error(url+' HTTP '+result.status);
 const bytes=Buffer.from(await result.arrayBuffer());
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const expected=manifest.files[url.slice(1)];
 if(!expected || sha256!==expected) throw Error('Asset mismatch '+url);
 assets.push({path:url,sha256,bytes:bytes.length,match:true});
}
const verification={verifiedAt:new Date().toISOString(),origin,status:response.status,assets};
fs.writeFileSync(root+'/deploy-verification.json',JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification));
