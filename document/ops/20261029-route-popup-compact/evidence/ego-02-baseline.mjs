const task=await taskSpace(10);const page=task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:699,height:273,deviceScaleFactor:1,mobile:false});
console.log(await page.evaluate(async()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='/src/components/map/MapView.css';document.head.append(css);
  const {buildPickPopup}=await import('/src/components/map/mapPopupElements.ts');
  const host=document.createElement('div');host.id='compact-independent';host.className='map-view';
  Object.assign(host.style,{position:'absolute',inset:'0',zIndex:'100',background:'#e6e9ed',display:'flex',alignItems:'center',justifyContent:'center'});
  const popup=buildPickPopup({lngLat:[127,37],initialStart:[127,37],initialHasStart:true,initialHasEnd:true,initialHasRoute:true,routeProfile:'cycling',getWaypointCount:()=>0,accessToken:'',signal:new AbortController().signal,onSelectPoint:()=>{},onRouteProfile:()=>{},onClearRoute:()=>{},getCanStartRide:()=>true,onStartRide:()=>{},closePopup:()=>{}});
  host.append(popup);document.body.append(host);return {mounted:true};
}));
console.log(await page.snapshot());
console.log(await page.evaluate(()=>{const popup=document.querySelector('#compact-independent .map-view__pick');return {panel:popup.getBoundingClientRect().toJSON(),tabs:[...popup.querySelectorAll('[role=tab]')].map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()}))};}));
