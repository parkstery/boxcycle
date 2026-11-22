const task=await taskSpace(8);const page=task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1000,height:680,deviceScaleFactor:1,mobile:false});
for(const size of ['800,360','667,300','699,273']){
 await page.click('loc=css:[data-size="'+size+'"]');
 console.log(await page.evaluate(()=>{const stage=document.querySelector('.stage').getBoundingClientRect(),card=document.querySelector('.card').getBoundingClientRect(),hud=document.querySelector('.hud').getBoundingClientRect();return{size:[stage.width,stage.height],card:[card.width,card.height],fits:card.bottom<=stage.bottom&&card.top>=hud.bottom,horizontalOverflow:document.querySelector('.card').scrollWidth>document.querySelector('.card').clientWidth}}));
}
await page.click('loc=css:#dismiss');console.log(await page.evaluate(()=>({closed:document.querySelector('.stage').classList.contains('closed'),rideHudHidden:getComputedStyle(document.querySelector('.distance')).display==='none',sensorStillVisible:getComputedStyle(document.querySelector('.rpm')).display!=='none'})));
await page.click('loc=css:#reset');await page.click('loc=css:[data-size="800,360"]');
console.log(await page.screenshot({path:'C:/20.HDev/boxcycle/document/ops/20261119-ride-summary-mockup/preview.png'}));
