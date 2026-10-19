/** Browser test of the actual useAppAuth hook with deterministic Firebase callbacks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { createServer } = require('vite');
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../apps/web', import.meta.url));
const authStub = `
export class GoogleAuthProvider {setCustomParameters(){} static credentialFromError(){return null}}
export function onAuthStateChanged(auth,fn){window.listeners.push(fn);fn(auth.currentUser);return()=>{window.listeners=window.listeners.filter(f=>f!==fn)}}
export async function reload(u){return u.reload()}
export async function signOut(auth){window.calls.signOut++;auth.currentUser=null;window.emit(null)}
export async function signInAnonymously(){window.calls.anonymous++;window.emit(window.makeUser('created-guest','ready'))}
export async function linkWithPopup(user){window.calls.popup++;if(window.cancelPopup)throw Object.assign(new Error('cancel'),{code:'auth/popup-closed-by-user'});user.isAnonymous=false;}
export async function signInWithPopup(auth){window.calls.popup++;if(window.cancelPopup)throw Object.assign(new Error('cancel'),{code:'auth/popup-closed-by-user'});const u=window.makeUser('popup-google','ready');u.isAnonymous=false;window.emit(u);return {user:u}}
export async function signInWithCredential(){}
export async function updateProfile(){}
`;
const profileStub = `
export class NicknameTakenError extends Error{}
export async function ensureAnonymousUserTier(){window.calls.writes++}
export async function getUserProfileNickname(){return 'fixture'}
export async function claimNicknameTransaction(){window.calls.writes++}
export async function changeNicknameTransaction(){window.calls.writes++}
`;
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {useAppAuth} from '/src/hooks/useAppAuth.ts';
window.listeners=[];window.calls={anonymous:0,signOut:0,writes:0,popup:0};window.firebase={currentUser:null,async authStateReady(){}};
window.emit=u=>{window.firebase.currentUser=u;for(const f of [...window.listeners])f(u)};
window.makeUser=(uid,mode)=>({uid,isAnonymous:true,mode,async reload(){
 if(this.mode==='held')await new Promise(resolve=>window.releaseVerification=resolve);
 if(this.mode==='deleted'){window.emit(null);throw Object.assign(new Error('missing'),{code:'auth/user-not-found'})}
 if(this.mode==='disabled')throw Object.assign(new Error('disabled'),{code:'auth/user-disabled'});
 if(this.mode==='offline')throw Object.assign(new Error('offline'),{code:'auth/network-request-failed'});
},async getIdToken(){return 'fixture-token'}});
function App(){const h=useAppAuth(true);window.hook=h;return React.createElement('div',{'data-testid':'state'},JSON.stringify({uid:h.user?.uid??null,offline:h.authOffline,phase:h.authRestore,expiry:h.authExpiryKind}))}
createRoot(document.getElementById('root')).render(React.createElement(App));
`;

test('actual authentication hook preserves identity and handles restore callback races', { timeout: 90000 }, async t => {
  const modules = new Map([
    ['firebase/auth', authStub],
    ['../lib/firebase/app', 'export function getFirebaseAuth(){return window.firebase};export async function ensureAuthPersistence(){}'],
    ['../lib/identity/repo/firestoreUser', profileStub],
    ['../lib/identity/repo/guestLifecycleApi', 'export async function postGuestLink(){return {ok:true,leaseToken:"fixture-lease-token"}};export async function postGuestActivity(){return window.activityResult??"ok"}'],
  ]);
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{
    name: 'supervisor-auth-fixture', enforce: 'pre',
    resolveId(id, importer) {
      if (id === '/supervisor-fixture.js') return '\0fixture';
      if (importer?.replaceAll('\\', '/').endsWith('/src/hooks/useAppAuth.ts') && modules.has(id)) return '\0mock:' + id;
    },
    load(id) { if (id === '\0fixture') return fixture; if (id.startsWith('\0mock:')) return modules.get(id.slice(6)); },
    configureServer(s) { s.middlewares.use(async (req, res, next) => {
      if (req.url !== '/supervisor-auth') return next();
      res.setHeader('Content-Type', 'text/html');res.end(await s.transformIndexHtml('/supervisor-auth', '<html><body><div id="root"></div><script type="module" src="/supervisor-fixture.js"></script></body></html>'));
    }); },
  }] });
  let browser;
  try {
    await server.listen(); const url = `http://127.0.0.1:${server.httpServer.address().port}/supervisor-auth`;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    async function pageFixture() {
      const context = await browser.newContext({ viewport: { width: 667, height: 300 } });
      const page = await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);await page.waitForFunction(()=>Boolean(window.hook),{},{timeout:15000});
      assert.deepEqual(errors, []);return { context, page };
    }
    await t.test('ending and starting three times preserves the same verified Guest without signOut', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('persistent-guest','ready')));
      await page.waitForFunction(()=>window.hook.user?.uid==='persistent-guest');
      for(let round=0;round<3;round++) {
        await page.evaluate(()=>window.hook.endAppUse());
        await page.waitForFunction(()=>window.hook.user===null && window.hook.appUseEnded);
        assert.equal(await page.evaluate(()=>window.firebase.currentUser?.uid),'persistent-guest');
        await page.evaluate(()=>window.hook.beginAuthenticatedSession());
        await page.waitForFunction(()=>window.hook.user?.uid==='persistent-guest' && !window.hook.appUseEnded);
      }
      assert.deepEqual(await page.evaluate(()=>[window.calls.anonymous,window.calls.signOut]),[0,0]);await context.close();
    });
    await t.test('ended Guest cannot mint a replacement while offline or lifecycle blocked', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('held-existing','ready')));
      await page.waitForFunction(()=>window.hook.user?.uid==='held-existing');
      await page.evaluate(async()=>{window.hook.endAppUse();window.firebase.currentUser.mode='offline';await window.hook.beginAuthenticatedSession()});
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      await page.evaluate(async()=>{window.firebase.currentUser.mode='ready';window.activityResult='stop';await window.hook.beginAuthenticatedSession()});
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.deepEqual(await page.evaluate(()=>[window.calls.anonymous,window.calls.signOut]),[0,0]);await context.close();
    });
    await t.test('ending during pending verification keeps the identity hidden after verification resolves', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('ending-pending','held')));
      await page.waitForFunction(()=>typeof window.releaseVerification==='function');
      await page.evaluate(()=>{window.hook.endAppUse();window.releaseVerification()});await page.waitForTimeout(200);
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.equal(await page.evaluate(()=>window.calls.writes),0);await context.close();
    });
    await t.test('ended Guest can link Google without an Auth callback and leave the start menu', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('link-guest','ready')));
      await page.waitForFunction(()=>window.hook.user?.uid==='link-guest');
      await page.evaluate(async()=>{window.hook.endAppUse();await window.hook.handleGoogleSignIn()});
      await page.waitForFunction(()=>window.hook.user?.uid==='link-guest' && !window.hook.user.isAnonymous && !window.hook.appUseEnded,{},{timeout:10000});
      assert.deepEqual(await page.evaluate(()=>[window.calls.anonymous,window.calls.signOut,window.calls.popup]),[0,0,1]);await context.close();
    });
    await t.test('Google popup cancellation keeps an ended Guest hidden and its session intact', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('cancel-guest','ready')));
      await page.waitForFunction(()=>window.hook.user?.uid==='cancel-guest');
      await page.evaluate(async()=>{window.hook.endAppUse();window.cancelPopup=true;await window.hook.handleGoogleSignIn()});
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.equal(await page.evaluate(()=>window.hook.appUseEnded),true);
      assert.equal(await page.evaluate(()=>window.firebase.currentUser?.uid),'cancel-guest');await context.close();
    });
    await t.test('Google popup from an empty ended session opens the authenticated account', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(async()=>{window.hook.endAppUse();await window.hook.handleGoogleSignIn()});
      await page.waitForFunction(()=>window.hook.user?.uid==='popup-google' && !window.hook.appUseEnded,{},{timeout:10000});
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('candidate stays hidden and creates no new Guest while server verification is pending', async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('held-guest','held')));
      await page.waitForFunction(()=>typeof window.releaseVerification==='function');
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.equal(await page.evaluate(()=>window.calls.writes),0);
      await page.evaluate(()=>window.releaseVerification());
      await page.waitForFunction(()=>window.hook.user?.uid==='held-guest');
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('a previous pending verification cannot replace a newly verified identity',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('old-pending','held')));
      await page.waitForFunction(()=>typeof window.releaseVerification==='function');
      await page.evaluate(()=>window.emit(window.makeUser('new-identity','ready')));
      await page.waitForFunction(()=>window.hook.user?.uid==='new-identity');
      await page.evaluate(()=>window.releaseVerification());await page.waitForTimeout(200);
      assert.equal(await page.evaluate(()=>window.hook.user?.uid),'new-identity');await context.close();
    });
    await t.test('explicit logout cancels pending verification without restoring its identity',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>window.emit(window.makeUser('logout-pending','held')));
      await page.waitForFunction(()=>typeof window.releaseVerification==='function');
      await page.evaluate(async()=>{await window.hook.completeFirebaseSignOut();window.releaseVerification()});
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('SDK null callback during deleted Guest verification never creates a replacement',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>{sessionStorage.setItem('boxcycle_guest_entry_v1','1');localStorage.setItem('boxcycle_calorie_profile_v1_deleted-guest','fixture');localStorage.setItem('boxcycle_calorie_profile_v1_google-other','preserve');window.emit(window.makeUser('deleted-guest','deleted'))});
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0,'automatic account creation must stay disabled');
      assert.equal(await page.evaluate(()=>window.hook.user?.uid??null),null);
      assert.equal(await page.evaluate(()=>window.hook.authExpiryKind),'guest-expired','confirmed deletion must retain expiry notice despite SDK null callback');
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_deleted-guest')),null,'only the deleted Guest cache must be cleared');
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_google-other')),'preserve');
      await context.close();
    });
    await t.test('network failure retains local data and retry restores the same UID',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>{localStorage.setItem('boxcycle_calorie_profile_v1_offline-guest','preserve');window.emit(window.makeUser('offline-guest','offline'))});
      await page.waitForFunction(()=>window.hook.authOffline===true);
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_offline-guest')),'preserve');
      assert.equal(await page.evaluate(()=>window.calls.writes),0);
      await page.evaluate(async()=>{window.firebase.currentUser.mode='ready';await window.hook.retryAuthRestore()});
      await page.waitForFunction(()=>window.hook.user?.uid==='offline-guest');
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('offline retry that confirms Guest deletion retains the expiry notice across SDK null',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>{localStorage.setItem('boxcycle_calorie_profile_v1_retry-deleted','fixture');window.emit(window.makeUser('retry-deleted','offline'))});
      await page.waitForFunction(()=>window.hook.authOffline===true);
      await page.evaluate(async()=>{window.firebase.currentUser.mode='deleted';await window.hook.retryAuthRestore()});
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>window.hook.authExpiryKind),'guest-expired');
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_retry-deleted')),null);
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('offline retry confirming Google deletion preserves its local records',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>{localStorage.setItem('boxcycle_calorie_profile_v1_retry-google','preserve');const u=window.makeUser('retry-google','offline');u.isAnonymous=false;window.emit(u)});
      await page.waitForFunction(()=>window.hook.authOffline===true);
      await page.evaluate(async()=>{window.firebase.currentUser.mode='deleted';await window.hook.retryAuthRestore()});
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>window.hook.authExpiryKind),'account-unavailable');
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_retry-google')),'preserve');
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);await context.close();
    });
    await t.test('disabled Google account keeps its existing local records',async()=>{
      const {context,page}=await pageFixture();
      await page.evaluate(()=>{localStorage.setItem('boxcycle_calorie_profile_v1_google-disabled','preserve');const u=window.makeUser('google-disabled','disabled');u.isAnonymous=false;window.emit(u)});
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(()=>localStorage.getItem('boxcycle_calorie_profile_v1_google-disabled')),'preserve');
      assert.equal(await page.evaluate(()=>window.calls.anonymous),0);
      assert.equal(await page.evaluate(()=>window.calls.writes),0);await context.close();
    });
  } finally { await browser?.close();await server.close(); }
});
