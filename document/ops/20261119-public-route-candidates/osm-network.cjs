const fs=require('node:fs'),path=require('node:path');
const boxes={richmond:[51.425,-0.31,51.47,-0.25],ara:[37.55,126.59,37.61,126.81],sunmoon:[23.80,120.88,23.89,120.97],yeouido:[37.51,126.88,37.55,126.97],amstel:[52.29,4.88,52.37,4.93]};
(async()=>{for(const id of process.argv.slice(2)){
 const filter=id==='ara'?'[highway=cycleway]':id==='sunmoon'?'[highway=primary]':id==='yeouido'?'[highway=cycleway]':'[highway][name~"Amstel|Ouderkerk|Binnenweg|Weesper|Kalfjes|Brug"]';
 const q=`[out:json][timeout:25];way${filter}(${boxes[id].join(',')});out tags geom;`;
 const r=await fetch('https://overpass.kumi.systems/api/interpreter?data='+encodeURIComponent(q),{headers:{'User-Agent':'Spinatlas-route-review/1.0 (boxcycle public route validation; read-only)'},signal:AbortSignal.timeout(45000)});
 if(!r.ok){console.log(id,r.status);continue;}
 const j=await r.json();fs.writeFileSync(path.join(__dirname,'evidence',id+'-osm.json'),JSON.stringify(j));
 console.log(id,j.elements.length,[...new Set(j.elements.map(e=>e.tags?.name))].filter(Boolean).filter(n=>id==='richmond'||/自行車|자전거/.test(n)));
}})().catch(e=>{console.error(e.message);process.exitCode=1});
