'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'sources/asset-manifest.json'),'utf8').replace(/^\uFEFF/,''));let checks=0;
for(const item of [manifest.game,...manifest.assets]){
  const data=fs.readFileSync(path.join(root,'dist/game',item.file));
  assert.equal(data.length,item.bytes,item.file+' size');checks++;
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),item.sha256,item.file+' checksum');checks++;
  if(item.file.endsWith('.swf')){assert.equal(data.subarray(0,3).toString(),'CWS',item.file+' signature');const expanded=zlib.inflateSync(data.subarray(8));assert.equal(expanded.length+8,data.readUInt32LE(4),item.file+' complete SWF');checks+=2;}
}
assert.equal(manifest.assets.length,74);checks++;
new vm.Script(fs.readFileSync(path.join(root,'dist/app.js'),'utf8'));checks++;
const runtime=path.join(root,'dist/vendor/ruffle');const pkg=JSON.parse(fs.readFileSync(path.join(runtime,'package.json')));assert.equal(pkg.version,'0.7.1');checks++;
for(const f of fs.readdirSync(runtime).filter(n=>n.endsWith('.wasm'))){assert.equal(fs.readFileSync(path.join(runtime,f)).subarray(0,4).toString('hex'),'0061736d');checks++;}
for(const file of ['index.html','style.css','app.js','icon.svg','vendor/ruffle/ruffle.js'])assert.ok(fs.statSync(path.join(root,'dist',file)).size>0);
console.log(`${checks} checks passed: all 75 game files are complete and match source checksums; SWFs inflate correctly; browser code parses; Ruffle 0.7.1 WASM assets are valid.`);
