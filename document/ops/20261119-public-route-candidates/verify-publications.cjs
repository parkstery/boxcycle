// Read-only production verification; does not overwrite the pre-publication inventory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
require(path.join(root,'functions/lib/initAdminForCli.js')).initFirebaseAdminForCli({projectId:'boxcycle-dc2df'});
const {getFirestore}=require(path.join(root,'functions/node_modules/firebase-admin/lib/firestore'));
const core=require('./current-core.cjs');
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'inventory.json')));
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'publication-result.json')));
(async()=>{
 const db=getFirestore(),[pubs,listings]=await Promise.all([db.collection('routePublications').get(),db.collection('publicationListings').get()]);
 const rows=[];
 for(const expected of plan.rows){
  const p=pubs.docs.find(d=>d.id===expected.publicationId)?.data(),l=listings.docs.find(d=>d.id===expected.publicationId)?.data();
  assert.ok(p&&l,'publication/listing missing: '+expected.publicationId);
  const coords=JSON.parse(p.geometryCoordsJson),actual=crypto.createHash('sha256').update(JSON.stringify({type:'LineString',coordinates:coords})).digest('hex');
  assert.equal(actual,expected.geometryHash);assert.equal(l.geoCountry,expected.geoCountry);assert.equal(p.status,'published');
  assert.equal(p.snapshotDistanceMeters,core.polylineLengthMeters(coords));assert.equal(l.snapshotDistanceMeters,p.snapshotDistanceMeters);
  assert.equal(p.routeId,expected.publicationId);assert.equal(l.publicationId,expected.publicationId);assert.equal(p.publicTitle,expected.title);
  for(const collection of ['routePublications','publicationListings']){
   const response=await fetch(`https://firestore.googleapis.com/v1/projects/boxcycle-dc2df/databases/(default)/documents/${collection}/${expected.publicationId}`,{signal:AbortSignal.timeout(20000)});
   assert.equal(response.status,200,'unauthenticated public read '+collection+'/'+expected.publicationId);
   const remote=await response.json();assert.equal(remote.fields.publicTitle.stringValue,expected.title);
  }
  rows.push({publicationId:expected.publicationId,title:p.publicTitle,geometryHash:actual,country:l.geoCountry,admin1:l.geoAdmin1,distanceMeters:p.snapshotDistanceMeters,profile:p.snapshotProfile});
 }
 // Confirm existing public geometry, status, title and distance were preserved.
 for(const original of before.rows){const p=pubs.docs.find(d=>d.id===original.id)?.data();assert.ok(p,original.id+' disappeared');
  for(const [field,key] of [['status','status'],['publicTitle','title'],['snapshotDistanceMeters','distanceMeters'],['geometryCoordsJson','geometryCoordsJson']])assert.deepEqual(p[field],original[key],original.id+'/'+field+' changed');}
 const active=pubs.docs.filter(d=>d.get('status')==='published'),countries={};
 for(const l of listings.docs)countries[l.get('geoCountry')]=(countries[l.get('geoCountry')]??0)+1;
 assert.equal(active.length,before.listingCount+4);assert.equal(listings.size,active.length);
 const result={at:new Date().toISOString(),project:'boxcycle-dc2df',active:active.length,listings:listings.size,total:pubs.size,countries,existingPreserved:before.rows.length,unauthenticatedRestReads:8,rows};
 fs.writeFileSync(path.join(__dirname,'publication-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
