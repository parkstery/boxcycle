const fs=require('node:fs'),path=require('node:path');
const core=require('./current-core.cjs');
const ids=process.argv.slice(2);if(!ids.length)ids.push('yeouido','richmond','ara','amstel','sunmoon','annecy');
function samples(c,n=72){
 const cum=[0];for(let i=1;i<c.length;i++)cum.push(cum[i-1]+core.distanceMeters(c[i-1],c[i]));
 return Array.from({length:n},(_,i)=>{const d=cum.at(-1)*i/(n-1);let k=cum.findIndex(m=>m>=d);if(k<=0)return c[0];
  const t=(d-cum[k-1])/(cum[k]-cum[k-1]),a=c[k-1],b=c[k];
  const y=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  return [a[0]+(b[0]-a[0])*t,(2*Math.atan(Math.exp(y(a[1])+(y(b[1])-y(a[1]))*t))-Math.PI/2)*180/Math.PI];
 });
}
(async()=>{for(const id of ids){
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',id+'-directions.json'))),coords=samples(data.response.routes[0].geometry.coordinates);
 const url='https://api.open-meteo.com/v1/elevation?latitude='+coords.map(p=>p[1].toFixed(6)).join(',')+'&longitude='+coords.map(p=>p[0].toFixed(6)).join(',');
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(60000)}),j=await r.json();
  if(!r.ok||j.elevation?.length!==72||!j.elevation.every(Number.isFinite)){console.log(id,r.status,j.reason??'invalid');process.exitCode=1;continue;}
  let gain=0,loss=0;for(let i=1;i<72;i++){const d=j.elevation[i]-j.elevation[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}
  const out={id,geometryHash:require('node:crypto').createHash('sha256').update(JSON.stringify(data.response.routes[0].geometry)).digest('hex'),fetchedAt:new Date().toISOString(),source:'Open-Meteo elevation API / Copernicus DEM GLO-90',sampleCount:72,sampledCoords:coords,values:j.elevation,
   min:Math.min(...j.elevation),max:Math.max(...j.elevation),gain,loss,spacingM:core.polylineLengthMeters(data.response.routes[0].geometry.coordinates)/71};
  fs.writeFileSync(path.join(__dirname,'evidence',id+'-elevation.json'),JSON.stringify(out,null,2));
  console.log(id,{min:out.min,max:out.max,gain,loss,spacingM:out.spacingM});
 }catch(e){console.log(id,e.message);process.exitCode=1;}
}})();
