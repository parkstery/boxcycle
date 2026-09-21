#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const dir=path.resolve(process.argv[2]);
const flexArg=process.argv[3]??'0';
const adaptive=flexArg==='adaptive';
const directional=flexArg==='directional';
const matchKnee=flexArg==='match-knee';
const ankleFlexDeg=(adaptive||directional||matchKnee)?0:Number(flexArg);
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.goto(pathToFileURL(manifest.outputs.viewer).href);await page.waitForFunction(()=>Boolean(window.__RTW_CAPTURE__));await page.waitForTimeout(800);
await page.evaluate(deg=>{window.__RTW_CAPTURE__.setMode('bind');window.__ORIGINAL_ANKLE_OFFSET__=ankleOffset;ankleOffset=side=>V3.sub(RIG0.ankle[side],PEDAL0[side]);S.af=deg;},ankleFlexDeg);
const rows=[];
for(const phaseDeg of [0,45,90,135,180,225,270,315,360]){
  await page.evaluate(({deg,adaptive,directional,matchKnee})=>{
    crankAngle=deg*Math.PI/180;
    const flexAmp=S.af*Math.PI/180, chosen={};
    const targetKnee={};
    if(matchKnee){
      const constant=ankleOffset;ankleOffset=window.__ORIGINAL_ANKLE_OFFSET__;
      for(const side of ['R','L']){solveLeg(side,pedalPos(side,crankAngle),0);targetKnee[side]=pose[side].kneeAng;}
      ankleOffset=constant;
    }
    for(const side of ['R','L']){
      let flex=flexAmp*Math.sin(crankPhase[side]-crankAngle+Math.PI/2);
      if(directional){
        const bind=V3.sub(RIG0.ankle[side],PEDAL0[side]);
        const k=(side==='R'?1:-1)*Math.cos(crankAngle),v=V3.add(ANK.C,V3.mul(ANK.D,k));
        const desired=[v[0],v[1],side==='R'?v[2]:-v[2]];
        flex=Math.atan2(desired[1],desired[0])-Math.atan2(bind[1],bind[0]);
      }
      if(adaptive){
        flex=0;solveLeg(side,pedalPos(side,crankAngle),flex);
        if(pose[side].clamped){
          outer: for(let abs=.25;abs<=45;abs+=.25)for(const sign of [1,-1]){
            const test=abs*sign*Math.PI/180;solveLeg(side,pedalPos(side,crankAngle),test);
            if(!pose[side].clamped){flex=test;break outer;}
          }
        }
      }
      if(matchKnee){
        let best={score:Infinity,flex:0};
        for(let angle=-45;angle<=45;angle+=.25){const test=angle*Math.PI/180;solveLeg(side,pedalPos(side,crankAngle),test);
          if(pose[side].clamped)continue;const score=Math.abs(pose[side].kneeAng-targetKnee[side]);if(score<best.score)best={score,flex:test};}
        flex=best.flex;
      }
      chosen[side]=flex;solveLeg(side,pedalPos(side,crankAngle),flex);
    }
    window.__CHOSEN_FLEX__=chosen;
    updateSkin('R',S.kb/1000,S.hb/1000,S.ab/1000,false);
    updateSkin('L',S.kb/1000,S.hb/1000,S.ab/1000,false);
  },{deg:phaseDeg,adaptive,directional,matchKnee});
  rows.push(await page.evaluate(deg=>{
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    const vertices=group=>{const m=groupMatrix(group,crankAngle),out=[];for(const d of draws)if(d.grp===group)for(let i=0;i<d.restPos.length;i+=3)out.push(M4.xform(m,[d.restPos[i],d.restPos[i+1],d.restPos[i+2]]));return out;};
    const closest=(a,b)=>{let best=Infinity;for(const p of a)for(const q of b)best=Math.min(best,distance(p,q));return best*1000;};
    return {phaseDeg:deg,rightFlexDeg:window.__CHOSEN_FLEX__.R*180/Math.PI,leftFlexDeg:window.__CHOSEN_FLEX__.L*180/Math.PI,rightClamped:pose.R.clamped,leftClamped:pose.L.clamped,rightDeficitMm:pose.R.deficit*1000,leftDeficitMm:pose.L.deficit*1000,rightKneeDeg:pose.R.kneeAng,leftKneeDeg:pose.L.kneeAng,
      rightContactMm:closest(vertices('footR'),vertices('pedalR')),leftContactMm:closest(vertices('footL'),vertices('pedalL')),
      rightAnkleErrorMm:distance(pose.R.Anew,pose.R.Atgt)*1000,leftAnkleErrorMm:distance(pose.L.Anew,pose.L.Atgt)*1000};
  },phaseDeg));
}
await browser.close();console.log(JSON.stringify({adaptive,directional,matchKnee,ankleFlexDeg,rows,worst:{contactMm:Math.max(...rows.flatMap(r=>[r.rightContactMm,r.leftContactMm])),anyClamped:rows.some(r=>r.rightClamped||r.leftClamped),ankleErrorMm:Math.max(...rows.flatMap(r=>[r.rightAnkleErrorMm,r.leftAnkleErrorMm]))}},null,2));
