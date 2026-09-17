import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(process.argv[2],'utf8');
const ctx=vm.createContext({TextDecoder,Uint8Array,Float32Array,Uint32Array,Uint16Array,Int8Array,Uint8Array,Int16Array,Int32Array,DataView,atob,document:{getElementById:()=>({getContext:()=>({})})}});
const s=html.slice(html.indexOf('const GLB_B64'),html.indexOf('/* ---------- 리그'));
vm.runInContext(s,ctx);
const out=vm.runInContext(`({rig:RIG,nodes:G.nodes.map(n=>({name:n.name,children:n.children,extras:n.extras})),draws:draws.map(d=>({name:d.name,group:d.grp,n:d.pos.length/3,bounds:[0,1,2].map(j=>[Math.min(...d.pos.filter((v,i)=>i%3===j)),Math.max(...d.pos.filter((v,i)=>i%3===j))])}))})`,ctx);
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2));
console.log(out.draws.map(d=>`${d.name} ${d.group} ${JSON.stringify(d.bounds)}`).join('\n'));
