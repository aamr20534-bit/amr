// Copies the web app into www/ (Capacitor webDir). No external dependencies.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..'),out=path.join(root,'www');
const items=['index.html','style.css','script.js','manifest.json','sw.js','favicon.png','js','icons','fonts'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const i of items)fs.cpSync(path.join(root,i),path.join(out,i),{recursive:true});
console.log('Built -> www/');
