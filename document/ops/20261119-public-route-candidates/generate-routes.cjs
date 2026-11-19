// Direct read-only Mapbox request; mirrors production cycling/full/geojson.
// steps=true is additional audit detail. Tokens and request URLs are never saved.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const env=fs.readFileSync(path.join(root,'apps/web/.env'),'utf8');
const token=env.match(/^VITE_MAPBOX_ACCESS_TOKEN\s*=\s*["']?([^\s"']+)/m)?.[1];
if(!token) throw Error('Mapbox token unavailable');
const designs=JSON.parse(fs.readFileSync(path.join(__dirname,'route-designs.json')));
const dir=path.join(__dirname,'evidence');fs.mkdirSync(dir,{recursive:true});
async function main(){
 for(const d of designs){
  if(process.argv[2] && d.id!==process.argv[2])continue;
  if(d.points.length>5)throw Error(d.id+': exceeds app max 3 waypoints');
  const points=d.points.map(p=>p.slice(1));
  const url=`https://api.mapbox.com/directions/v5/mapbox/cycling/${points.map(p=>p.join(',')).join(';')}?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(token)}`;
  const r=await fetch(url,{signal:AbortSignal.timeout(60000)}),j=await r.json();
  if(!r.ok||j.code!=='Ok') {console.log(d.id,r.status,j.code);process.exitCode=1;continue;}
  const out={id:d.id,fetchedAt:new Date().toISOString(),provider:'Mapbox Directions v5',profile:'cycling',design:d,response:j};
  fs.writeFileSync(path.join(dir,d.id+'-directions.json'),JSON.stringify(out,null,2));
  console.log(d.id, 'km',j.routes[0].distance/1000,'coords',j.routes[0].geometry.coordinates.length,'snaps',j.waypoints.map(w=>Math.round(w.distance)),'roads',[...new Set(j.routes[0].legs.flatMap(l=>l.steps.map(s=>s.name)))].filter(Boolean));
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
