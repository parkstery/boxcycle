// Read-only production inventory. No user identifiers or credentials are persisted.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const { initFirebaseAdminForCli } = require(path.join(root, 'functions/lib/initAdminForCli.js'));
const { getFirestore } = require(path.join(root, 'functions/node_modules/firebase-admin/lib/firestore'));
initFirebaseAdminForCli({});
(async () => {
  const db = getFirestore();
  const [pubs, listings] = await Promise.all([
    db.collection('routePublications').get(), db.collection('publicationListings').get(),
  ]);
  const rows = pubs.docs.map(d => {
    const p = d.data(), l = listings.docs.find(x => x.id === d.id)?.data();
    return { id:d.id, status:p.status, title:p.publicTitle, profile:p.snapshotProfile,
      distanceMeters:p.snapshotDistanceMeters, geometryCoordsJson:p.geometryCoordsJson,
      country:l?.geoCountry ?? null, continent:l?.geoContinent ?? null, admin1:l?.geoAdmin1 ?? null,
      listingPresent:!!l };
  });
  const out = { fetchedAt:new Date().toISOString(), project:'boxcycle-dc2df',
    publicationCount:pubs.size, listingCount:listings.size,
    orphanListings:listings.docs.filter(d=>!pubs.docs.some(p=>p.id===d.id)).map(d=>d.id), rows };
  fs.writeFileSync(path.join(__dirname,'inventory.json'), JSON.stringify(out,null,2));
  console.log(JSON.stringify({...out,rows:rows.map(({geometryCoordsJson,...r})=>r)},null,2));
})().catch(e=>{console.error(e.message); process.exitCode=1;});
