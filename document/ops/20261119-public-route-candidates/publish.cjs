// Chief-authorized curated catalog publication using the existing Admin seed contract.
// Default is read-only dry-run. Apply requires the exact reviewed plan hash.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),core=require('./current-core.cjs');
const {initFirebaseAdminForCli}=require(path.join(root,'functions/lib/initAdminForCli.js'));
const {getFirestore,FieldValue}=require(path.join(root,'functions/node_modules/firebase-admin/lib/firestore'));
const {computeRouteFingerprintHex}=require(path.join(root,'functions/lib/routeFingerprintCore.js'));
const {buildPublicationListing}=require(path.join(root,'functions/lib/publicationListingCore.js'));
const {resolveGeoRegion}=require(path.join(root,'functions/lib/geoRegion/geoRegionData.js'));
const specs=[
 ['yeouido','public-kr-yeouido-hangang-20261119','여의도 한강 · 양화대교에서 여의도 동쪽','한강 남쪽 자전거길을 따라 양화대교에서 여의도 동쪽까지 달리는 편도 코스. 강변과 서울의 도시 풍경을 만납니다.'],
 ['richmond','public-gb-richmond-park-20261119','리치먼드 파크 · 도로 순환','런던 리치먼드 파크의 도로를 중심으로 숲과 초지를 지나는 순환 코스. Sawyer’s Hill과 Broomfield Hill의 기복을 만납니다.'],
 ['sunmoon','public-tw-sun-moon-lake-20261119','일월담 · 호수 순환','샹산 방문자센터 연결 도로에서 출발해 일월담을 도는 순환 코스. 호숫가와 산자락을 따라 이어지는 구릉 경로입니다.'],
 ['annecy','public-fr-lake-annecy-20261119','안시 호수 · 시계방향 순환','안시에서 출발해 탈루아르와 호수 남쪽을 거쳐 돌아오는 순환 코스. 호수와 알프스 산자락의 풍경을 만납니다.'],
];
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'audit.json')));
const payloads=specs.map(([id,publicationId,title,summary])=>{
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence',id+'-directions.json'))),r=raw.response.routes[0],c=r.geometry.coordinates;
 const reviewed=audit.candidates.find(x=>x.id===id);
 assert.equal(hash(r.geometry),reviewed.geometryHash,id+' geometry changed');
 const length=core.polylineLengthMeters(c);
 for(const verdict of [core.checkRouteLength(length),core.checkCoordCount(c),core.checkCoordDensity(c,length),core.checkBboxDiagonal(c),core.checkTitleSummaryStructure(title,summary),core.checkBannedWords(title,summary).verdict,core.checkPrivateInfo(title,summary)])assert.equal(verdict.ok,true,JSON.stringify(verdict));
 const payload={routeId:publicationId,publicTitle:title,publicSummary:summary,status:'published',revision:1,
  routeFingerprint:computeRouteFingerprintHex(c,'cycling'),geometryCoordsJson:JSON.stringify(c),snapshotProfile:'cycling',
  snapshotDistanceMeters:length,snapshotDurationSec:r.duration,applicantUid:'',sourcePublicRouteRequestId:'',presenceEnabled:true};
 const listing=buildPublicationListing(publicationId,payload,resolveGeoRegion);
 assert.equal(listing.geoCountry,raw.design.country);
 return {id,publicationId,geometryHash:reviewed.geometryHash,payload,listing};
});
const planHash=hash(payloads),apply=process.argv.includes('--apply');
if(apply)assert.equal(process.argv.find(a=>a.startsWith('--plan-hash='))?.slice(12),planHash,'reviewed --plan-hash required');
initFirebaseAdminForCli({projectId:'boxcycle-dc2df'});
const db=getFirestore();
async function inspect(tx){
 const read=q=>tx?tx.get(q):q.get();
 const pubs=await read(db.collection('routePublications').where('status','==','published'));
 const pending=await read(db.collection('publicRouteRequests').where('status','==','pending'));
 const existing=await Promise.all(payloads.map(p=>read(db.doc('routePublications/'+p.publicationId))));
 for(const p of payloads)for(const d of [...pubs.docs,...pending.docs]){
  if(d.id===p.publicationId)continue;
  const other=d.data();if(other.snapshotProfile!=='cycling')continue;
  const coords=core.parseAndValidateCoordsJson(other.geometryCoordsJson??'');
  if(coords)assert.ok(core.routePolylineSimilaritySymmetric(JSON.parse(p.payload.geometryCoordsJson),coords)<.9,'duplicate with '+d.id);
 }
 const actions=existing.map((doc,i)=>{
  if(!doc.exists)return 'create';
  const old=doc.data();for(const [key,value] of Object.entries(payloads[i].payload))assert.deepEqual(old[key],value,'existing mismatch '+doc.id+'/'+key);
  return 'unchanged';
 });
 return {actions,publicationsBefore:pubs.size,pendingScanned:pending.size};
}
(async()=>{
 const dry=await inspect();
 const plan={at:new Date().toISOString(),project:'boxcycle-dc2df',planHash,...dry,
  rows:payloads.map((p,i)=>({id:p.id,publicationId:p.publicationId,action:dry.actions[i],geometryHash:p.geometryHash,
   title:p.payload.publicTitle,distanceMeters:p.payload.snapshotDistanceMeters,durationSec:p.payload.snapshotDurationSec,profile:'cycling',
   coordinateCount:JSON.parse(p.payload.geometryCoordsJson).length,geoCountry:p.listing.geoCountry,geoAdmin1:p.listing.geoAdmin1,routeFingerprint:p.payload.routeFingerprint})),
  authorization:'Chief: 공개등록해. 커밋 푸시 배포해',mode:apply?'apply':'dry-run'};
 fs.writeFileSync(path.join(__dirname,'publication-plan.json'),JSON.stringify(plan,null,2));
 console.log(JSON.stringify(plan,null,2));
 if(!apply)return;
 const result=await db.runTransaction(async tx=>{
  const current=await inspect(tx);
  current.actions.forEach((action,i)=>{if(action==='create')tx.create(db.doc('routePublications/'+payloads[i].publicationId),
   {...payloads[i].payload,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});});
  return current;
 });
 fs.writeFileSync(path.join(__dirname,'publication-result.json'),JSON.stringify({...plan,...result,appliedAt:new Date().toISOString()},null,2));
 console.log('Applied: '+result.actions.filter(x=>x==='create').length+' created, '+result.actions.filter(x=>x==='unchanged').length+' unchanged.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
