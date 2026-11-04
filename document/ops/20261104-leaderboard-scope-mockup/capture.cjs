// 순위 범위 시안 캡처. 미리보기 서버(apps/web: VITE_FIREBASE_PROJECT_ID=boxcycle-dc2df npx vite --port 5298) 뒤 node capture.cjs
const path=require("node:path");const {chromium}=require(path.resolve(__dirname,"../../../node_modules/@playwright/test"));
const OUT=__dirname+"/";
const CSS=`
.lb-scope-btn{height:24px;padding:0 8px;border:1px solid #C9D6EE;background:#fff;font:inherit;font-size:12px;font-weight:600;color:#2A2E37;border-radius:8px;white-space:nowrap}
.lb-scope-seg{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:#F2F3F5}
.lb-scope-seg button{height:20px;padding:0 7px;border:0;border-radius:6px;background:transparent;font:inherit;font-size:12px;font-weight:600;color:#5E6472;white-space:nowrap}
.lb-scope-seg button.on{background:#fff;color:#121417;box-shadow:0 1px 2px #0002}
.lb-new{outline:2px dashed #f59e0b;outline-offset:2px;border-radius:8px}`;
const variants={
  now:null,
  a_world:`<button class="lb-scope-btn lb-new">세계 ▾</button>`,
  a_country:`<button class="lb-scope-btn lb-new">대한민국 ▾</button>`,
  b:`<span class="lb-scope-seg lb-new"><button class="on">세계</button><button>아시아</button><button>대한민국</button></span>`,
};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
for(const [name,html] of Object.entries(variants)) for(const size of [{width:800,height:360},{width:699,height:273}]){
 const c=await b.newContext({viewport:size,deviceScaleFactor:2,timezoneId:"Asia/Seoul"});const p=await c.newPage();
 await p.goto("http://127.0.0.1:5298/scripts/ui-800x360/preview.html?state=leaderboard&lb=ten");
 await p.waitForSelector(".leaderboard-sheet__scope",{timeout:20000});await p.waitForSelector(".leaderboard-sheet__me-area :not(.leaderboard-sheet__loading)",{timeout:20000}).catch(()=>{});await p.waitForTimeout(1200);
 const m=await p.evaluate(([html,css])=>{const st=document.createElement("style");st.textContent=css;document.head.append(st);
  const sc=document.querySelector(".leaderboard-sheet__scope");if(html!==null)sc.innerHTML=html;
  const top=document.querySelector(".leaderboard-sheet__top").getBoundingClientRect();const panel=document.querySelector(".leaderboard-sheet__panel").getBoundingClientRect();
  const close=document.querySelector(".leaderboard-sheet__close").getBoundingClientRect();const s=sc.getBoundingClientRect();
  return {topH:Math.round(top.height),panelW:Math.round(panel.width),panelH:Math.round(panel.height),scopeW:Math.round(s.width),gapToClose:Math.round(close.left-s.right)};},[html,CSS]);
 console.log(name,size.width,JSON.stringify(m));
 await p.screenshot({path:`${OUT}${name}-${size.width}x${size.height}.png`});await c.close();}
await b.close();})();
