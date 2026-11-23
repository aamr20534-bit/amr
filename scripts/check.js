// Sanity check: required files exist, JS parses, referenced assets exist, i18n keys are defined.
const fs=require('fs'),path=require('path'),cp=require('child_process'),root=path.join(__dirname,'..');let bad=0;const fail=m=>{console.error('✗',m);bad++};
for(const f of['index.html','style.css','script.js','.gitignore','favicon.png','manifest.json','package.json','README.md','sw.js','capacitor.config.json'])fs.existsSync(path.join(root,f))&&fs.statSync(path.join(root,f)).size>0||fail('missing/empty '+f);
for(const f of['script.js','sw.js',...fs.readdirSync(path.join(root,'js')).map(x=>'js/'+x)])try{cp.execFileSync('node',['--check',path.join(root,f)])}catch{fail('syntax '+f)}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="([^"#:]+\.[a-z]+)"/g))fs.existsSync(path.join(root,m[1]))||fail('index.html -> '+m[1]);
const man=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));for(const i of man.icons)fs.existsSync(path.join(root,i.src))||fail('manifest icon '+i.src);
const dict=fs.readFileSync(path.join(root,'js/i18n.js'),'utf8'),keys=new Set([...dict.matchAll(/([A-Za-z0-9_]+):\[/g)].map(m=>m[1]));
for(const f of['script.js','js/preview.js'])for(const m of fs.readFileSync(path.join(root,f),'utf8').matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g))keys.has(m[1])||fail('i18n key '+m[1]);
console.log(bad?`${bad} problem(s)`:'All checks passed');process.exit(bad?1:0);
