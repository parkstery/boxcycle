import fs from 'node:fs';import {createRequire} from 'node:module';
const req=createRequire('C:/20.HDev/boxcycle/package.json');
const vt=await import('file:///C:/20.HDev/boxcycle/node_modules/@mapbox/vector-tile/index.js');const pbf=await import('file:///C:/20.HDev/boxcycle/node_modules/pbf/index.js').catch(()=>import('file:///C:/20.HDev/boxcycle/node_modules/pbf/dist/pbf.mjs'));
const VectorTile=vt.VectorTile||vt.default.VectorTile,Pbf=pbf.default||pbf.PbfReader;
const token=fs.readFileSync('C:/20.HDev/boxcycle/apps/web/.env','utf8').match(/VITE_MAPBOX_ACCESS_TOKEN=(.*)/)[1].trim().replace(/['"]/g,'');
const H={headers:{Referer:'http://localhost:5000/'}};
const COMP='mapbox.mapbox-streets-v8-lite,mapbox.mapbox-models-v1';
for(const s of [COMP,'mapbox.procedural-buildings-v1','mapbox.mapbox-3dbuildings-v1']){const j=await (await fetch(`https://api.mapbox.com/v4/${s}.json?secure&access_token=${token}`,H)).json();console.log(s,j.minzoom,j.maxzoom,JSON.stringify((j.vector_layers||[]).filter(l=>/build|tree|landuse|landcover|facade/.test(l.id)).map(l=>[l.id,l.minzoom,l.maxzoom,Object.keys(l.fields||{}).join('/')])).slice(0,700));}
const t=(lng,lat,z)=>{const n=2**z;const x=Math.floor((lng+180)/360*n);const r=lat*Math.PI/180;const y=Math.floor((1-Math.asinh(Math.tan(r))/Math.PI)/2*n);return[x,y];};
async function get(src,z,x,y){const r=await fetch(`https://api.mapbox.com/v4/${src}/${z}/${x}/${y}.vector.pbf?access_token=${token}`,H);if(!r.ok)return null;return new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer())));}
const sites=[];
const txt=fs.readFileSync('C:/20.HDev/boxcycle/apps/web/src/lib/route/basicIntroHubRouteGeometries.ts','utf8');
for(const m of txt.matchAll(/title: "([^"]+)"[\s\S]*?coordinates: \[([\s\S]*?)\n  \]/g)){const cs=[...m[2].matchAll(/\[(-?[\d.]+), ?(-?[\d.]+)\]/g)].map(a=>[+a[1],+a[2]]);sites.push([m[1],cs[Math.floor(cs.length/2)]]);}
const rd=JSON.parse(fs.readFileSync('C:/20.HDev/boxcycle/document/ops/20261119-public-route-candidates/route-designs.json','utf8'));
for(const r of rd){const ps=r.points.map(p=>Array.isArray(p)?p.slice(-2):[p.lng??p.lon,p.lat]);sites.push([r.name,ps[Math.floor(ps.length/2)]]);}
sites.push(['강남역',[127.0276,37.4979]],['원주시내',[127.9459,37.3422]],['마이애미비치',[-80.1306,25.7726]],['평창시골',[128.39,37.37]],['스텔비오',[10.453,46.5287]]);
const rows=[];
for(const[n,c]of sites){const o={n,c};let cell={};
 for(const z of [13,14,15,16]){const[x,y]=t(c[0],c[1],z);const v=await get(z<15?'mapbox.mapbox-streets-v8':COMP,z,x,y);if(!v){o['z'+z]='none';continue;}const b=v.layers.building,tr=v.layers.tree;let hs=0,def=0;if(b)for(let i=0;i<b.length;i++){const p=b.feature(i).properties;if(p.extrude==='true'||p.height!=null)hs++;}
  const lu=v.layers.landuse;let wood=0;if(lu)for(let i=0;i<lu.length;i++){if(/wood|park|grass|scrub/.test(lu.feature(i).properties.class||''))wood++;}
  o['z'+z]=`bld${b?b.length:0}/ext${hs} tree${tr?tr.length:0} gen${v.layers.generated_tree?v.layers.generated_tree.length:0} green${wood}`;}
 const[x,y]=t(c[0],c[1],15);const pv=await get('mapbox.procedural-buildings-v1',15,x,y);o.proc=pv?Object.entries(pv.layers).map(([k,l])=>k+l.length).join(','):'none';
 const[x4,y4]=t(c[0],c[1],14);const rr=await fetch(`https://api.mapbox.com/3dtiles/v1/mapbox.mapbox-3dbuildings-v1/14/${x4}/${y4}.glb?access_token=${token}`,H);o.lm=rr.status+':'+Math.round((+rr.headers.get('content-length')||0)/1024)+'KB';
 rows.push(o);console.log(n,c.join(','),'|',o.z13,'|',o.z14,'|',o.z15,'|',o.z16,'| proc',o.proc,'| landmark',o.lm);}
fs.writeFileSync('C:/20.HDev/boxcycle/tmp/view-distance-survey.json',JSON.stringify(rows,null,1));
