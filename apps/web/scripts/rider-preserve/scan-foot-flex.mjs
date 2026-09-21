#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import{pathToFileURL}from'node:url';import{chromium}from'playwright';
const dir=path.resolve(process.argv[2]),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage();
await page.goto(pathToFileURL(manifest.outputs.viewer).href);await page.waitForFunction(()=>Boolean(window.__RTW_CAPTURE__));await page.waitForTimeout(800);
const result=await page.evaluate(()=>{window.__RTW_CAPTURE__.setMode('bind');ankleOffset=side=>V3.sub(RIG0.ankle[side],PEDAL0[side]);crankAngle=225*Math.PI/180;
  const rows=[];for(let angle=-90;angle<=90;angle+=2.5){solveLeg('L',pedalPos('L',crankAngle),angle*Math.PI/180);rows.push({angle,deficitMm:pose.L.deficit*1000,clamped:pose.L.clamped,kneeDeg:pose.L.kneeAng,target:pose.L.Atgt});}return rows;});
await browser.close();console.log(JSON.stringify(result,null,2));
