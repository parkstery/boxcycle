import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

async function main(): Promise<void> {
  initFirebaseAdminForCli();
  const db = getFirestore();
  const snap = await db.collection("routePublications").where("status", "==", "published").limit(10).get();
  console.log("published count (sample query size):", snap.size);
  for (const d of snap.docs) {
    const data = d.data();
    console.log({
      id: d.id,
      publicTitle: data.publicTitle,
      routeId: typeof data.routeId === "string" ? data.routeId.slice(0, 12) : data.routeId,
      status: data.status,
      hasGeometry: typeof data.geometryCoordsJson === "string" && data.geometryCoordsJson.length > 10,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
