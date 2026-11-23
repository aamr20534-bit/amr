// Tiny static server for local testing: npm start  (http://localhost:8080)
const http=require('http'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const T={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
http.createServer((q,s)=>{let p=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(root))return s.end();if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');
fs.readFile(p,(e,d)=>e?(s.writeHead(404),s.end('404')):(s.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}),s.end(d)))}).listen(8080,()=>console.log('http://localhost:8080'));
