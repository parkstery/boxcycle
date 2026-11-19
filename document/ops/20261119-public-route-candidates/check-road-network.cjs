const fs=require('node:fs'),path=require('node:path'),core=require('./current-core.cjs');
for(const id of ['ara','richmond']){
 const roads=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',id+'-osm.json'))).elements;
 const sampled=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',id+'-elevation.json'))).sampledCoords;
 const result=sampled.map(p=>{
  const matches=roads.map(w=>({id:w.id,tags:w.tags,distanceM:core.minDistancePointToPolylineMeters(p,w.geometry.map(q=>[q.lon,q.lat]))})).sort((a,b)=>a.distanceM-b.distanceM);
  return {point:p,...matches[0]};
 });
 const out={id,at:new Date().toISOString(),method:'72 equal-distance samples vs downloaded OSM highway line segments; 28m buffer; road connectivity is separately supplied by Directions',within28m:result.filter(p=>p.distanceM<=28).length,total:result.length,samples:result};
 fs.writeFileSync(path.join(__dirname,'evidence',id+'-road-network.json'),JSON.stringify(out,null,2));
 console.log(id,out.within28m+'/'+out.total,'missed',result.filter(p=>p.distanceM>28));
}
