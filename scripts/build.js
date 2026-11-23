// Copies the web app into www/ (Capacitor webDir). No external dependencies.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..'),out=path.join(root,'www');
const items=['index.html','style.css','script.js','manifest.json','sw.js','favicon.png','js','icons','fonts'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const i of items)fs.cpSync(path.join(root,i),path.join(out,i),{recursive:true});
console.log('Built -> www/');
// Native app: ship the real Capacitor runtime (registerPlugin etc.) with the page. Only in www/, the web/PWA index.html stays untouched.
try{const core=path.join(root,'node_modules','@capacitor','core','dist','capacitor.js');
 if(fs.existsSync(core)){fs.copyFileSync(core,path.join(out,'js','capacitor-core.js'));
  const f=path.join(out,'index.html');let h=fs.readFileSync(f,'utf8');
  if(!h.includes('capacitor-core.js'))h=h.replace('<script src="js/db.js">','<script src="js/capacitor-core.js"></script>\n<script src="js/db.js">');fs.writeFileSync(f,h);console.log('Capacitor runtime added')}}catch(e){console.log('Capacitor runtime skipped:',e.message)}

