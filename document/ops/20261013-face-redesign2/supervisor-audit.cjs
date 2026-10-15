// Read-only audit of color-only UI changes against the committed baseline.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const postcss = require('C:/20.HDev/boxcycle/node_modules/postcss');
const root = process.argv[2];
const git = args => { const r = cp.spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\','/')}`, '-C',root,...args], {encoding:'utf8'}); if(r.status) throw Error(r.stderr); return r.stdout; };
const files = git(['diff','--name-only','e3c4fcc','--','apps/web/src']).trim().split('\n').filter(Boolean);
const errors=[]; const changes=[];
const colorProps = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-start|-end)?)?(-color)?|outline(-color)?|box-shadow|text-shadow|accent-color|caret-color|fill|stroke|filter|scrollbar-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?)$/;
const colorVars=/^--(?:(?:rp|sr)-(?:fg|border|surface|chip|accent|btn-fg)|rtw-(?:bg|panel|text|accent|trace|danger|ok|warn|divider|glass-bg|glass-border|shell-bg|shadow)|[\w-]*(?:color|background|foreground|border|surface|accent|muted|primary|secondary|danger|success|warning|ink|paper|bg|text|line)[\w-]*)/;
const norm = v => v.replace(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^)]*\)|\b(?:transparent|currentColor|white|black|red|blue|green|orange|gold|gray|grey)\b/gi,'COLOR').replace(/var\(--[\w-]+(?:,[^)]*)?\)/g,'COLOR').replace(/\s+/g,' ').trim();
function declarations(css) {
  css=css.replace(/\r\n/g,'\n');
  const out = new Map();
  postcss.parse(css).walkDecls(d=>{
    const context=[]; for(let p=d.parent;p;p=p.parent) { if(p.type==='rule')context.unshift(p.selector); else if(p.type==='atrule')context.unshift('@'+p.name+' '+p.params); }
    const base=context.join('|')+'|'+d.prop; let i=0; while(out.has(base+'|'+i)) i++;
    out.set(base+'|'+i,{prop:d.prop,value:d.value,important:!!d.important,context:context.join('|')});
  }); return out;
}
for(const file of files) {
  if(!file.endsWith('.css')) {changes.push({file,requiresManualReview:true});continue;}
  const before=declarations(git(['show','e3c4fcc:'+file]));
  let after;try{after=declarations(fs.readFileSync(path.join(root,file),'utf8'));}catch(e){errors.push({file,error:String(e)});continue;}
  let changed=0;
  for(const key of new Set([...before.keys(),...after.keys()])) {
    const b=before.get(key),a=after.get(key); if(JSON.stringify(b)===JSON.stringify(a))continue;
    changed++;const d=a||b;
    const schemeOnly=d.prop==='color-scheme'&&b?.value==='dark'&&a?.value==='light';
    const allowed=schemeOnly||colorProps.test(d.prop)||(d.prop.startsWith('--')&&colorVars.test(d.prop));
    if(!allowed)errors.push({file,key,b,a,reason:'non-color property changed'});
    if(b&&a&&b.important!==a.important)errors.push({file,key,reason:'important changed'});
    if(b&&a&&!schemeOnly&&norm(b.value)!==norm(a.value))errors.push({file,key,b:b.value,a:a.value,reason:'inspect non-color components or color keyword/function'});
    if(!a)errors.push({file,key,reason:'declaration removed'});
    if(!b&&a&&/\b(?:url|translate|blur|brightness|scale)\(/.test(a.value))errors.push({file,key,reason:'new non-color function'});
  }
  changes.push({file,colorDeclarationsChanged:changed});
}
console.log(JSON.stringify({files:files.length,changes,errors},null,2));
process.exitCode=errors.length?1:0;
