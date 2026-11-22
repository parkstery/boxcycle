import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Fixture-only imports: no auth shortcut and no requests to production Firebase.
export default defineConfig({
  plugins: [react(), {
    name: "interval-stats-fixture-repository",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer?.replaceAll("\\", "/").endsWith("/components/ride/IntervalWorkoutStatsSheet.tsx")) return null;
      if (source.endsWith("/repo/firestoreRides")) return "\0interval-stats-fixture-repository";
      if (source.endsWith("/firebase/app")) return "\0interval-stats-fixture-firebase";
      return null;
    },
    load(id) {
      if (id === "\0interval-stats-fixture-firebase") return "export const isFirebaseConfigured = () => true;";
      if (id !== "\0interval-stats-fixture-repository") return null;
      return `export async function loadRideSessionsInRangeFromFirestore(userId,start,end) {
        const fixture=window.__intervalStatsFixture;
        fixture.requests.push({userId,start:start.toISOString(),end:end.toISOString()});
        const fail=fixture.failNext; fixture.failNext=false;
        await new Promise(resolve=>setTimeout(resolve,fixture.delayMs));
        if (fail) throw new Error('fixture failure');
        const now=new Date(); if(now<start||now>=end)return [];
        const count=userId==='fixture-a'?1:2;
        return [{id:userId,ownerUid:userId,endedAt:now.toISOString(),elapsedSec:240,distanceMeters:1000,avgSpeedKmh:15,caloriesEstimate:20,routeDistanceMeters:1000,routeDurationSec:240,
          intervalWorkouts:Array.from({length:count},(_,i)=>({version:1,id:'workout-'+i,config:{highSec:30,lowSec:30,repeats:2,warmupSec:0,cooldownSec:0,rounds:1,roundRestSec:0},intensity:userId==='fixture-a'?'moderate':'light',startElapsedSec:i*120,endElapsedSec:i*120+120,plannedSec:120,elapsedSec:120,activeSec:80,phaseSeconds:{warmup:0,work:60,recovery:60,rest:0,cooldown:0},activePhaseSeconds:{warmup:0,work:40,recovery:40,rest:0,cooldown:0},signalGap:false,status:'completed',caloriesEstimate:10}))}];
      }`;
    },
  }],
  optimizeDeps: { entries: ["scripts/ride-interval/interval-workout-stats-fixture.html"] },
  server: { host: "127.0.0.1", port: 5197, strictPort: true },
});
