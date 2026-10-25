import {test,expect} from '@playwright/test';

/*
 * 10-25 Chief — 주행 시작 순간 RouteDock 이 펼친 채 한 번 그려졌다가 접히는 깜빡임(감리40 LOW).
 * stage 가 바뀐 렌더가 펼친 상태로 commit 된 뒤 effect 가 접으면 commit 이 2번이다.
 * 같은 렌더 안에서 접으면 1번이고, 펼친 카드는 화면에 나오지 않는다.
 */
test('주행 시작·종료 때 RouteDock 접힘·펼침은 한 번의 commit 으로 끝난다',async({page})=>{
  await page.goto('/scripts/ui-800x360/preview.html?state=idle');
  const result=await page.evaluate(async()=>{
    const R=await import('/@id/react');
    const React=(R.createElement?R:R.default) as typeof import('react');
    const RD=await import('/@id/react-dom/client');
    const createRoot=(RD.createRoot??RD.default.createRoot) as typeof import('react-dom/client').createRoot;
    const RDF=await import('/@id/react-dom');
    const flushSync=(RDF.flushSync??RDF.default.flushSync) as typeof import('react-dom').flushSync;
    const {RouteDock}=await import('/src/components/route-dock/RouteDock.tsx');
    const host=document.createElement('div');document.body.append(host);
    const root=createRoot(host);
    let commits=0;
    const openSeen:boolean[]=[];
    const stops=[
      {id:'start',kind:'start',label:'출발 주소',loading:false,lngLat:[127,37]},
      {id:'end',kind:'end',label:'도착 주소',loading:false,lngLat:[127.01,37.01]},
    ];
    const render=(stage:string)=>flushSync(()=>root.render(React.createElement(React.Profiler,{id:'dock',onRender:()=>{
      commits+=1;
      openSeen.push(Boolean(host.querySelector('.route-dock-anchor--open')));
    }},React.createElement(RouteDock as never,{stage,stops,routeLoading:false,onRemoveStop(){},onFocusStop(){}}))));
    render('ready');
    await new Promise(r=>setTimeout(r,50));
    const readyOpen=Boolean(host.querySelector('.route-dock-anchor--open'));
    commits=0;openSeen.length=0;
    render('riding');
    await new Promise(r=>setTimeout(r,50));
    const riding={commits,openSeen:[...openSeen],open:Boolean(host.querySelector('.route-dock-anchor--open'))};
    commits=0;openSeen.length=0;
    render('ready');
    await new Promise(r=>setTimeout(r,50));
    const back={commits,openSeen:[...openSeen],open:Boolean(host.querySelector('.route-dock-anchor--open'))};
    root.unmount();host.remove();
    return {readyOpen,riding,back};
  });
  expect(result.readyOpen).toBe(true);
  expect(result.riding).toEqual({commits:1,openSeen:[false],open:false});
  expect(result.back).toEqual({commits:1,openSeen:[true],open:true});
});
