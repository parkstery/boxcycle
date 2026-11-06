const path=require("node:path");const {pathToFileURL}=require("node:url");const {chromium}=require(path.resolve(__dirname,"../../../node_modules/@playwright/test"));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1680,height:900}});
await p.goto(pathToFileURL(path.join(__dirname,"mockup.html")).href);await p.screenshot({path:path.join(__dirname,"mockup.png"),fullPage:true});await b.close();})();
