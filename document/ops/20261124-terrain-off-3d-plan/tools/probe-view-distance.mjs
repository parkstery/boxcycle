import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const req=createRequire('C:/20.HDev/boxcycle/apps/web/package.json');const {chromium}=req('@playwright/test');
const S=path.dirname(new URL(import.meta.url).pathname.slice(1));
const token=fs.readFileSync('C:/20.HDev/boxcycle/apps/web/.env','utf8').match(/VITE_MAPBOX_ACCESS_TOKEN=(.*)/)[1].trim().replace(/['"]/g,'');
const html=`<!doctype html><meta charset=utf8><link rel=stylesheet href="/mgl/mapbox-gl.css"><style>html,body,#m{margin:0;height:100%}</style><div id=m></div><script src="/mgl/mapbox-gl.js"></script><script>
window.boot=(o)=>new Promise(res=>{mapboxgl.accessToken=o.token;
 const map=window.map=new mapboxgl.Map({container:'m',style:o.style||'mapbox://styles/mapbox/standard',center:o.center,zoom:17,maxZoom:24,pitch:60,bearing:o.bearing,maxPitch:85,performanceMetricsCollection:false,fadeDuration:0,projection:'mercator',config:{basemap:{lightPreset:'day',show3dObjects:true,show3dBuildings:true,show3dLandmarks:true,show3dTrees:true,show3dFacades:true}}});
 map.on('style.load',()=>res(true));map.on('error',e=>console.log('MAPERR',e.error&&e.error.message));});
</script>`;
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];if(u==='/'){r.writeHead(200,{'content-type':'text/html'});return r.end(html);}
 const f='C:/20.HDev/boxcycle/node_modules/mapbox-gl/dist/'+u.replace('/mgl/','');
 if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/css'});fs.createReadStream(f).pipe(r);}).listen(5392);
const cfg=JSON.parse(fs.readFileSync(S+'/'+process.argv[2],'utf8'));const out='C:/20.HDev/boxcycle/tmp/view-distance/'+process.argv[2].replace('.json','');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11','--disable-frame-rate-limit','--disable-gpu-vsync']});
const rows=[];
for(const site of cfg.sites)for(const c of cfg.cases){
 const p=await b.newPage({viewport:cfg.viewport||{width:1562,height:754}});p.setDefaultTimeout(120000);
 p.on('console',m=>{const t=m.text();if(/MAPERR|PROBE/.test(t))console.log(t.slice(0,300));});
 try{
 await p.goto('http://localhost:5392/');await p.evaluate(o=>window.boot(o),{token,center:site.center,bearing:site.bearing,style:c.style});
 const row=await p.evaluate(async({site,c})=>{
  const map=window.map;const R=6378137;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const idle=async(max)=>{const t=performance.now();await wait(400);while(performance.now()-t<max){await wait(300);if(map.areTilesLoaded()&&map.isStyleLoaded())break;}};
  if(c.terrain){map.addSource('dem',{type:'raster-dem',url:'mapbox://mapbox.terrain-rgb',tileSize:512,maxzoom:14});map.setTerrain({source:'dem',exaggeration:1});}
  else map.setTerrain(null);
  const prop={building:'building-cutoff-fade-range','fill-extrusion':'fill-extrusion-cutoff-fade-range',model:'model-cutoff-fade-range'};
  const visit=(s,f)=>{f(s);for(const x of s.fragments||[])if(x.style)visit(x.style,f);};
  const cut=()=>visit(map.style,s=>{for(const l of Object.values(s._layers||{})){const k=prop[l.type];if(k&&l.getPaintProperty(k)!==0)s.setPaintProperty(l.id,k,0);}});
  if(c.cutoff0)cut();
  if(c.noShadow)visit(map.style,s2=>{for(const l of Object.values(s2._layers||{})){const k={building:'building-cast-shadows','fill-extrusion':'fill-extrusion-cast-shadows',model:'model-cast-shadows'}[l.type];if(k)try{s2.setPaintProperty(l.id,k,false);}catch(e){console.log('PROBE',e.message);}}});
  if(c.hide)visit(map.style,s2=>{for(const l of Object.values(s2._layers||{}))if(c.hide.includes(l.id)||c.hide.includes('type:'+l.type))try{s2.setLayoutProperty(l.id,'visibility','none');}catch(e){}});
  if(c.config)for(const[k,v]of Object.entries(c.config))map.setConfigProperty('basemap',k,v);
  const patch=()=>{const tr=map.transform;
   if(c.farM&&!tr.projection.__pf){const pr=tr.projection;pr.__pf=1;const orig=pr.farthestPixelDistance.bind(pr);pr.farthestPixelDistance=t=>Math.max(orig(t),c.farM*t.pixelsPerMeter);}
   if(c.lodOff&&!tr.__lod){tr.__lod=1;tr.isLODDisabled=ck=>!!ck;}
   if(c.lodMin&&!Object.getPrototypeOf(tr).__cw){const P=Object.getPrototypeOf(tr);P.__cw=1;const oc=P.coveringTiles;P.coveringTiles=function(o){const r=oc.call(this,o);if(o.isTerrainDEM||!(o.maxzoom>=c.lodMin)||this.zoom<15)return r;
     const cam=window.__cam;if(!cam)return r;const out=[];const lim=c.lodM;const br=site.bearing*Math.PI/180;
     const near=(id)=>{const n=2**id.canonical.z;const ls=2*Math.PI*R*Math.cos(cam[1]*Math.PI/180)/n;const cx=(cam[0]+180)/360*n,r0=cam[1]*Math.PI/180,cyy=(1-Math.asinh(Math.tan(r0))/Math.PI)/2*n;
       const x0=id.canonical.x,y0=id.canonical.y;const dx=Math.max(x0-cx,0,cx-x0-1),dy=Math.max(y0-cyy,0,cyy-y0-1);const d=Math.hypot(dx,dy)*ls;if(d>lim)return false;if(d===0)return true;
       const mx=(x0+.5-cx),my=-(y0+.5-cyy);const ang=Math.atan2(mx,my)-br;const half=.71/Math.hypot(mx,my);const a=Math.abs(Math.atan2(Math.sin(ang),Math.cos(ang)));return a<0.62+Math.asin(Math.min(1,half));};
     const exp=(id)=>{if(id.canonical.z>=c.lodMin){out.push(id);return;}if(!near(id)){if(!id.__c)out.push(id);return;}for(const k of id.children(o.maxzoom)){k.__c=1;exp(k);}};
     for(const id of r)exp(id);return out;};}
   if(c.horizonShift!=null)tr._horizonShift=c.horizonShift;
  };
  if(c.farLayer){map.addSource('fb',{type:'vector',url:'mapbox://mapbox.mapbox-streets-v8'});map.addLayer({id:'fb',type:'fill-extrusion',source:'fb','source-layer':'building',slot:'middle',minzoom:13,filter:['all',['==',['get','extrude'],'true'],['<',['zoom'],c.farLayer]],paint:{'fill-extrusion-color':'#d8d4ce','fill-extrusion-height':['coalesce',['get','height'],6],'fill-extrusion-base':['coalesce',['get','min_height'],0],'fill-extrusion-cutoff-fade-range':0}});}
  const brg=site.bearing*Math.PI/180;
  if(c.trees){const fs=[];const lat0=site.center[1]*Math.PI/180;const ll=(e,n)=>[site.center[0]+e/(R*Math.cos(lat0))*180/Math.PI,site.center[1]+n/R*180/Math.PI];
    const put=(f,r)=>{const e=f*Math.sin(brg)+r*Math.cos(brg),n=f*Math.cos(brg)-r*Math.sin(brg);fs.push({type:'Feature',id:fs.length+1,properties:{},geometry:{type:'Point',coordinates:ll(e,n)}});};
    let sd=1;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
    for(let f=-20;f<1000&&fs.length<c.trees;f+=12){put(f,9);put(f,-9);}
    while(fs.length<c.trees){const f=rnd()*900,r=(rnd()<.5?-1:1)*(20+rnd()*250);put(f,r);}
    map.addSource('tr',{type:'geojson',data:{type:'FeatureCollection',features:fs},maxzoom:15});
    map.addModel('t1','https://api.mapbox.com/models/v1/mapbox/oak1-v4-lod3.glb?access_token='+mapboxgl.accessToken);
    map.addLayer({id:'tr',type:'model',source:'tr',slot:'middle',layout:{'model-id':'t1'},paint:{'model-scale':[1,1,1],'model-cutoff-fade-range':0,'model-cast-shadows':false}});}
  if(c.facade){const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d');x.fillStyle='#cbbeb0';x.fillRect(0,0,128,128);x.fillStyle='#65808c';for(let a=7;a<128;a+=32)for(let b2=8;b2<128;b2+=32)x.fillRect(b2,a,18,20);map.addImage('wp',x.getImageData(0,0,128,128),{pixelRatio:2});
    map.setConfigProperty('basemap','show3dBuildings',false);
    map.addSource('bs',{type:'vector',url:'mapbox://mapbox.mapbox-streets-v8'});map.addLayer({id:'bp',type:'fill-extrusion',source:'bs','source-layer':'building',slot:'middle',minzoom:15,filter:['==',['get','extrude'],'true'],paint:{'fill-extrusion-pattern':'wp','fill-extrusion-height':['coalesce',['get','height'],6],'fill-extrusion-base':['coalesce',['get','min_height'],0],'fill-extrusion-cutoff-fade-range':0}});}
  const place=(d)=>{patch();const lat0=site.center[1]*Math.PI/180;const dy=d*Math.cos(brg),dx=d*Math.sin(brg);
    const lng=site.center[0]+dx/(R*Math.cos(lat0))*180/Math.PI,lat=site.center[1]+dy/R*180/Math.PI;
    const D=c.h/Math.cos(c.pitch*Math.PI/180);const hd=D*Math.sin(c.pitch*Math.PI/180);
    window.__cam=[site.center[0]+dx/(R*Math.cos(lat0))*180/Math.PI,site.center[1]+dy/R*180/Math.PI];const tot=d+hd;const cy=tot*Math.cos(brg),cx=tot*Math.sin(brg);const clng=site.center[0]+cx/(R*Math.cos(lat0))*180/Math.PI,clat=site.center[1]+cy/R*180/Math.PI;
    const mz=mapboxgl.MercatorCoordinate.fromLngLat([clng,clat],1).z;const H=map.transform.height;const ppm=(0.5/Math.tan(map.transform._fov/2)*H)/D;
    const zoom=Math.log2(ppm/(512*mz));
    map.jumpTo({center:[clng,clat],zoom,pitch:c.pitch,bearing:site.bearing});};
  place(0);await idle(5000);place(0);if(c.cutoff0)cut();map.triggerRepaint();await wait(1500);await idle(25000);place(0);await wait(2000);await idle(15000);
  const snap=()=>{const tr=map.transform;const ppm=tr.pixelsPerMeter;const src={};
   const seen=new Set();
   const tiles=(s)=>{for(const[k,sc]of Object.entries(s._mergedSourceCaches||{})){if(seen.has(k))continue;seen.add(k);const ids=sc.getRenderableIds?sc.getRenderableIds():[];const h={};for(const id of ids){const t=sc.getTileByID(id);if(!t)continue;const z=t.tileID.canonical.z;h[z]=(h[z]||0)+1;}if(ids.length)src[k.slice(-70)]=h;}};
   tiles(map.style);
   let bmax=0,bcount=-1,berr=null,dist=[0,0,0,0,0];try{const f=map.queryRenderedFeatures({target:{featuresetId:'buildings',importId:'basemap'}});bcount=f.length;
     const cam=map.getFreeCameraOptions().position.toLngLat();for(const x of f){let co=x.geometry.coordinates;while(Array.isArray(co[0]))co=co[0];const dd=new mapboxgl.LngLat(co[0],co[1]).distanceTo(cam);if(dd>bmax)bmax=dd;dist[dd<100?0:dd<300?1:dd<700?2:dd<1500?3:4]++;}}catch(e){berr=e.message.slice(0,120);}
   return{proj:tr.projection.name,zoom:+tr.zoom.toFixed(2),pitchAct:+tr.pitch.toFixed(1),farM:Math.round(tr._farZ/ppm),nearM:+(tr._nearZ/ppm).toFixed(3),camToCenterM:+(tr.cameraToCenterDistance/ppm).toFixed(1),camAltM:+map.getFreeCameraOptions().position.toAltitude().toFixed(1),tiles:src,bcount,bmax:Math.round(bmax),bDist_100_300_700_1500_inf:dist,berr};};
  const before=snap();
  const run=async(sec)=>{const ts=[];const rec=()=>ts.push(performance.now());map.on('render',rec);const t0=performance.now();
   await new Promise(r=>{const step=()=>{const t=(performance.now()-t0)/1000;if(t>sec){r();return;}place(t*25/3.6);requestAnimationFrame(step);};requestAnimationFrame(step);});map.off('render',rec);
   const d=[];for(let i=1;i<ts.length;i++)d.push(ts[i]-ts[i-1]);d.sort((a,b)=>a-b);const span=(ts.at(-1)-ts[0])/1000;
   let min1=1e9;for(let s=0;s<Math.floor(span);s++){const n=ts.filter(x=>x>=ts[0]+s*1000&&x<ts[0]+(s+1)*1000).length;min1=Math.min(min1,n);}
   return{fps:+((ts.length-1)/span).toFixed(1),min1,p95:+d[Math.floor(d.length*.95)].toFixed(1),maxMs:+d.at(-1).toFixed(0)};};
  await run(3);const perf=await run(c.sec||10);
  place(0);await wait(800);await idle(8000);
  const gl=map.getCanvas().getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return{site:site.id,id:c.id,h:c.h,pitch:c.pitch,...perf,...before,gpu:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).slice(0,60)};
 },{site,c});
 rows.push(row);console.log(JSON.stringify(row));fs.writeFileSync(out+'/rows.json',JSON.stringify(rows,null,1));
 await p.screenshot({path:`${out}/${site.id}-${c.id}.png`});
 if(cfg.dumpStyle&&rows.length===1){const d=await p.evaluate(()=>{const o=[];const seen=new Set();const v=s=>{for(const l of Object.values(s._layers||{}))if(!seen.has(l.fqid||l.id)){seen.add(l.fqid||l.id);o.push({id:l.id,type:l.type,min:l.minzoom,max:l.maxzoom,src:l.source,sl:l.sourceLayer});}for(const x of s.fragments||[])if(x.style)v(x.style);};v(map.style);let schema=null;try{schema=map.style.getSchema('basemap');}catch(e){schema=e.message;}return{layers:o,schema};});fs.writeFileSync(out+'/style.json',JSON.stringify(d,null,1));}
 }catch(e){console.log('FAIL',site.id,c.id,e.message.slice(0,400));}
 await p.close();
}
await b.close();srv.close();process.exit(0);
