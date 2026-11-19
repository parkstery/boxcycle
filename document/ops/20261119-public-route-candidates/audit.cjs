const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const core=require('./current-core.cjs');
const {resolveGeoRegion}=require(path.join(root,'functions/lib/geoRegion/geoRegionData.js'));
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'inventory.json')));
const published=inventory.rows.filter(r=>r.status==='published').map(r=>({...r,coords:JSON.parse(r.geometryCoordsJson)}));
const bins=[0,5000,10000,20000,30000,40000,60000,70000,110000,120000,Infinity];
function bin(m){let i=bins.findIndex((b,i)=>i>0&&m<b)-1;return `${bins[i]/1000}–${bins[i+1]/1000}`;}
const countries={},profiles={},duplicates=[],mismatches=[];
for(const r of published){
 const c=countries[r.country??'unknown']??={count:0,bins:{},cycling:0};c.count++;c.bins[bin(r.distanceMeters)]=(c.bins[bin(r.distanceMeters)]??0)+1;if(r.profile==='cycling')c.cycling++;
 profiles[r.profile]=(profiles[r.profile]??0)+1;
 const actual=core.polylineLengthMeters(r.coords);
 const geo=resolveGeoRegion(r.coords[0]);
 if(Math.abs(actual-r.distanceMeters)>Math.max(100,r.distanceMeters*.01)||r.country!==geo?.geoCountry)mismatches.push({id:r.id,title:r.title,storedM:r.distanceMeters,polylineM:actual,country:r.country,resolved:geo});
}
for(let i=0;i<published.length;i++)for(let j=i+1;j<published.length;j++){
 const a=published[i],b=published[j];if(a.profile!==b.profile)continue;
 const s=core.routePolylineSimilaritySymmetric(a.coords,b.coords);
 if(s>=.9)duplicates.push({a:a.id,b:b.id,titles:[a.title,b.title],profile:a.profile,similarity:s});
}
const candidates=[];
for(const id of ['yeouido','richmond','ara','amstel','sunmoon','annecy']){
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',id+'-directions.json'))),r=raw.response.routes[0],coords=r.geometry.coordinates;
 const matches=published.filter(p=>p.profile==='cycling').map(p=>({id:p.id,title:p.title,similarity:core.routePolylineSimilaritySymmetric(coords,p.coords)})).sort((a,b)=>b.similarity-a.similarity);
 const polylineM=core.polylineLengthMeters(coords);
 const checks={length:core.checkRouteLength(polylineM),coordCount:core.checkCoordCount(coords),density:core.checkCoordDensity(coords,polylineM),bbox:core.checkBboxDiagonal(coords)};
 const seen=new Set();let repeatedM=0;
 for(let i=1;i<coords.length;i++){const key=[coords[i-1].join(','),coords[i].join(',')].sort().join('|');if(seen.has(key))repeatedM+=core.distanceMeters(coords[i-1],coords[i]);seen.add(key);}
 candidates.push({id,geometryHash:require('node:crypto').createHash('sha256').update(JSON.stringify(r.geometry)).digest('hex'),distanceM:r.distance,polylineM,coords:coords.length,intermediateWaypoints:raw.design.points.length-2,repeatedM,
  maxSegmentM:Math.max(...coords.slice(1).map((p,i)=>core.distanceMeters(coords[i],p))),
  bboxDiagonalM:core.bboxDiagonalMeters(coords),geo:resolveGeoRegion(coords[0]),
  countries:[...new Set(coords.map(p=>resolveGeoRegion(p)?.geoCountry??null))],
  waypoints:raw.response.waypoints.map((w,i)=>({label:raw.design.points[i][0],requested:raw.design.points[i].slice(1),snapped:w.location,snapM:w.distance,road:w.name})),
  nearestExisting:matches[0],checks,
  specialSteps:r.legs.flatMap(l=>l.steps).filter(s=>s.mode!=='cycling'||/ferry|stairs|lift|tamsin|親水|壩/i.test(s.name??'')).map(s=>({mode:s.mode,name:s.name,distance:s.distance})),
  roads:[...new Set(r.legs.flatMap(l=>l.steps.map(s=>s.name)))].filter(Boolean)});
}
const candidatePairs=[];
for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
 const a=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',candidates[i].id+'-directions.json'))).response.routes[0].geometry.coordinates;
 const b=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',candidates[j].id+'-directions.json'))).response.routes[0].geometry.coordinates;
 candidatePairs.push({a:candidates[i].id,b:candidates[j].id,similarity:core.routePolylineSimilaritySymmetric(a,b)});
}
const out={at:new Date().toISOString(),inventoryAt:inventory.fetchedAt,publicationCount:inventory.publicationCount,published:published.length,countries,profiles,duplicates,mismatches,candidates,candidatePairs};
fs.writeFileSync(path.join(__dirname,'audit.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify({...out,candidates:candidates.map(({waypoints,roads,...r})=>r)},null,2));
