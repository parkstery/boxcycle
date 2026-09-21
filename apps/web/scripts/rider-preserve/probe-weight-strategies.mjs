#!/usr/bin/env node
// Read-only browser probes. The frozen candidate files are never edited.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const phases=[0,45,90,135,180,225,270,315,360];
const strategies=['harmonic-k060-s130','harmonic-k090-s130','harmonic-k120-s160','harmonic-k160-s200','harmonic-k200-s240','harmonic-k240-s280'];
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];

for(const strategy of strategies){
  const page=await browser.newPage({viewport:{width:1500,height:900}});
  await page.goto(pathToFileURL(manifest.outputs.viewer).href);
  await page.waitForFunction(()=>Boolean(window.__RTW_CAPTURE__));
  await page.waitForTimeout(800);
  await page.evaluate(strategy=>{
    window.__RTW_CAPTURE__.setMode('bind');
    const makeHipRigid=()=>{
      for(const d of draws) if(d.name==='Mesh_153'||d.name==='Mesh_163'){
        for(let i=0;i<d.w4.length;i+=4){d.w4[i]=0;d.w4[i+1]=1;d.w4[i+2]=0;d.w4[i+3]=0;}
      }
    };
    const smoothGuides=()=>{
      for(const d of draws) if(/continuous knee skin/.test(d.name)){
        const n=d.w4.length/4,deg=new Int32Array(n);
        for(let e=0;e<d.edges.length;e+=2){deg[d.edges[e]]++;deg[d.edges[e+1]]++;}
        const start=new Int32Array(n+1);
        for(let i=0;i<n;i++)start[i+1]=start[i]+deg[i];
        const nbr=new Int32Array(start[n]),ew=new Float32Array(start[n]),fill=start.slice(0,n);
        for(let e=0;e<d.edges.length;e+=2){const a=d.edges[e],b=d.edges[e+1],w=1/Math.max(d.edgeRest[e/2],.001);
          nbr[fill[a]]=b;ew[fill[a]++]=w;nbr[fill[b]]=a;ew[fill[b]++]=w;}
        let cur=new Float32Array(n),next=new Float32Array(n);const fixed=new Int8Array(n);
        for(let i=0;i<n;i++){cur[i]=d.w4[i*4+2];if(cur[i]<=.02||cur[i]>=.98)fixed[i]=1;}
        for(let it=0;it<300;it++){
          for(let i=0;i<n;i++){
            if(fixed[i]){next[i]=cur[i];continue;}let acc=0,sum=0;
            for(let k=start[i];k<start[i+1];k++){acc+=cur[nbr[k]]*ew[k];sum+=ew[k];}
            next[i]=sum?acc/sum:cur[i];
          }
          [cur,next]=[next,cur];
        }
        for(let i=0;i<n;i++){d.w4[i*4]=0;d.w4[i*4+1]=1-cur[i];d.w4[i*4+2]=cur[i];d.w4[i*4+3]=0;}
      }
    };
    if(strategy.startsWith('harmonic-')){
      const match=/k(\d+)-s(\d+)/.exec(strategy);
      authoredWeights=()=>null;LFIX=false;KBAND=Number(match[1])/1000;SRELAX_BAND=Number(match[2])/1000;SRELAX_ITERS=1000;
      rebuildRig();makeHipRigid();
    }else{
      if(strategy.includes('Smooth'))smoothGuides();
      if(strategy.startsWith('hipRigid'))makeHipRigid();
    }
  },strategy);
  const rows=[];
  for(const phaseDeg of phases){
    await page.evaluate(deg=>{crankAngle=deg*Math.PI/180;},phaseDeg);
    await page.waitForTimeout(100);
    rows.push(await page.evaluate(deg=>{
      const perDraw=[];
      for(const d of draws)if(d.isLeg){let maxDelta=0,maxStrain=0;
        for(let e=0;e<d.edges.length;e+=2){const a=d.edges[e]*3,b=d.edges[e+1]*3;
          const now=Math.hypot(d.pos[a]-d.pos[b],d.pos[a+1]-d.pos[b+1],d.pos[a+2]-d.pos[b+2]);
          const rest=d.edgeRest[e/2],delta=Math.abs(now-rest);maxDelta=Math.max(maxDelta,delta);
          if(rest>=.002)maxStrain=Math.max(maxStrain,delta/rest);
        }perDraw.push({name:d.name,maxDeltaMm:maxDelta*1000,maxStrainPercent:maxStrain*100});}
      perDraw.sort((a,b)=>b.maxDeltaMm-a.maxDeltaMm);
      return {phaseDeg:deg,stats:window.__RTW_CAPTURE__.stats(),perDraw};
    },phaseDeg));
  }
  const worstPerDraw={};
  for(const row of rows)for(const d of row.perDraw){const w=worstPerDraw[d.name]??={maxDeltaMm:0,maxStrainPercent:0};w.maxDeltaMm=Math.max(w.maxDeltaMm,d.maxDeltaMm);w.maxStrainPercent=Math.max(w.maxStrainPercent,d.maxStrainPercent);}
  reports.push({strategy,worst:{maxDeltaMm:Math.max(...Object.values(worstPerDraw).map(x=>x.maxDeltaMm)),maxStrainPercent:Math.max(...Object.values(worstPerDraw).map(x=>x.maxStrainPercent))},worstPerDraw,rows});
  await page.close();
}
await browser.close();
const out=path.join(path.dirname(dir),'..',`weight-strategy-probe-${manifest.candidateId}.json`);
fs.writeFileSync(out,JSON.stringify({candidateId:manifest.candidateId,reports},null,2));
console.log(JSON.stringify({out,summary:reports.map(({strategy,worst,worstPerDraw})=>({strategy,worst,worstPerDraw}))},null,2));
