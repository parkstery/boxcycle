import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), target=path.join(root,'.out/pre-ui-release-20261020');
if(!fs.existsSync(path.join(target,'.git')))throw new Error('Expected isolated worktree');
const fromBaseline=['apps/web/src/App.tsx','apps/web/src/components/maphud/MapHud.tsx','apps/web/src/features/map-overlays/MapBottomLeftStack.css','apps/web/src/features/map-overlays/RouteMinimap.css','apps/web/src/features/map-overlays/RouteMinimap.tsx'];
const fromCurrent=['AGENTS.md','CLAUDE.md',...['ride-result-f2-boundary','ride-result-f2-card-resume','ride-result-s1-timers','ride-result-s2-end-snapshot'].map(n=>`apps/web/scripts/ride-result/${n}.test.ts`)];
for(const name of fromBaseline){fs.mkdirSync(path.dirname(path.join(target,name)),{recursive:true});fs.copyFileSync(path.join(root,'.out/ui-800x360/baseline',name),path.join(target,name));}
for(const name of fromCurrent)fs.copyFileSync(path.join(root,name),path.join(target,name));
for(const name of ['document/ops/20261018-lint16','document/ops/20261020-minimap-dock-swap'])fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
for(const name of ['node_modules','functions/node_modules']){
 const src=path.join(root,name),dst=path.join(target,name);
 if(fs.existsSync(src)&&!fs.existsSync(dst))fs.symlinkSync(src,dst,'junction');
}
for(const name of ['apps/web/.env','functions/.env','functions/.secret.local']){
 const src=path.join(root,name),dst=path.join(target,name);
 if(fs.existsSync(src)&&!fs.existsSync(dst))fs.copyFileSync(src,dst);
}
console.log(execFileSync('git',['-C',target,'status','--short'],{encoding:'utf8'}));
console.log('Isolated release prepared; UI changes excluded.');
