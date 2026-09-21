#!/usr/bin/env node
// Locate the exact draw/edge responsible for an immutable candidate's pedal-phase distortion.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const phases=[0,45,90,135,180,225,270,315,360];
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.goto(pathToFileURL(manifest.outputs.viewer).href);
await page.waitForFunction(()=>Boolean(window.__RTW_CAPTURE__));
await page.waitForTimeout(900);
await page.evaluate(()=>window.__RTW_CAPTURE__.setMode('bind'));
const rows=[];
for(const phaseDeg of phases){
  await page.evaluate(deg=>window.__RTW_CAPTURE__.setPhase(deg),phaseDeg);
  rows.push(await page.evaluate(deg=>{
      const perDraw=[];
      for(const d of draws) if(d.isLeg){
        let worst={deltaMm:-1,strainPercent:0,edgeIndex:-1,vertices:[]};
        for(let e=0;e<d.edges.length;e+=2){
          const ia=d.edges[e],ib=d.edges[e+1],a=ia*3,b=ib*3;
          const now=Math.hypot(d.pos[a]-d.pos[b],d.pos[a+1]-d.pos[b+1],d.pos[a+2]-d.pos[b+2]);
          const rest=d.edgeRest[e/2],delta=Math.abs(now-rest);
          if(delta>worst.deltaMm/1000) worst={deltaMm:delta*1000,
            strainPercent:rest?delta/rest*100:0,edgeIndex:e/2,vertexIndices:[ia,ib],restMm:rest*1000,nowMm:now*1000,
            restA:Array.from(d.restPos.slice(a,a+3)),restB:Array.from(d.restPos.slice(b,b+3)),
            nowA:Array.from(d.pos.slice(a,a+3)),nowB:Array.from(d.pos.slice(b,b+3)),
            weightsA:d.w4?Array.from(d.w4.slice(ia*4,ia*4+4)):null,
            weightsB:d.w4?Array.from(d.w4.slice(ib*4,ib*4+4)):null};
        }
        perDraw.push({name:d.name,group:d.grp,vertices:d.pos.length/3,worst});
      }
      perDraw.sort((a,b)=>b.worst.deltaMm-a.worst.deltaMm);
      return {phaseDeg:deg,top:perDraw.slice(0,6)};
  },phaseDeg));
}
await browser.close();
const out=path.join(path.dirname(dir),'..',`pedal-failure-audit-${manifest.candidateId}.json`);
fs.writeFileSync(out,JSON.stringify({candidateId:manifest.candidateId,rows},null,2));
console.log(JSON.stringify({out,summary:rows.map(r=>({phaseDeg:r.phaseDeg,top:r.top.slice(0,3).map(x=>({name:x.name,deltaMm:x.worst.deltaMm,strainPercent:x.worst.strainPercent,weightsA:x.worst.weightsA,weightsB:x.worst.weightsB}))}))},null,2));
