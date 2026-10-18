'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.join(__dirname,'dist');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.swf':'application/x-shockwave-flash','.mp3':'audio/mpeg','.svg':'image/svg+xml','.json':'application/json'};
const port = Number(process.env.BVN_PORT || 4091);
const server = http.createServer((req,res)=>{
  let relative;
  try { relative = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.stat(target,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('资源不存在');return;}
    const headers={'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':/\.(swf|wasm|mp3)$/.test(target)?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'};
    res.writeHead(200,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已占用。请关闭旧服务或设置 BVN_PORT。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;
  console.log('死神 VS 火影 2.6 浏览器版：'+url+'  （Ctrl+C 退出）');
  if(process.argv.includes('--open')&&process.platform==='win32')spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();
});
