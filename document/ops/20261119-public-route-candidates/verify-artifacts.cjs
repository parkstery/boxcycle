// Offline integrity checks; no network, authentication, or writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const core=require('./current-core.cjs'),root=path.resolve(__dirname,'../../..');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'audit.json'))),inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'inventory.json')));
const designs=JSON.parse(fs.readFileSync(path.join(__dirname,'route-designs.json')));
let checks=0;function check(condition,message){assert.ok(condition,message);checks++;}
check(inventory.publicationCount===inventory.rows.length,'inventory row count');
check(inventory.rows.filter(r=>r.status==='published').length===inventory.listingCount,'published vs listings');
check(inventory.orphanListings.length===0,'orphan listings');
check(inventory.rows.filter(r=>r.status==='published').every(r=>r.listingPresent),'every publication listed');
check(inventory.rows.filter(r=>r.status!=='published').every(r=>!r.listingPresent),'archived not listed');
const client=fs.readFileSync(path.join(root,'apps/web/src/lib/route/publicRouteAutoReview.ts'),'utf8');
for(const key of ['PUBLIC_ROUTE_MIN_LENGTH_METERS','PUBLIC_ROUTE_MAX_LENGTH_METERS','PUBLIC_ROUTE_MAX_COORDS','PUBLIC_ROUTE_SIMILARITY_BLOCK']){
 const value=Number(client.match(new RegExp(`export const ${key} = ([\\d_.]+)`))?.[1]?.replaceAll('_',''));
 check(value===core[key],key+' client/server parity');
}
const maxWaypoints=Number(fs.readFileSync(path.join(root,'apps/web/src/lib/geo/routeWaypoints.ts'),'utf8').match(/MAX_ROUTE_WAYPOINTS = (\d+)/)[1]);
for(const c of audit.candidates){
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',c.id+'-directions.json')));
 const e=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',c.id+'-elevation.json')));
 const b=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',c.id+'-3d.json')));
 const design=designs.find(d=>d.id===c.id),r=raw.response.routes[0];
 const hash=crypto.createHash('sha256').update(JSON.stringify(r.geometry)).digest('hex');
 check(hash===c.geometryHash&&hash===e.geometryHash&&hash===b.geometryHash,c.id+' geometry SHA256 chain');
 check(JSON.stringify(design.points)===JSON.stringify(raw.design.points),c.id+' design provenance');
 check(design.points.length-2<=maxWaypoints,c.id+' waypoint cap');
 check(r.geometry.coordinates.length<=core.PUBLIC_ROUTE_MAX_COORDS,c.id+' coordinate cap');
 check(Object.values(c.checks).every(v=>v.ok),c.id+' server geometry policy');
 check(c.polylineM>=5000,c.id+' recommendation minimum5km');
 check(c.geo.geoCountry===design.country&&c.countries.length===1&&c.countries[0]===design.country,c.id+' all-vertex country');
 check(c.nearestExisting.similarity<core.PUBLIC_ROUTE_SIMILARITY_BLOCK,c.id+' duplicate gate');
 check(e.values.length===72&&e.values.every(Number.isFinite),c.id+' elevation count/finite');
 check(e.sampledCoords.length===72&&e.min===Math.min(...e.values)&&e.max===Math.max(...e.values),c.id+' elevation stats');
 check(b.samples.length===10&&b.samples.every(s=>s.id===c.id&&s.viewport[0]===800&&s.viewport[1]===360),c.id+' sample identity/viewport');
 check(b.samples.every(s=>s.health==='ready'&&s.inFrame&&s.tilesLoaded&&!s.contextLost&&s.errors.length===0),c.id+' rendered terrain/camera checks');
 check(b.samples.every(s=>Number.isFinite(s.rawElevation)&&s.cameraClearance>=2.99),c.id+' DEM/clearance');
 for(const suffix of ['overview','qc2','qc3']){
  const image=fs.readFileSync(path.join(__dirname,'evidence',c.id+'-'+suffix+'.png'));
  check(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&image.length>10000,c.id+' '+suffix+' PNG');
 }
}
check(audit.candidatePairs.length===15&&audit.candidatePairs.every(p=>p.similarity<.9),'candidate pair duplicates');
console.log(`PASS ${checks} offline artifact checks; 6 geometries, 432 DEM samples, 60 final camera observations`);
