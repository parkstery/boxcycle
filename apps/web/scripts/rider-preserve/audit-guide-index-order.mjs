#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const dir=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.goto(pathToFileURL(manifest.outputs.viewer).href);await page.waitForFunction(()=>Boolean(window.__RTW_CAPTURE__));await page.waitForTimeout(800);
const result=await page.evaluate(()=>draws.filter(d=>/continuous knee skin/.test(d.name)).map(d=>{
  const rows=AUTHORED_GUIDES[d.name];let max=0,sum=0;
  for(let i=0;i<rows.length;i++){const q=rows[i].p,p=[d.restPos[i*3],d.restPos[i*3+1],d.restPos[i*3+2]],v=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);max=Math.max(max,v);sum+=v*v;}
  const byPosition=new Map();for(const row of rows){const k=row.p.map(v=>v.toFixed(7)).join(',');byPosition.set(k,(byPosition.get(k)||0)+1);}
  return {name:d.name,drawVertices:d.restPos.length/3,guideVertices:rows.length,directIndexMaxDistanceMm:max*1000,directIndexRmsDistanceMm:Math.sqrt(sum/rows.length)*1000,coincidentPositionCount:[...byPosition.values()].filter(n=>n>1).reduce((a,n)=>a+n,0)};
}));
await browser.close();console.log(JSON.stringify(result,null,2));
