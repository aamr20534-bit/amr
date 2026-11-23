// File-system drivers. Native (Capacitor plugin "AmrFS" -> Android Storage Access Framework) and Web (File System Access API + OPFS).
// Node id: native = document URI, web = "<rootId>/<relative/path>". Common API is identical for both drivers.
const TRASH='.amr_trash';
const isNative=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const b64=b=>new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result.split(',')[1]);f.onerror=()=>no(f.error);f.readAsDataURL(b)});
const unb64=(s,t)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new Blob([a],{type:t||''})};
const tick=()=>new Promise(r=>setTimeout(r,0));
const MEDIA={id:'media://all',tree:'',name:'MediaStore',ok:true,virtual:true};

const Native=()=>{const P=Capacitor.registerPlugin('AmrFS');let n=0,w=0;
const L={
 async scan(r,start,cb){const sid='s'+(++n),h=await P.addListener('scan',e=>e.sid===sid&&cb(e.items));try{await P.fScan({path:start,sid})}finally{h.remove()}},
 async list(r,id){return(await P.fList({path:id})).items},
 async trashDir(r){return(await P.fTrash({root:r.id})).id},
 async mkdir(r,p,name){return(await P.fMkdir({parent:p,name})).id},
 async rename(id,name){return(await P.fRename({id,name})).id},
 async copy(r,id,dest,name){return(await P.fCopy({id,dest,name})).id},
 async move(id,src,dest){return(await P.fMove({id,dest})).id},
 async del(id){await P.fDelete({id})},
 async write(p,name,blob){return(await P.fWrite({parent:p,name,data:await b64(blob)})).id},
 src:n=>Capacitor.convertFileSrc('file://'+n.id.split('/').map(encodeURIComponent).join('/')),
 async getBlob(n){try{const r=await fetch(L.src(n));if(!r.ok)throw 0;return await r.blob()}catch{return unb64((await P.readBase64({id:n.id})).data,n.mime)}},
 async url(n){return L.src(n)},async open(n){await P.fOpen({id:n.id,mime:n.mime})},async share(n){await P.fShare({id:n.id,mime:n.mime})}};
return{kind:'native',local:L,
 async hasAll(){try{return(await P.hasAllFiles()).granted}catch{return false}},
 async requestAll(){return(await P.requestAllFiles()).granted},
 async roots(){const o=[];try{if((await P.hasAllFiles()).granted){o.push({id:(await P.storageRoot()).path,name:'Internal',ok:true,local:true});return o}}catch{}
  for(const r of(await P.getRoots()).roots)o.push({id:r.doc,tree:r.tree,name:r.name,ok:true});try{if((await P.mediaState()).granted)o.push(MEDIA)}catch{}return o},
 async enableMedia(){const r=await P.recent();if(!r.granted)throw new Error('denied');return MEDIA},
 async addRoot(){const r=await P.pickFolder();return{id:r.doc,tree:r.tree,name:r.name,ok:true}},
 async removeRoot(r){await P.releaseRoot({tree:r.tree})},
 async scan(r,start,cb){if(r.virtual){cb((await P.recent()).items);return}const sid='s'+(++n),h=await P.addListener('scan',e=>e.sid===sid&&cb(e.items));try{await P.scan({tree:r.tree,doc:start,sid,skip:TRASH})}finally{h.remove()}},
 async trashDir(r){const k=(await P.list({tree:r.tree,doc:r.id})).items.find(x=>x.dir&&x.name===TRASH);return k?k.id:(await P.mkdir({parent:r.id,name:TRASH})).id},
 async list(r,id){return(await P.list({tree:r.tree,doc:id})).items},
 async mkdir(r,p,name){return(await P.mkdir({parent:p,name})).id},
 async rename(id,name){return(await P.rename({id,name})).id},
 async copy(r,id,dest,name){return(await P.copy({id,dest,name})).id},
 async move(id,src,dest){return(await P.move({id,src,dest})).id},
 async del(id){await P.delete({id})},
 async write(p,name,blob){return(await P.write({parent:p,name,mime:blob.type||'application/octet-stream',data:await b64(blob)})).id},
 async getBlob(n){try{const r=await fetch(Capacitor.convertFileSrc(n.id));if(!r.ok)throw 0;return await r.blob()}catch{return unb64((await P.readBase64({id:n.id})).data,n.mime)}},
 async url(n){return Capacitor.convertFileSrc(n.id)},
 async open(n){await P.open({id:n.id,mime:n.mime})},
 async share(n){await P.share({id:n.id,mime:n.mime})},
 async storage(){const s=await P.storage();return{total:s.total,free:s.free,real:true}},
 async watch(rs,cb){if(!w){w=1;await P.addListener('changed',cb)}for(const r of rs)if(!r.virtual)await P.watch({tree:r.tree,doc:r.id})},
 pdfInfo:async n=>(await P.pdfInfo({id:n.id})).pages,
 pdfPage:async(n,page,width)=>'data:image/png;base64,'+(await P.pdfPage({id:n.id,page,width})).data}};

const Web=()=>{const H=new Map(),U=new Map();const last=id=>id.slice(id.lastIndexOf('/')+1),par=id=>id.slice(0,id.lastIndexOf('/'));
const h=async id=>{const[rid,...p]=id.split('/');let d=H.get(rid);if(!d)throw new Error('root');for(let i=0;i<p.length-1;i++)d=await d.getDirectoryHandle(p[i]);if(!p.length)return d;const l=p[p.length-1];try{return await d.getFileHandle(l)}catch{return await d.getDirectoryHandle(l)}};
const put=async(d,name,blob)=>{const f=await d.getFileHandle(name,{create:true}),w=await f.createWritable();await w.write(blob);await w.close()};
const cp=async(s,d)=>{for await(const[n,x]of s.entries())x.kind==='file'?await put(d,n,await x.getFile()):await cp(x,await d.getDirectoryHandle(n,{create:true}))};
const W={kind:'web',
 async roots(){const out=[];try{const o=await navigator.storage.getDirectory();H.set('opfs',o);out.push({id:'opfs',name:'AMR Storage',ok:true,priv:true})}catch{}
  for(const r of await DB.all('handles')){H.set(r.id,r.handle);let ok=false;try{ok=(await r.handle.queryPermission({mode:'readwrite'}))==='granted'}catch{}out.push({id:r.id,name:r.name,ok})}return out},
 async addRoot(){if(!window.showDirectoryPicker)throw new Error('nopicker');const handle=await showDirectoryPicker({mode:'readwrite'});const id='r'+Date.now().toString(36);await DB.set('handles',id,{id,name:handle.name,handle});H.set(id,handle);return{id,name:handle.name,ok:true}},
 async grant(r){const x=H.get(r.id);return(await x.requestPermission({mode:'readwrite'}))==='granted'},
 async removeRoot(r){await DB.del('handles',r.id);H.delete(r.id)},
 async list(r,id){const d=await h(id),o=[];for await(const[name,x]of d.entries()){if(name===TRASH)continue;const dir=x.kind==='directory';let size=0,mod=0;if(!dir){const f=await x.getFile();size=f.size;mod=f.lastModified}o.push({id:id+'/'+name,name,dir,size,mod,parent:id})}return o},
 async scan(r,start,cb){const q=[start];let k=0;while(q.length){const items=await W.list(r,q.shift());cb(items);for(const i of items)if(i.dir)q.push(i.id);if(++k%20===0)await tick()}},
 async trashDir(r){await(await h(r.id)).getDirectoryHandle(TRASH,{create:true});return r.id+'/'+TRASH},
 async mkdir(r,p,name){await(await h(p)).getDirectoryHandle(name,{create:true});return p+'/'+name},
 async rename(id,name){const nid=par(id)+'/'+name,x=await h(id);if(x.move){try{await x.move(name);return nid}catch{}}await W.copy(null,id,par(id),name);await W.del(id);return nid},
 async copy(r,id,dest,name){const s=await h(id),d=await h(dest);if(s.kind==='file')await put(d,name,await s.getFile());else await cp(s,await d.getDirectoryHandle(name,{create:true}));return dest+'/'+name},
 async move(id,src,dest){const name=last(id),s=await h(id),d=await h(dest);if(s.move){try{await s.move(d,name);return dest+'/'+name}catch{}}await W.copy(null,id,dest,name);await W.del(id);return dest+'/'+name},
 async del(id){await(await h(par(id))).removeEntry(last(id),{recursive:true})},
 async write(p,name,blob){await put(await h(p),name,blob);return p+'/'+name},
 async getBlob(n){return(await h(n.id)).getFile()},
 async url(n){const f=await W.getBlob(n),k=n.id+f.lastModified;if(!U.has(k))U.set(k,URL.createObjectURL(f));return U.get(k)},
 async open(n){window.open(await W.url(n),'_blank')},
 async share(n){const f=await W.getBlob(n);if(navigator.canShare&&navigator.canShare({files:[f]}))return navigator.share({files:[f],title:n.name});throw new Error('noshare')},
 async download(n){const a=document.createElement('a');a.href=await W.url(n);a.download=n.name;document.body.appendChild(a);a.click();a.remove()},
 async storage(){const e=await navigator.storage.estimate();return{total:e.quota||0,free:(e.quota||0)-(e.usage||0),real:false}},
 async watch(){},
 pdfInfo:null,pdfPage:null};return W};

// Best-effort driver for WebView wrappers (e.g. HTML->APK builders): reads device storage through file:// directory listings.
// Works only if the wrapper's WebView allows file access from the page AND Android grants storage access. Read-only.
const Device=()=>{const BASE='file:///storage/emulated/0/',D={err:null};
 const U=id=>BASE+id.split('/').slice(1).map(encodeURIComponent).join('/');
 const xhr=(u,type)=>new Promise((ok,no)=>{try{const x=new XMLHttpRequest();x.open('GET',u);x.responseType=type;x.onload=()=>ok(x.response);x.onerror=()=>no(new Error('file access blocked'));x.send()}catch(e){no(e)}});
 const un=s=>s.replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})|\\(.)/g,(m,a,b,c)=>a?String.fromCharCode(parseInt(a,16)):b?String.fromCharCode(parseInt(b,16)):c);
 const lat=s=>s.replace(/[٠-٩]/g,d=>d.charCodeAt(0)-1632).replace(/[۰-۹]/g,d=>d.charCodeAt(0)-1776);
 const sz=s=>{const m=/([\d.,]+)\s*(B|kB|KB|MB|GB|TB)/i.exec(lat(s));if(!m)return 0;return Math.round(parseFloat(m[1].replace(',','.'))*({b:1,kb:1024,mb:1048576,gb:1073741824,tb:1099511627776})[m[2].toLowerCase()])};
 const dt=s=>{s=lat(s);const v=Date.parse(s);if(!isNaN(v))return v;const m=/(\d+)\D+(\d+)\D+(\d+)\D+(\d+):(\d+)(?::(\d+))?\s*([APap]M|ص|م)?/.exec(s);if(!m)return 0;let a=+m[1],b=+m[2],y=+m[3],h=+m[4],d,mo;if(y<100)y+=2000;if(a>12){d=a;mo=b}else if(b>12){mo=a;d=b}else if(/^en-US/i.test(navigator.language)){mo=a;d=b}else{d=a;mo=b}
  if(m[7]&&/p|م/i.test(m[7])&&h<12)h+=12;if(m[7]&&/a|ص/i.test(m[7])&&h===12)h=0;return new Date(y,mo-1,d,h,+m[5],+(m[6]||0)).getTime()};
 Object.assign(D,{
  async list(r,id){let u=U(id);if(!u.endsWith('/'))u+='/';const html=await xhr(u,'text');const o=[],re=/addRow\("((?:[^"\\]|\\.)*)","(?:[^"\\]|\\.)*",(\d),"((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"\)/g;let m;
   while((m=re.exec(html))){const name=un(m[1]);if(name==='..'||name==='.'||(id==='dev'&&name==='Android'))continue;const dir=m[2]==='1';o.push({id:id+'/'+name,name,dir,size:dir?0:sz(m[3]),mod:dt(m[4]),parent:id})}
   if(!o.length&&!/addRow|start\(/.test(html))throw new Error('not a directory listing');return o},
  async probe(){try{await D.list(null,'dev');D.err=null;return true}catch(e){D.err=String(e&&e.message||e);return false}},
  async scan(r,start,cb){const q=[start];let k=0;while(q.length){let items=[];try{items=await D.list(r,q.shift())}catch{}cb(items);for(const i of items)if(i.dir)q.push(i.id);if(++k%10===0)await tick()}},
  async getBlob(n){const b=await xhr(U(n.id),'blob');return new Blob([b],{type:n.mime})},
  async url(n){return U(n.id)},async open(){throw new Error('read-only')},async share(){throw new Error('read-only')}});return D};

const base=isNative?Native():Web(),dev=Device(),isDev=x=>x==='dev'||String(x).startsWith('dev/'),isLoc=x=>isNative&&String(x).startsWith('/'),pick=x=>isDev(x)?dev:isLoc(x)?base.local:base;
const rt=k=>(...a)=>pick(a[0]&&a[0].id!==undefined?a[0].id:a[0])[k](...a);
const FS=Object.assign({},base,{
 async roots(){const o=await base.roots();if(!isNative&&/Android|file:/.test(navigator.userAgent+location.protocol)&&await dev.probe())o.push({id:'dev',name:'Device',ok:true,ro:true,dev:true});FS.devErr=dev.err;return o},
 scan:(r,s,cb)=>pick(r.id).scan(r,s,cb),list:(r,id)=>pick(id).list(r,id),getBlob:rt('getBlob'),url:rt('url'),open:rt('open'),share:rt('share'),trashDir:rt('trashDir'),mkdir:rt('mkdir'),copy:rt('copy'),rename:rt('rename'),move:rt('move'),del:rt('del'),write:rt('write'),devErr:null});
