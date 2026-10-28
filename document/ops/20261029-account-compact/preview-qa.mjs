import {chromium} from '../../../node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const folder='C:/20.HDev/boxcycle/document/ops/20261029-account-compact';
await mkdir(folder+'/evidence',{recursive:true});
const html=await readFile(folder+'/mockups/compact-account-dialog.html','utf8');
const browser=await chromium.launch({headless:true});
try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
for(const width of [736,520,320]){
await page.setViewportSize({width,height:420});
await page.setContent('<html><body style="margin:0">'+html+'</body></html>');
results.push(await page.evaluate(()=>{const panel=document.querySelector('.account');const r=panel.getBoundingClientRect();return {viewport:innerWidth,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...panel.querySelectorAll('button')].filter(el=>{const e=el.getBoundingClientRect();return e.width&&(e.left<r.left||e.right>r.right)}).map(el=>el.textContent)};}));
await page.getByRole('button',{name:'마지막 주행',exact:false}).click();
if(!await page.locator('.history').isVisible())throw Error('inline history did not open');
await page.getByRole('button',{name:'마지막 주행',exact:false}).click();
if(width===736)await page.screenshot({path:folder+'/evidence/account-compact.png'});
}
if(errors.length||results.some(r=>r.overflow||r.clipped.length))throw Error(JSON.stringify({errors,results}));
console.log(JSON.stringify(results));await writeFile(folder+'/evidence/geometry.json',JSON.stringify({errors,results},null,2));
}finally{await browser.close();}
