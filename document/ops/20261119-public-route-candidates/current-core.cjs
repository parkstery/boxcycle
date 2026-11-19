// Execute the latest tracked TypeScript source without changing functions/lib.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'node_modules/typescript'));
const source=path.join(root,'functions/src/publicRouteAutoReviewCore.ts');
const filename=path.join(root,'functions/lib/publicRouteAutoReviewCore.js');
const compiled=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(compiled,filename);
module.exports=loaded.exports;
