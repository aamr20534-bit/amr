/* AMR FILE MANAGER - main application. Real files only: index is built from the device (Android SAF) or from folders the user grants (web). */
const VERSION='1.0.0',$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES={word:{x:'doc docx docm dot dotx dotm',c:'#2b6cd4',l:'W'},excel:{x:'xls xlsx xlsm xlsb xltx xltm csv ods',c:'#16a34a',l:'X'},ppt:{x:'ppt pptx pptm pps ppsx potx',c:'#ea580c',l:'P'},pdf:{x:'pdf',c:'#dc2626',l:'PDF'},
 image:{x:'jpg jpeg png webp gif svg bmp tiff tif ico heic',c:'#9333ea',i:'image'},video:{x:'mp4 mkv mov avi webm',c:'#db2777',i:'video'},audio:{x:'mp3 wav aac m4a ogg',c:'#0891b2',i:'audio'},
 text:{x:'txt rtf md log json xml html css js',c:'#64748b',i:'text'},zip:{x:'zip rar 7z tar gz',c:'#f59e0b',i:'zip'},other:{c:'#475569',i:'file'},folder:{c:'#f59e0b',i:'folder'}};
const EXT={};for(const[k,v]of Object.entries(TYPES))(v.x||'').split(' ').filter(Boolean).forEach(e=>EXT[e]=k);
const OFFICE='application/vnd.openxmlformats-officedocument.',MIMES={pdf:'application/pdf',txt:'text/plain',csv:'text/csv',json:'application/json',html:'text/html',md:'text/markdown',xml:'text/xml',js:'text/javascript',css:'text/css',zip:'application/zip',doc:'application/msword',xls:'application/vnd.ms-excel',ppt:'application/vnd.ms-powerpoint',docx:OFFICE+'wordprocessingml.document',xlsx:OFFICE+'spreadsheetml.sheet',pptx:OFFICE+'presentationml.presentation',svg:'image/svg+xml',gz:'application/gzip','7z':'application/x-7z-compressed',rar:'application/vnd.rar'};
const mimeOf=(e,ty)=>MIMES[e]||(ty==='image'?'image/'+(e==='jpg'?'jpeg':e):ty==='video'?'video/'+(e==='mkv'?'x-matroska':e==='mov'?'quicktime':e):ty==='audio'?'audio/'+(e==='mp3'?'mpeg':e):'application/octet-stream');
const extOf=n=>{const i=n.lastIndexOf('.');return i>0?n.slice(i+1).toLowerCase():''};
const TABS=[['all','all','#4f46e5'],['folders','folder','#f59e0b'],['image','image','#9333ea'],['pdf','file','#dc2626'],['word','file','#2b6cd4'],['excel','file','#16a34a'],['ppt','file','#ea580c'],['zip','zip','#f59e0b'],['video','video','#db2777'],['audio','audio','#0891b2'],['text','text','#64748b'],['fav','star','#eab308'],['recent','clock','#0ea5a4'],['big','size','#e11d48'],['other','file','#475569']];
const TABIDS=TABS.map(x=>x[0]);
const DEF={theme:'auto',lang:'ar',ic:'m',view:'list',sort:'newest',tabs:TABIDS.slice(),hidden:[],trashDays:30,confirmTrash:true,sec:'home',cur:null,flt:{scope:'all',type:'',date:'',size:''}};
const S={roots:[],set:{...DEF},fav:new Set(),pin:new Set(),hist:[],saved:[],ix:{map:new Map(),kids:new Map()},sec:'home',cur:null,sel:new Set(),selMode:false,clip:null,q:'',flt:{...DEF.flt},trash:[],limit:120,scans:{},busy:0,storage:null,gen:0,carry:new Map(),cache:{}};
const BIG=10*1048576,DAY=864e5;
const SORTS={newest:(a,b)=>b.fs-a.fs,oldest:(a,b)=>a.fs-b.fs,modified:(a,b)=>b.mod-a.mod,nameAsc:(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}),nameDesc:(a,b)=>b.name.localeCompare(a.name,undefined,{numeric:true,sensitivity:'base'}),sizeDesc:(a,b)=>b.size-a.size,sizeAsc:(a,b)=>a.size-b.size,
 type:(a,b)=>a.type.localeCompare(b.type)||SORTS.nameAsc(a,b),ext:(a,b)=>a.ext.localeCompare(b.ext)||SORTS.nameAsc(a,b)};
const AL={صور:'image',صورة:'image',images:'image',image:'image',photos:'image',pictures:'image',مستندات:'doc',مستند:'doc',documents:'doc',docs:'doc',ملفات_مضغوطة:'zip',مضغوطة:'zip',ضغط:'zip',zip:'zip',archives:'zip',فيديو:'video',video:'video',videos:'video',صوت:'audio',audio:'audio',music:'audio',نصوص:'text',text:'text',pdf:'pdf',word:'word',excel:'excel',powerpoint:'ppt'};
const DOCT=['word','excel','ppt','pdf','text'];
/* ---------- helpers ---------- */
const fmtSize=b=>{if(!(b>0))return'0 B';const u=['B','KB','MB','GB','TB'];let i=Math.min(4,Math.floor(Math.log(b)/Math.log(1024)));const v=b/1024**i;return '\u2066'+v.toLocaleString('en',{maximumFractionDigits:i?1:0})+' '+u[i]+'\u2069'};
const loc=()=>S.set.lang==='ar'?'ar-u-nu-latn':'en-GB';
const fmtDate=ts=>ts?new Date(ts).toLocaleDateString(loc(),{year:'numeric',month:'short',day:'numeric'}):t('na');
const fmtTime=ts=>ts?new Date(ts).toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}):'';
const fmtDT=ts=>ts?fmtDate(ts)+' '+fmtTime(ts):t('na');
const pl=(n,f)=>n===1?f[0]:n===2?f[1]:n<=10?f[2]:f[3];
function rel(ts){const s=(Date.now()-ts)/1000,ar=S.set.lang==='ar';if(s<45)return t('now');const m=Math.floor(s/60+.5);
 if(m<60)return ar?'منذ '+(m===1?'دقيقة':m===2?'دقيقتين':m+' '+pl(m,['','','دقائق','دقيقة'])):m+(m===1?' min':' mins')+' ago';
 const h=Math.floor(s/3600);if(h<24)return ar?'منذ '+(h===1?'ساعة':h===2?'ساعتين':h+' '+pl(h,['','','ساعات','ساعة'])):h+(h===1?' hr':' hrs')+' ago';
 const d0=new Date();d0.setHours(0,0,0,0);const dd=Math.ceil((d0-ts)/DAY);if(dd<=1)return t('yesterday');if(dd<7)return ar?'منذ '+(dd===2?'يومين':dd+' أيام'):dd+' days ago';return fmtDate(ts)}
const grp=ts=>{const d=new Date();d.setHours(0,0,0,0);return ts>=d?'today':ts>=d-DAY?'yesterday':ts>=d-6*DAY?'week':'older'};
let tt;const toast=(m,k='')=>{const e=$('#toast');e.textContent=m;e.className='show '+k;clearTimeout(tt);tt=setTimeout(()=>e.className='',k==='err'?4500:2500)};
const prog=on=>{S.busy+=on?1:-1;let p=$('.prg');if(S.busy>0&&!p){p=document.createElement('div');p.className='prg';document.body.appendChild(p)}else if(S.busy<=0&&p){p.remove();S.busy=0}};
/* ---------- persistence ---------- */
const save=()=>DB.set('kv','state',{set:S.set,fav:[...S.fav],pin:[...S.pin],hist:S.hist,saved:S.saved}).catch(()=>{});
/* ---------- index ---------- */
const rootById=id=>S.roots.find(r=>r.id===id),rootOf=n=>rootById(n.root),getN=id=>S.ix.map.get(id);
const kidsOf=id=>[...(S.ix.kids.get(id)||[])].map(getN).filter(Boolean);
function mk(i,r,fresh){const o=getN(i.id),p=getN(i.parent),dir=!!i.dir,ext=dir?'':extOf(i.name),type=dir?'folder':EXT[ext]||'other';
 const n={id:i.id,name:i.name,dir,size:i.size||0,mod:i.mod||0,parent:i.parent,root:r.id,ext,type,mime:i.mime&&!dir&&i.mime!=='application/octet-stream'?i.mime:mimeOf(ext,type),path:i.where!==undefined?r.name+'/'+i.where+i.name:(p?p.path:r.name)+'/'+i.name,
  fs:o?o.fs:i.fs??S.carry.get(i.id)??(fresh?i.mod||0:Date.now())};S.carry.delete(i.id);return n}
function upsert(n){const o=getN(n.id);if(o&&o.parent!==n.parent)S.ix.kids.get(o.parent)?.delete(n.id);S.ix.map.set(n.id,n);if(n.parent){if(!S.ix.kids.has(n.parent))S.ix.kids.set(n.parent,new Set());S.ix.kids.get(n.parent).add(n.id)}S.gen++}
function removeNode(id){const n=getN(id);if(!n)return;if(n.dir){for(const k of [...(S.ix.kids.get(id)||[])])removeNode(k);S.ix.kids.delete(id)}S.ix.kids.get(n.parent)?.delete(id);S.ix.map.delete(id);S.fav.delete(id);S.pin.delete(id);S.sel.delete(id);S.gen++}
function upsertRoot(r){const old=getN(r.id);upsert({virtual:!!r.virtual,id:r.id,name:r.name,dir:true,isRoot:true,size:0,mod:0,parent:null,root:r.id,ext:'',type:'folder',mime:'',path:r.name,fs:old?old.fs:0})}
function subIds(id,out=[]){for(const k of S.ix.kids.get(id)||[]){out.push(k);if(getN(k)?.dir)subIds(k,out)}return out}
let rq=0;const requestRender=()=>{if(!rq)rq=requestAnimationFrame(()=>{rq=0;render()})};
async function reindex(rid,start){const r=rootById(rid);if(!r||!r.ok)return;const full=!start||start===r.id;
 if(full&&S.scans[rid]){S.scans[rid].again=true;return S.scans[rid].p}
 const run=async()=>{const fresh=!S.cache[rid],seen=new Set(),sid=start||r.id,before=subIds(sid);prog(1);
  try{let sig;if(r.virtual){sig=new Set();for(const x of S.ix.map.values())if(!x.dir&&x.root!==r.id)sig.add(x.name+'|'+x.size)}
  await FS.scan(r,sid,items=>{for(const i of items){if(sig&&sig.has(i.name+'|'+i.size))continue;if(r.virtual)i.parent=r.id;seen.add(i.id);upsert(mk(i,r,fresh))}requestRender()});for(const id of before)if(!seen.has(id))removeNode(id);S.cache[rid]=1;
   if(full)DB.set('index',rid,[...S.ix.map.values()].filter(n=>n.root===rid&&!n.isRoot).map(n=>({id:n.id,name:n.name,dir:n.dir,size:n.size,mod:n.mod,parent:n.parent,fs:n.fs}))).catch(()=>{})}
  finally{prog(0)}afterIndex()};
 if(!full)return run();const s=S.scans[rid]={again:false};s.p=(async()=>{try{do{s.again=false;await run()}while(s.again)}catch(e){toast(e.message||String(e),'err')}finally{delete S.scans[rid]}})();return s.p}
const reindexAll=()=>Promise.all(S.roots.map(r=>reindex(r.id)));
function afterIndex(){for(const id of [...S.sel])if(!getN(id)&&!S.trash.some(x=>x.id===id))S.sel.delete(id);if(S.cur&&!getN(S.cur))S.cur=null;requestRender();refreshStorage()}
let stG=-1,ST;const stats=()=>{if(stG===S.gen)return ST;const m=new Map();for(const n of S.ix.map.values()){if(n.dir)continue;let p=getN(n.parent);while(p){const e=m.get(p.id)||(m.set(p.id,{n:0,size:0}),m.get(p.id));e.n++;e.size+=n.size;p=getN(p.parent)}}stG=S.gen;return ST=m};
let cG=-1,CN;function counts(){if(cG===S.gen&&CN)return CN;const c={all:0,folders:0,fav:0,recent:0,big:0,pinned:0,media:0};for(const k of Object.keys(TYPES))c[k]=0;const wk=Date.now()-7*DAY;
 for(const n of S.ix.map.values()){if(n.dir){if(!n.virtual)c.folders++;continue}c.all++;c[n.type]++;if(n.fs>=wk)c.recent++;if(n.size>=BIG)c.big++}c.media=c.video+c.audio;
 for(const id of S.fav)if(getN(id))c.fav++;for(const id of S.pin)if(getN(id))c.pinned++;cG=S.gen;return CN=c}
/* ---------- lists ---------- */
const files=()=>[...S.ix.map.values()].filter(n=>!n.dir);
const SEC_T={image:['image'],pdf:['pdf'],word:['word'],excel:['excel'],ppt:['ppt'],zip:['zip'],video:['video'],audio:['audio'],text:['text'],other:['other'],media:['video','audio']};
function sortList(a){const f=SORTS[S.set.sort]||SORTS.newest;return a.sort((x,y)=>(S.pin.has(y.id)-S.pin.has(x.id))||(y.dir-x.dir)||f(x,y))}
function baseList(){const s=S.sec;
 if(s==='all')return files();if(s==='folders')return S.cur?kidsOf(S.cur):S.roots.map(r=>getN(r.id)).filter(Boolean);
 if(SEC_T[s])return files().filter(n=>SEC_T[s].includes(n.type));
 if(s==='fav')return[...S.fav].map(getN).filter(Boolean);if(s==='pinned')return[...S.pin].map(getN).filter(Boolean);
 if(s==='recent'||s==='home')return files().filter(n=>n.fs>=Date.now()-7*DAY).sort((a,b)=>b.fs-a.fs).slice(0,s==='home'?10:500);
 if(s==='big')return files().filter(n=>n.size>=BIG);return[]}
function matchQ(n,tok,ft){const nm=n.name.toLowerCase();return tok.every(w=>{if(w[0]==='.'&&w.length>1&&n.ext===w.slice(1))return true;const a=AL[w];return nm.includes(w)||(a&&(a==='doc'?DOCT.includes(n.type):n.type===a))})}
function search(){const q=S.q.trim().toLowerCase(),f=S.flt,tok=q.split(/\s+/).filter(Boolean),cur=S.cur&&getN(S.cur),now=Date.now();
 const dl={today:(()=>{const d=new Date();d.setHours(0,0,0,0);return+d})(),week:now-7*DAY,month:now-30*DAY,year:now-365*DAY}[f.date];
 return [...S.ix.map.values()].filter(n=>{if(n.isRoot)return false;if(f.scope==='cur'&&cur&&!(n.path.startsWith(cur.path+'/')))return false;
  if(f.type&&(f.type==='doc'?!DOCT.includes(n.type):n.type!==f.type))return false;if(dl&&n.mod<dl)return false;
  if(f.size==='s'&&(n.dir||n.size>=1048576))return false;if(f.size==='m'&&(n.dir||n.size<1048576||n.size>=52428800))return false;if(f.size==='l'&&(n.dir||n.size<52428800))return false;
  return !tok.length||matchQ(n,tok)})}
const searching=()=>S.sec!=='trash'&&(S.q.trim()||S.flt.type||S.flt.date||S.flt.size);
/* ---------- layers / back ---------- */
const LS=[];let skip=0;
function ov(html,cls=''){const el=document.createElement('div');el.className='ov '+cls;el.innerHTML=html;LS.push(el);$('#layer').appendChild(el);history.pushState({l:1},'');return el}
function popLayer(el){const i=LS.indexOf(el);if(i<0)return;LS.splice(i,1);el.remove();skip++;history.back()}
function pushPv(el){LS.push(el);$('#layer').appendChild(el);history.pushState({l:1},'')}
function onBack(){if(LS.length){LS.pop().remove();return 'layer'}if($('body.menu')){document.body.classList.remove('menu');return true}if(S.selMode){clearSel();return true}if(S.q||!$('#filters').hidden){S.q='';$('#q').value='';$('#filters').hidden=true;requestRender();return true}
 if(S.sec==='folders'&&S.cur){const p=getN(S.cur);S.cur=p&&!p.isRoot?p.parent:null;requestRender();return true}if(S.sec!=='home'){go('home');return true}return false}
history.replaceState({s:0},'');history.pushState({s:1},'');
addEventListener('popstate',()=>{if(skip){skip--;return}const r=onBack();if(r===true)history.pushState({s:1},'')});
/* ---------- dialogs ---------- */
function dlg({title,msg,input,val,ok,danger,cancel=true,body=''}){return new Promise(res=>{const el=ov(`<div class="sheet"><h3>${esc(title||'')}</h3>${msg?`<p>${esc(msg)}</p>`:''}${body}${input?`<input class="inp" id="dI" value="${esc(val||'')}">`:''}<div class="ft">${cancel?`<button class="btn" data-r="0">${t('cancel')}</button>`:''}<button class="btn ${danger?'dg':'pr'}" data-r="1">${ok||t('ok')}</button></div></div>`);
 const done=v=>{popLayer(el);res(v)};el.onclick=e=>{if(e.target===el)return done(null);const b=e.target.closest('[data-r]');if(b)done(b.dataset.r==='1'?(input?$('#dI',el).value:true):null)};
 el.onkeydown=e=>{if(e.key==='Enter'&&input)$('[data-r="1"]',el).click()};const i=$('#dI',el);if(i){i.focus();const d=val&&val.lastIndexOf('.');i.setSelectionRange(0,d>0?d:i.value.length)}})}
function choose(title,opts,cur){return new Promise(res=>{const el=ov(`<div class="sheet"><h3>${esc(title)}</h3>${opts.map(([k,l,ic])=>`<button class="opt ${k===cur?'on':''}" data-k="${k}">${ic?`<svg class="i"><use href="#i-${ic}"/></svg>`:''}${esc(l)}${k===cur?'<svg class="i" style="margin-inline-start:auto"><use href="#i-check"/></svg>':''}</button>`).join('')}</div>`);
 el.onclick=e=>{const b=e.target.closest('[data-k]');if(b||e.target===el){popLayer(el);res(b?b.dataset.k:null)}}})}
function pickDest(title,exclude=[]){return new Promise(res=>{let c=null;const ex=exclude.map(n=>n.dir?n.path:null).filter(Boolean),bad=n=>ex.some(p=>n.path===p||n.path.startsWith(p+'/'));
 const el=ov('<div class="sheet"></div>'),box=$('.sheet',el);
 const draw=()=>{const cn=c&&getN(c),list=(c?kidsOf(c):S.roots.map(r=>getN(r.id)).filter(Boolean)).filter(n=>n.dir&&!bad(n)).sort(SORTS.nameAsc);
  box.innerHTML=`<h3>${esc(title)}</h3><div class="crumbs">${cn?esc(cn.path):t('chooseRoot')}</div>${c?`<button class="opt" data-u="1"><svg class="i"><use href="#i-up"/></svg>..</button>`:''}${list.map(n=>`<button class="opt" data-f="${esc(n.id)}"><svg class="i" style="color:#f59e0b"><use href="#i-folder"/></svg>${esc(n.name)}</button>`).join('')||`<div class="empty">${t('noFolders')}</div>`}
  <div class="ft"><button class="btn" data-m="1" ${c?'':'disabled'}><svg class="i"><use href="#i-plus"/></svg>${t('newFolder')}</button><button class="btn" data-x="0">${t('cancel')}</button><button class="btn pr" data-x="1" ${c&&!(cn&&bad(cn))?'':'disabled'}>${t('chooseHere')}</button></div>`};
 draw();el.onclick=async e=>{const b=e.target;if(b===el){popLayer(el);return res(null)}const f=b.closest('[data-f]'),u=b.closest('[data-u]'),x=b.closest('[data-x]'),m=b.closest('[data-m]');
  if(f){c=f.dataset.f;draw()}else if(u){const p=getN(c);c=p.isRoot?null:p.parent;draw()}else if(m){const nm=await dlg({title:t('newFolder'),input:true,val:t('newFolder')});if(nm){await newFolder(c,nm);draw()}}else if(x){popLayer(el);res(x.dataset.x==='1'?c:null)}}})}
/* ---------- operations ---------- */
const bad=n=>/[\/\\]/.test(n)||!n.trim()||n==='.'||n==='..';
function uniq(parent,name,ext=true){const used=new Set(kidsOf(parent).map(k=>k.name.toLowerCase()));if(!used.has(name.toLowerCase()))return name;const i=ext?name.lastIndexOf('.'):-1,b=i>0?name.slice(0,i):name,e=i>0?name.slice(i):'';for(let k=1;;k++){const c=`${b} (${k})${e}`;if(!used.has(c.toLowerCase()))return c}}
async function run(fn,ok){prog(1);try{const r=await fn();if(ok)toast(ok,'ok');return r}catch(e){toast(errMsg(e),'err');return null}finally{prog(0)}}
const errMsg=e=>{const m=String(e&&e.message||e);return/denied|permission|NotAllowed|Security/i.test(m)?t('errPerm'):/NotFound|not found|exist/i.test(m)?t('errGone'):t('errOp')+': '+m}
const remap=(a,b)=>{for(const s of [S.fav,S.pin])if(s.has(a)){s.delete(a);s.add(b)}};
const ro=n=>{if(n&&isRO(rootOf(n))){toast(t('readOnly'),'err');return true}return false};
const isRO=r=>r&&(r.virtual||r.ro);
const exists=n=>{if(!n||!getN(n.id)){toast(t('errGone'),'err');return false}return true};
async function newFolder(parent,name){const p=getN(parent);if(isRO(rootOf(p)))return toast(t('readOnly'),'err');if(bad(name))return toast(t('badName'),'err');if(kidsOf(parent).some(k=>k.name.toLowerCase()===name.toLowerCase()))return toast(t('exists'),'err');
 await run(async()=>{await FS.mkdir(rootOf(p),parent,name);await reindex(p.root,parent)},t('folderCreated'))}
async function doRename(n){if(!exists(n)||n.isRoot||ro(n))return;const nm=await dlg({title:t('rename'),input:true,val:n.name,ok:t('rename')});if(nm==null||nm===n.name)return;
 if(bad(nm))return toast(t('badName'),'err');if(kidsOf(n.parent).some(k=>k.id!==n.id&&k.name.toLowerCase()===nm.toLowerCase()))return toast(t('exists'),'err');
 await run(async()=>{const id=await FS.rename(n.id,nm);S.carry.set(id,n.fs);remap(n.id,id);await reindex(n.root,n.parent);save()},t('renamed'))}
async function trashMove(n){const r=rootOf(n);r.td=r.td||await FS.trashDir(r);const nn=Date.now()+'_'+n.name,id1=await FS.rename(n.id,nn);let nid;try{nid=await FS.move(id1,n.parent,r.td)}catch(e){try{await FS.rename(id1,n.name)}catch{}throw e}
 const rec={id:nid,name:n.name,orig:n.parent,root:n.root,deleted:Date.now(),size:n.size,dir:n.dir,type:n.type,ext:n.ext,path:n.path,mime:n.mime,fs:n.fs};await DB.set('trash',nid,rec);S.trash.push(rec)}
async function doDelete(ns){ns=ns.filter(n=>getN(n.id)&&!n.isRoot);if(!ns.length||ns.some(ro))return;
 if(S.set.confirmTrash&&!await dlg({title:t('moveToTrash'),msg:ns.length>1?`${ns.length} ${t('items')}`:ns[0].name,ok:t('delete'),danger:true}))return;
 await run(async()=>{let ok=0,fail=0;for(const n of ns){try{await trashMove(n);removeNode(n.id);ok++}catch(e){fail++;toast(errMsg(e),'err')}}
  clearSel();afterIndex();save();for(const r of new Set(ns.map(n=>n.parent)))reindex(getN(r)?.root||'',r);if(ok)toast(`${t('trashed')} (${ok})`+(fail?` / ${t('failed')} ${fail}`:''),fail?'err':'ok')})}
async function transfer(ns,dest,move){const d=getN(dest);if(!d||!d.dir)return toast(t('errGone'),'err');if(isRO(rootOf(d))||(move&&ns.some(n=>isRO(rootOf(n)))))return toast(t('readOnly'),'err');let ok=0;
 await run(async()=>{for(const n of ns){if(!exists(n))continue;if(n.dir&&(d.id===n.id||d.path.startsWith(n.path+'/'))){toast(t('intoSelf'),'err');continue}
  if(move&&n.parent===dest)continue;try{if(rootOf(n).dev){if(n.dir||move){toast(t('readOnly'),'err');continue}await FS.write(dest,uniq(dest,n.name),await FS.getBlob(n));ok++;continue}if(move){let id=n.id;if(kidsOf(dest).some(k=>k.name.toLowerCase()===n.name.toLowerCase())){id=await FS.rename(id,uniq(dest,n.name,!n.dir))}const nid=await FS.move(id,n.parent,dest);S.carry.set(nid,n.fs);remap(n.id,nid);const op=n.parent;removeNode(n.id);await reindex(n.root,op)}
   else await FS.copy(rootOf(n),n.id,dest,uniq(dest,n.name,!n.dir));ok++}catch(e){toast(`${n.name}: ${errMsg(e)}`,'err')}}
  await reindex(d.root,dest);save()});if(ok)toast(`${move?t('moved'):t('copied')} (${ok})`,'ok')}
async function paste(dest){if(!S.clip)return;const ns=S.clip.ids.map(getN).filter(Boolean);const cut=S.clip.cut;await transfer(ns,dest,cut);if(cut)S.clip=null;requestRender()}
async function moveCopy(ns,move){const d=await pickDest(move?t('move'):t('copy'),ns);if(d){await transfer(ns,d,move);clearSel()}}
const toggle=(set,id,msg)=>{set.has(id)?set.delete(id):set.add(id);save();requestRender();if(msg)toast(msg,'ok')};
async function restore(recs){let ok=0;await run(async()=>{for(const rec of recs){try{const r=rootById(rec.root);let dest=getN(rec.orig)?.dir?rec.orig:r.id;const nm=uniq(dest,rec.name,!rec.dir);let id=rec.id;const td=r.td||await FS.trashDir(r);r.td=td;
  id=await FS.rename(id,nm);const nid=await FS.move(id,td,dest);S.carry.set(nid,rec.fs);await DB.del('trash',rec.id);S.trash=S.trash.filter(x=>x.id!==rec.id);S.sel.delete(rec.id);ok++;await reindex(rec.root,dest)}
  catch(e){toast(`${rec.name}: ${errMsg(e)}`,'err');if(/NotFound|not found|exist/i.test(String(e.message))){await DB.del('trash',rec.id);S.trash=S.trash.filter(x=>x.id!==rec.id)}}}});if(ok)toast(`${t('restored')} (${ok})`,'ok');requestRender()}
async function purge(recs,ask=true){if(!recs.length)return;if(ask&&!await dlg({title:t('deleteForever'),msg:t('irreversible')+' ('+recs.length+')',ok:t('deleteForever'),danger:true}))return;
 await run(async()=>{for(const rec of recs){try{await FS.del(rec.id)}catch(e){if(!/NotFound|not found/i.test(String(e.message)))toast(errMsg(e),'err')}await DB.del('trash',rec.id);S.trash=S.trash.filter(x=>x.id!==rec.id);S.sel.delete(rec.id)}},t('deleted'));requestRender();refreshStorage()}
async function autoPurge(){const d=+S.set.trashDays;if(!d)return;const old=S.trash.filter(r=>r.deleted<Date.now()-d*DAY);if(old.length)await purge(old,false)}
async function openExternal(n){try{await FS.open(n)}catch(e){toast(errMsg(e),'err')}}
async function share(n){try{await FS.share(n)}catch{if(FS.download)FS.download(n);else toast(t('errOp'),'err')}}
async function download(n){if(FS.download)return FS.download(n);const d=await pickDest(t('saveCopy'));if(d)await transfer([n],d,false)}
async function openFile(n){if(!exists(n))return;S.opened=S.opened||new Set();if(Preview.can(n))Preview.open(n);else openExternal(n)}
async function extractEntries(n,z,ents,all){const par=getN(n.parent);let base=n.parent;const made=new Map();let ok=0;prog(1);
 try{if(all){const nm=uniq(n.parent,n.name.replace(/\.[^.]+$/,''),false);base=await FS.mkdir(rootOf(n),n.parent,nm);made.set('',base)}
  for(const e of ents){const parts=e.name.split('/').filter(Boolean),fn=parts.pop();if(!fn||parts.some(p=>p==='..'))continue;let pid=base,key='';if(all)for(const p of parts){key+=p+'/';if(!made.has(key))made.set(key,await FS.mkdir(rootOf(n),pid,p));pid=made.get(key)}
   const nm=all?fn:uniq(n.parent,fn);await FS.write(pid,nm,await z.read(e));ok++}await reindex(n.root,n.parent);toast(`${t('extracted')} (${ok})`,'ok')}catch(e){toast(errMsg(e),'err')}finally{prog(0)}}
/* ---------- info ---------- */
async function showInfo(n){const st=n.dir?stats().get(n.id):null,p=getN(n.parent);let rows=[[t('name'),n.name],[t('type'),n.dir?t('folder'):t('ty_'+n.type)],[t('ext'),n.ext||'—'],[t('size'),n.dir?(st?fmtSize(st.size):'0 B'):`${fmtSize(n.size)} (${n.size.toLocaleString('en')} B)`]];
 if(n.dir)rows.push([t('filesCount'),String(st?st.n:0)]);rows.push([t('created'),t('na')],[t('modified'),fmtDT(n.mod)],[t('accessed'),t('na')],[t('added'),n.fs?fmtDT(n.fs):t('na')],[t('path'),n.path],[t('parent'),p?p.name:'—'],[t('status'),[t('available'),S.fav.has(n.id)?t('favorite'):'',S.pin.has(n.id)?t('pinned'):''].filter(Boolean).join(' • ')]);
 const el=ov(`<div class="sheet"><h3>${esc(n.name)}</h3><div id="imgInfo"></div><dl class="kv">${rows.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl><div class="ft"><button class="btn pr" data-r="1">${t('ok')}</button></div></div>`);
 el.onclick=e=>{if(e.target===el||e.target.closest('[data-r]'))popLayer(el)};
 if(n.type==='image'&&!n.dir&&['jpg','jpeg','png','webp','gif','svg','bmp','ico'].includes(n.ext)){try{const url=await FS.url(n),im=new Image();im.src=url;await im.decode();const g=(a,b)=>b?g(b,a%b):a,d=g(im.naturalWidth,im.naturalHeight),ex=n.ext.startsWith('jp')?await readExif(await FS.getBlob(n)):null;
  const r2=[[t('width'),im.naturalWidth+' px'],[t('height'),im.naturalHeight+' px'],[t('format'),n.ext.toUpperCase()],[t('ratio'),`${im.naturalWidth/d}:${im.naturalHeight/d}`]];
  if(ex){if(ex.taken)r2.push([t('taken'),ex.taken]);if(ex.make||ex.model)r2.push([t('camra'),[ex.make,ex.model].filter(Boolean).join(' ')]);if(ex.fnumber)r2.push(['f/',ex.fnumber.toFixed(1)]);if(ex.exposure)r2.push([t('exposure'),ex.exposure<1?'1/'+Math.round(1/ex.exposure)+' s':ex.exposure+' s']);if(ex.iso)r2.push(['ISO',ex.iso]);if(ex.focal)r2.push([t('focal'),ex.focal.toFixed(1)+' mm'])}
  else r2.push(['EXIF',t('na')]);$('#imgInfo',el).innerHTML=`<img src="${esc(url)}" style="width:100%;max-height:220px;object-fit:contain;border-radius:12px;margin-bottom:10px"><dl class="kv" style="margin-bottom:12px">${r2.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`}catch{}}}
/* ---------- action sheet ---------- */
async function itemMenu(n){const tr=S.sec==='trash',rec=tr&&S.trash.find(x=>x.id===n.id),A=[];
 if(tr){A.push(['restore','restore',t('restore')],['info','info',t('info')],['purge','trash',t('deleteForever'),1])}
 else{if(n.dir)A.push(['open','open',t('open')]);else{A.push(['open','open',t('open')]);if(Preview.can(n))A.push(['preview','eye',t('preview')]);A.push(['ext','open',t('openWith')])}
  A.push(['info','info',t('info')]);if(!n.isRoot)A.push(['rename','edit',t('rename')]);A.push(['copy','copy',t('copy')]);if(!n.isRoot)A.push(['cut','cut',t('cut')]);if(n.dir&&S.clip)A.push(['paste','paste',t('paste')]);if(!n.isRoot)A.push(['move','move',t('move')]);
  if(!n.dir){A.push(['share','share',t('share')],['download','download',t('download')])}
  A.push([S.fav.has(n.id)?'unfav':'fav','star',S.fav.has(n.id)?t('unfav'):t('fav')],[S.pin.has(n.id)?'unpin':'pin','pin',S.pin.has(n.id)?t('unpin'):t('pin')]);
  if(S.sec!=='folders'||S.q)A.push(['locate','folder',t('locate')]);if(!n.isRoot)A.push(['del','trash',t('delete'),1])}
 const k=await new Promise(res=>{const el=ov(`<div class="sheet"><h3>${esc(n.name)}</h3><div class="acts">${A.map(([k,ic,l,dg])=>`<button class="act ${dg?'dg':''}" data-k="${k}"><svg class="i"><use href="#i-${ic}"/></svg>${esc(l)}</button>`).join('')}</div></div>`);
  el.onclick=e=>{const b=e.target.closest('[data-k]');if(b||e.target===el){popLayer(el);res(b?b.dataset.k:null)}}});if(!k)return;
 const H={open:()=>n.dir?enter(n.id):openFile(n),preview:()=>Preview.open(n),ext:()=>openExternal(n),info:()=>showInfo(n),rename:()=>doRename(n),copy:()=>{S.clip={ids:[n.id],cut:false};toast(t('copied2'),'ok');requestRender()},cut:()=>{S.clip={ids:[n.id],cut:true};toast(t('cut2'),'ok');requestRender()},
  paste:()=>paste(n.id),move:()=>moveCopy([n],true),share:()=>share(n),download:()=>download(n),fav:()=>toggle(S.fav,n.id,t('favAdded')),unfav:()=>toggle(S.fav,n.id,t('favRemoved')),pin:()=>toggle(S.pin,n.id,t('pinnedOk')),unpin:()=>toggle(S.pin,n.id,t('unpinnedOk')),
  locate:()=>{go('folders');S.q='';$('#q').value='';S.cur=n.isRoot?null:n.parent;requestRender()},del:()=>doDelete([n]),restore:()=>restore([rec]),purge:()=>purge([rec])};
 H[k]&&H[k]()}
/* ---------- selection ---------- */
function clearSel(){S.sel.clear();S.selMode=false;requestRender()}
function selToggle(id){S.selMode=true;S.sel.has(id)?S.sel.delete(id):S.sel.add(id);if(!S.sel.size)S.selMode=false;requestRender()}
const curItems=()=>S.listed||[];
/* ---------- navigation ---------- */
function go(sec){S.sec=sec;S.cur=null;S.q='';$('#q').value='';S.limit=120;S.sel.clear();S.selMode=false;document.body.classList.remove('menu');$('#filters').hidden=true;S.set.sec=sec;save();requestRender();scrollTo(0,0)}
function enter(id){S.sec==='folders'||(S.sec='folders');S.q='';$('#q').value='';S.cur=id;S.limit=120;S.sel.clear();S.selMode=false;requestRender();scrollTo(0,0)}
/* ---------- rendering ---------- */
const NAV=[['home','home'],['all','all'],['folders','folder'],['recent','clock'],['image','image'],['pdf','file'],['word','file'],['excel','file'],['ppt','file'],['zip','zip'],['media','video'],['text','text'],['fav','star'],['pinned','pin'],['big','size'],['trash','trash'],['settings','settings'],['about','info']];
const SORTK=Object.keys(SORTS);
const lookup=id=>S.sec==='trash'?S.trash.find(x=>x.id===id):getN(id);
function renderChrome(){const c=counts(),cl={...c,trash:S.trash.length,home:0,settings:0,about:0,pinned:c.pinned};
 $('#drawer').innerHTML=`<div class="dh"><img src="icons/logo.png" width="52" height="52" alt="AMR"><div><b>AMR FILE MANAGER</b><br><small>${t('user')}: Amr</small></div></div><div style="padding:8px 0">${NAV.map(([id,ic])=>`<button class="nv ${S.sec===id?'on':''}" data-go="${id}"><svg class="i"><use href="#i-${ic}"/></svg>${t('s_'+id)}${cl[id]?`<em>${cl[id]}</em>`:''}</button>`).join('')}</div>`;
 if(!S.dragTab)$('#tabs').innerHTML=S.set.tabs.filter(id=>!S.set.hidden.includes(id)).map(id=>{const d=TABS.find(x=>x[0]===id),ty=TYPES[id];return`<button class="tab ${S.sec===id?'on':''}" data-go="${id}" style="--c:${d[2]}"><span class="bub">${ty&&ty.l?`<b class="lt">${ty.l}</b>`:`<svg class="i"><use href="#i-${d[1]}"/></svg>`}<span class="n">${c[id]??0}</span></span><span class="l">${t('s_'+id)}</span></button>`}).join('');
 $('#trashN').textContent=S.trash.length;$('#trashN').hidden=!S.trash.length;$('#btnView use').setAttribute('href','#i-'+(S.set.view==='grid'?'list':'grid'));$('#userName').textContent='Amr'}
function storageHTML(){const s=S.storage;let b='';
 if(!s||!s.total)b=`<div class="empty" style="padding:10px">${t('storageNA')}</div>`;
 else{const used=s.total-s.free,pct=Math.min(100,Math.max(0,used/s.total*100)),col=pct<60?'#16a34a':pct<80?'#2563eb':pct<95?'#f97316':'#dc2626';
  b=`<div class="bar"><i style="width:${pct}%;background:${col}"></i></div><div class="stats"><div>${t('total')}<b>${fmtSize(s.total)}</b></div><div>${t('used')}<b>${fmtSize(used)}</b></div><div>${t('free')}<b>${fmtSize(s.free)}</b></div><div>${t('usage')}<b style="color:${col}">${pct.toFixed(pct<10?1:0)}%</b></div></div>`+
  (s.real?'':`<small style="display:block;margin-top:10px;color:var(--mu)">${t('webStorage')}</small>`)+(pct>=90?`<div class="alert"><svg class="i"><use href="#i-info"/></svg><span style="flex:1">${t('storageFull')}</span><button class="btn pr" data-go="big">${t('s_big')}</button></div>`:'')}
 return`<div class="card stor"><h3><span>${t('storage')}</span><button class="ib sm" data-act="stor"><svg class="i"><use href="#i-refresh"/></svg></button></h3>${b}</div>`}
function thumbOf(n,tr){const ty=TYPES[n.type]||TYPES.other;if(n.type==='image'&&!tr)return`<div class="th" style="--c:${ty.c}" data-img="${esc(n.id)}"><svg class="i"><use href="#i-image"/></svg></div>`;return`<div class="th" style="--c:${ty.c}">${ty.l?`<b class="lt">${ty.l}</b>`:`<svg class="i"><use href="#i-${ty.i}"/></svg>`}</div>`}
function item(n,tr){const sel=S.sel.has(n.id),isNew=!tr&&!n.dir&&Date.now()-n.fs<3*3600e3,p=tr?null:getN(n.parent);let m1,m2;
 if(n.dir){const k=tr?0:kidsOf(n.id).length,st=tr?null:stats().get(n.id);m1=`${t('folder')}${tr?'':' • '+k+' '+t('items')}${st?' • '+fmtSize(st.size):''}`;m2=n.path}
 else{m1=`${(n.ext||'—').toUpperCase()} • ${fmtSize(n.size)} • ${tr?rel(n.deleted):rel(n.fs)}`;m2=tr?`${t('origPath')}: ${n.path} • ${t('deletedOn')}: ${fmtDT(n.deleted)}`:(S.sec==='recent'||S.sec==='home'?`${t('parent')}: ${p?p.name:'—'} • ${fmtDT(n.fs)} • ${t('modified')}: ${fmtDT(n.mod)}`:(p?p.path:n.path))}
 return`<div class="it${sel?' sel':''}" data-id="${esc(n.id)}">${S.selMode?`<input type="checkbox" class="chk" ${sel?'checked':''}>`:''}${thumbOf(n,tr)}<div class="inf"><b>${esc(n.name)}${isNew?`<span class="new">NEW</span>`:''}${S.fav.has(n.id)?'<svg class="i mk"><use href="#i-star"/></svg>':''}${S.pin.has(n.id)?'<svg class="i mk" style="color:var(--pr)"><use href="#i-pin"/></svg>':''}</b><small>${esc(m1)}</small><small>${esc(m2)}</small></div><button class="ib more" data-more="1" aria-label="more"><svg class="i"><use href="#i-more"/></svg></button></div>`}
const seg=(k,o,cur)=>`<div class="seg">${o.map(([v,l])=>`<button data-set="${k}" data-v="${v}" class="${String(v)===String(cur)?'on':''}">${esc(l)}</button>`).join('')}</div>`;
const row=(l,c)=>`<div class="srow"><span>${l}</span>${c}</div>`;
function settingsHTML(){const s=S.set,vis=s.tabs;const favs=[...S.fav].map(getN).filter(Boolean);
 return`<div class="set"><div class="head"><h2>${t('s_settings')}</h2></div><div class="card"><h3>${t('appearance')}</h3>
 ${row(t('theme'),seg('theme',[['auto',t('auto')],['light',t('light')],['dark',t('dark')]],s.theme))}${row(t('language'),seg('lang',[['ar','العربية'],['en','English']],s.lang))}${row(t('iconSize'),seg('ic',[['s',t('small')],['m',t('medium')],['l',t('large')]],s.ic))}${row(t('viewMode'),seg('view',[['list',t('list')],['grid',t('grid')]],s.view))}${row(t('sortBy'),`<button class="btn" data-act="sort">${t('so_'+s.sort)}</button>`)}</div>
 <div class="card"><h3>${t('tabsOrder')}</h3><small style="display:block;margin:-2px 0 8px;color:var(--mu)">${t('tabsHint')}</small>${vis.map((id,i)=>`<div class="srow"><span>${t('s_'+id)}</span><button class="ib sm" data-tab="${id}" data-d="up" ${i?'':'disabled'}><svg class="i"><use href="#i-up"/></svg></button><button class="ib sm" data-tab="${id}" data-d="down" ${i<vis.length-1?'':'disabled'}><svg class="i"><use href="#i-down"/></svg></button><button class="ib sm" data-tab="${id}" data-d="vis"><svg class="i"><use href="#i-${s.hidden.includes(id)?'eyeoff':'eye'}"/></svg></button></div>`).join('')}</div>
 <div class="card"><h3>${t('favManage')} (${favs.length})</h3>${favs.map(n=>`<div class="srow"><span>${esc(n.name)}</span><button class="ib sm" data-unfav="${esc(n.id)}"><svg class="i"><use href="#i-close"/></svg></button></div>`).join('')||`<small>${t('noFav')}</small>`}${favs.length?`<button class="btn" data-act="clearfav" style="margin-top:8px">${t('clearAll')}</button>`:''}</div>
 <div class="card"><h3>${t('searchHistory')}</h3>${row(`${S.hist.length} / ${S.saved.length} ★`,`<button class="btn" data-act="clearhist">${t('clearHistory')}</button>`)}</div>
 <div class="card"><h3>${t('trashSettings')}</h3>${row(t('autoEmpty'),seg('trashDays',[[0,t('never')],[7,'7'+t('d')],[30,'30'+t('d')],[90,'90'+t('d')]],s.trashDays))}${row(t('confirmTrash'),seg('confirmTrash',[[1,t('yes')],[0,t('no')]],s.confirmTrash?1:0))}${row(`${S.trash.length} ${t('items')}`,`<button class="btn dg" data-act="empty">${t('emptyTrash')}</button>`)}</div>
 <div class="card"><h3>${t('access')}</h3>${row(t('mode'),`<b>${isNative?t('modeNative'):S.roots.some(r=>r.dev)?t('modeDevice'):t('modeWeb')}</b>`)}${!isNative&&!S.roots.some(r=>r.dev)?`<small style="display:block;line-height:1.7;color:var(--mu)">${t('wvNote')}${FS.devErr?'<br>'+esc(FS.devErr):''}</small>`:''}${S.roots.some(r=>r.dev)?`<small style="display:block;line-height:1.7;color:var(--mu)">${t('devNote')}</small>`:''}<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" data-act="import">${t('import')}</button><button class="btn" data-act="importdir">${t('importDir')}</button></div></div>
 <div class="card"><h3>${t('permissions')}</h3>${S.roots.map(r=>`<div class="srow"><span>${esc(r.priv?'AMR Storage':r.name)}<br><small>${r.ok?t('granted'):t('notGranted')}</small></span>${r.ok?'':`<button class="btn pr" data-grant="${esc(r.id)}">${t('grant')}</button>`}${r.priv||r.virtual||r.dev||r.local?'':`<button class="btn" data-rmroot="${esc(r.id)}">${t('remove')}</button>`}</div>`).join('')}<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">${needAccess()?`<button class="btn pr" data-act="allow">${t('allow')}</button>`:''}<button class="btn pr" data-act="addfolder"><svg class="i"><use href="#i-plus"/></svg>${t('addFolder')}</button><button class="btn" data-act="refresh"><svg class="i"><use href="#i-refresh"/></svg>${t('rescan')}</button>${isNative&&!S.roots.some(r=>r.virtual)?`<button class="btn" data-act="media">${t('enableMedia')}</button>`:''}</div><small style="display:block;margin-top:8px;color:var(--mu)">${isNative?t('permNative'):t('permWeb')}</small></div>
 <div class="card"><h3>${t('storageSet')}</h3><div id="stSet">${storageHTML().replace('class="card stor"','')}</div></div>
 <div class="card"><h3>${t('privacy')}</h3><p style="margin:0 0 10px;line-height:1.7">${t('privacyTxt')}</p><button class="btn dg" data-act="wipe">${t('wipe')}</button></div>
 <div class="card"><h3>${t('appInfo')}</h3>${row(t('version'),VERSION)}${row(t('platform'),isNative?'Android (Capacitor)':'Web / PWA')}${row(t('files'),String(counts().all))}</div></div>`}
function aboutHTML(){return`<div class="card" style="text-align:center"><img src="icons/logo.png" width="96" height="96" alt="AMR" style="border-radius:24px"><h2 style="margin:10px 0 2px">AMR FILE MANAGER</h2><small>v${VERSION} • ${t('user')}: Amr</small><p style="line-height:1.8;margin:14px 0">${t('aboutTxt')}</p></div>`}
function render(){const sig=JSON.stringify([S.sec,S.cur,S.flt]);if(sig!==S.sig){S.sig=sig;S.set.sec=S.sec;S.set.cur=S.cur;S.set.flt=S.flt;save()}
 renderChrome();const c=$('#content');$('#selbar').hidden=!S.selMode;
 if(S.sec==='settings'){c.innerHTML=settingsHTML();return selbar()}if(S.sec==='about'){c.innerHTML=aboutHTML();return selbar()}
 let h='',arr,tr=S.sec==='trash',sr=searching();
 for(const r of S.roots.filter(r=>!r.ok&&!r.virtual&&!r.dev))h+=`<div class="card alert"><svg class="i"><use href="#i-lock"/></svg><span style="flex:1">${esc(r.name)} — ${t('needGrant')}</span><button class="btn pr" data-grant="${esc(r.id)}">${t('grant')}</button></div>`;
 if(needAccess())h+=`<div class="card"><h3>${t('permTitle')}</h3><p style="margin:0 0 12px;line-height:1.7">${t('permMsg')}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pr" data-act="allow"><svg class="i"><use href="#i-lock"/></svg>${t('allow')}</button><button class="btn" data-act="addfolder"><svg class="i"><use href="#i-folder"/></svg>${t('pickOnly')}</button></div></div>`;
 if(S.sec==='home'&&!sr)h+=storageHTML();
 if(tr){const q=S.q.trim().toLowerCase();arr=S.trash.filter(x=>!q||x.name.toLowerCase().includes(q)).sort((a,b)=>b.deleted-a.deleted)}
 else if(sr)arr=sortList(search());else{arr=baseList();if(S.sec!=='recent'&&S.sec!=='home')sortList(arr)}
 S.listed=arr;const title=sr?t('results'):t('s_'+S.sec),cur=S.cur&&getN(S.cur);
 if(S.sec==='folders'&&!sr){const ch=[];let p=cur;while(p){ch.unshift(p);p=getN(p.parent)}h+=`<div class="crumbs"><a data-crumb="">${t('s_folders')}</a>${ch.map(x=>`<span>/</span><a data-crumb="${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>`}
 const acts=[];if(S.sec==='folders'&&!sr){if(S.cur)acts.push(`<button class="btn" data-act="mkdir"><svg class="i"><use href="#i-plus"/></svg>${t('newFolder')}</button>`);else acts.push(`<button class="btn pr" data-act="addfolder"><svg class="i"><use href="#i-plus"/></svg>${t('addFolder')}</button>`);if(S.clip&&S.cur)acts.push(`<button class="btn pr" data-act="paste"><svg class="i"><use href="#i-paste"/></svg>${t('paste')} (${S.clip.ids.length})</button>`)}
 if(tr&&S.trash.length)acts.push(`<button class="btn" data-act="restoreall"><svg class="i"><use href="#i-restore"/></svg>${t('restoreAll')}</button><button class="btn dg" data-act="empty"><svg class="i"><use href="#i-trash"/></svg>${t('emptyTrash')}</button>`);
 if(!tr)acts.push(`<button class="ib" data-act="refresh" aria-label="refresh"><svg class="i"><use href="#i-refresh"/></svg></button>`);
 h+=`<div class="head"><h2>${esc(title)} <small style="color:var(--mu)">(${arr.length})</small></h2>${acts.join('')}</div>`;
 if(!arr.length)h+=`<div class="empty"><svg class="i"><use href="#i-${tr?'trash':'folder'}"/></svg><div>${sr?t('noResults'):tr?t('trashEmpty'):S.roots.length&&(S.roots.length>1||!S.roots[0].priv)||S.sec==='folders'&&S.cur?t('noFiles'):t('noRoots')}</div>${!tr&&!sr?`<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn pr" data-act="addfolder"><svg class="i"><use href="#i-plus"/></svg>${t('addFolder')}</button><button class="btn" data-act="import"><svg class="i"><use href="#i-upload"/></svg>${t('import')}</button><button class="btn" data-act="importdir"><svg class="i"><use href="#i-folder"/></svg>${t('importDir')}</button></div>`:''}</div>`;
 else{const shown=arr.slice(0,S.limit),g=(S.sec==='recent'||S.sec==='home')&&!sr&&!tr;let last='';h+=`<div id="list" class="${S.set.view==='grid'?'grid':'list'}">`;
  for(const n of shown){if(g){const k=grp(n.fs);if(k!==last){last=k;h+=`<div class="group" style="grid-column:1/-1">${t('g_'+k)}</div>`}}h+=item(n,tr)}
  h+='</div>';if(arr.length>S.limit)h+='<div id="more" style="height:40px"></div>';
  if(S.sec==='home'&&!sr&&arr.length)h+=`<div style="text-align:center;margin:12px"><button class="btn" data-go="recent">${t('s_recent')} →</button></div>`}
 c.innerHTML=h;selbar();lazy()}
function selbar(){const b=$('#selbar');if(!S.selMode)return;const tr=S.sec==='trash',B=(a,ic,l,c='')=>`<button class="act ${c}" data-sb="${a}"><svg class="i"><use href="#i-${ic}"/></svg>${l}</button>`;
 b.innerHTML=`<span class="act" style="background:none">${S.sel.size}</span>`+B('all','check',t('selAll'))+B('none','close',t('selNone'))+(tr?B('restore','restore',t('restore'))+B('purge','trash',t('deleteForever'),'dg'):B('copy','copy',t('copy'))+B('cut','cut',t('cut'))+B('move','move',t('move'))+B('fav','star',t('fav'))+B('pin','pin',t('pin'))+B('del','trash',t('delete'),'dg'))}
let io,mo;function lazy(){io&&io.disconnect();io=new IntersectionObserver(es=>es.forEach(async e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const n=getN(e.target.dataset.img);if(!n||!['jpg','jpeg','png','webp','gif','svg','bmp','ico'].includes(n.ext))return;try{const im=new Image();im.loading='lazy';im.onload=()=>e.target.replaceChildren(im);im.src=await FS.url(n)}catch{}}),{rootMargin:'300px'});$$('[data-img]').forEach(x=>io.observe(x));
 mo&&mo.disconnect();const m=$('#more');if(m){mo=new IntersectionObserver(es=>{if(es[0].isIntersecting){S.limit+=120;requestRender()}},{rootMargin:'600px'});mo.observe(m)}}
/* ---------- actions ---------- */
async function addFolder(){try{const r=await FS.addRoot();if(!r)return;if(S.roots.some(x=>x.id===r.id))return toast(t('exists'),'err');S.roots.push(r);upsertRoot(r);await FS.watch&&FS.watch(S.roots,debRescan);toast(t('rootAdded'),'ok');reindex(r.id)}catch(e){const m=String(e&&(e.message||e));if(/nopicker/.test(m))toast(t('noPicker'),'err');else if(!/abort|cancel/i.test((e&&e.name||'')+m))toast(errMsg(e),'err')}}
const needAccess=()=>isNative&&!S.roots.some(r=>r.local);
async function attachAccess(){const rs=await FS.roots();for(const r of S.roots){for(const id of subIds(r.id))S.ix.map.delete(id);S.ix.map.delete(r.id);S.ix.kids.delete(r.id);DB.del('index',r.id)}S.roots=rs;rs.forEach(r=>{if(r.local)r.name=t('internal');upsertRoot(r)});S.gen++;S.cache={};try{await FS.watch(rs.filter(r=>r.ok),debRescan)}catch{}await reindexAll();toast(t('done'),'ok')}
async function grantAccess(){try{if(await FS.requestAll())await attachAccess();else toast(t('denied'),'err')}catch(e){toast(errMsg(e),'err')}}
async function recheck(){if(needAccess()&&await FS.hasAll())attachAccess()}
async function firstRun(){if(S.set.asked)return;if(!(isNative?needAccess():S.roots.every(r=>r.priv)))return;S.set.asked=true;save();
 if(await dlg({title:t('permTitle'),msg:isNative?t('permMsg'):t('permMsgWeb'),ok:isNative?t('allow'):t('import')}))isNative?grantAccess():$('#fileIn').click()}
async function refreshStorage(){clearTimeout(refreshStorage.t);refreshStorage.t=setTimeout(async()=>{try{S.storage=await FS.storage()}catch{S.storage=null}if(['home','settings'].includes(S.sec))requestRender()},400)}
function importTarget(){const c=S.sec==='folders'&&S.cur&&getN(S.cur);if(c&&!isRO(rootOf(c)))return c.id;const r=S.roots.find(r=>r.ok&&!isRO(r));return r&&r.id}
async function doImport(list){const d=importTarget();if(!d)return toast(t('noRoots'),'err');const n=getN(d);let ok=0;await run(async()=>{for(const f of list){try{await FS.write(d,uniq(d,f.name),f);ok++}catch(e){toast(`${f.name}: ${errMsg(e)}`,'err')}}await reindex(n.root,d)});if(ok)toast(`${t('imported')} (${ok})`,'ok')}

let hotBusy=false;
async function pollHot(){if(hotBusy||document.hidden||S.busy>0||!FS.list)return;hotBusy=true;try{const ids=new Set(S.roots.filter(r=>r.ok&&!r.virtual).map(r=>r.id));[...S.ix.map.values()].filter(n=>!n.dir).sort((a,b)=>b.fs-a.fs).slice(0,15).forEach(n=>ids.add(n.parent));let ch=false;
 for(const id of ids){const d=getN(id);if(!d)continue;const r=rootById(d.root);let items;try{items=await FS.list(r,id)}catch{continue}const seen=new Set();
  for(const i of items){seen.add(i.id);const o=getN(i.id);if(!o||o.size!==i.size||o.mod!==i.mod){upsert(mk(i,r,false));ch=true;if(i.dir&&!o)reindex(r.id,i.id)}}
  for(const k of kidsOf(id))if(!seen.has(k.id)){removeNode(k.id);ch=true}}
 if(ch)afterIndex()}finally{hotBusy=false}}
async function doImportDir(list){const d=importTarget();if(!d)return toast(t('noRoots'),'err');const n=getN(d),r=rootOf(n),made=new Map();let ok=0;
 await run(async()=>{for(const f of list){const p=(f.webkitRelativePath||f.name).split('/');p.pop();let pid=d,key='';for(const x of p){key+=x+'/';if(!made.has(key)){const ex=kidsOf(pid).find(k=>k.dir&&k.name===x);made.set(key,ex?ex.id:await FS.mkdir(r,pid,x))}pid=made.get(key)}
  try{await FS.write(pid,uniq(pid,f.name),f);ok++}catch(e){toast(`${f.name}: ${errMsg(e)}`,'err')}}await reindex(n.root,d)});if(ok)toast(`${t('imported')} (${ok})`,'ok')}
const debRescan=(()=>{let x;return()=>{clearTimeout(x);x=setTimeout(reindexAll,1500)}})();
async function sortMenu(){const k=await choose(t('sortBy'),SORTK.map(k=>[k,t('so_'+k)]),S.set.sort);if(k){S.set.sort=k;save();requestRender()}}
async function act(a,d){const cur=S.cur&&getN(S.cur);
 const H={refresh:async()=>{toast(t('refreshing'));await reindexAll();refreshStorage()},stor:refreshStorage,allow:grantAccess,addfolder:addFolder,importdir:()=>$('#dirIn').click(),media:async()=>{try{const r=await FS.enableMedia();if(!S.roots.some(x=>x.virtual)){S.roots.push(r);upsertRoot(r);reindex(r.id)}toast(t('done'),'ok')}catch(e){toast(errMsg(e),'err')}},import:()=>$('#fileIn').click(),sort:sortMenu,
  mkdir:async()=>{const nm=await dlg({title:t('newFolder'),input:true,val:t('newFolder')});if(nm)await newFolder(S.cur,nm)},paste:()=>paste(S.cur),restoreall:()=>restore([...S.trash]),empty:()=>purge([...S.trash]),big:()=>go('big'),
  clearfav:()=>{S.fav.clear();save();requestRender()},clearhist:()=>{S.hist=[];S.saved=[];save();requestRender();toast(t('done'),'ok')},
  wipe:async()=>{if(await dlg({title:t('wipe'),msg:t('wipeMsg'),ok:t('wipe'),danger:true})){for(const s of['kv','trash','handles','index'])await DB.clear(s);localStorage.clear();location.reload()}}};H[a]&&H[a]()}
function applyAll(){const s=S.set,h=document.documentElement;LANG=s.lang;h.lang=s.lang;h.dir=s.lang==='ar'?'rtl':'ltr';h.dataset.ic=s.ic;const dark=s.theme==='dark'||s.theme==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches;h.dataset.theme=dark?'dark':'light';
 $('meta[name=theme-color]').content=dark?'#151e32':'#4f46e5';$$('[data-t]').forEach(e=>e.textContent=t(e.dataset.t));$('#q').placeholder=t('searchPh');$('#btnSort').title=t('sort')}
function histHTML(){const q=S.q.trim().toLowerCase(),f=a=>a.filter(x=>!q||x.toLowerCase().includes(q)),sv=f(S.saved),hs=f(S.hist).filter(x=>!S.saved.includes(x));
 const r=(x,s)=>`<div class="row"><svg class="i" style="color:${s?'#eab308':'var(--mu)'}"><use href="#i-${s?'star':'history'}"/></svg><span data-hq="${esc(x)}">${esc(x)}</span><button class="ib sm" data-hs="${esc(x)}"><svg class="i"><use href="#i-star"/></svg></button><button class="ib sm" data-hd="${esc(x)}"><svg class="i"><use href="#i-close"/></svg></button></div>`;
 return sv.length||hs.length?(sv.length?`<h6>${t('savedSearches')}</h6>`+sv.map(x=>r(x,1)).join(''):'')+(hs.length?`<h6>${t('recentSearches')}</h6>`+hs.map(x=>r(x,0)).join(''):''):`<h6>${t('noHistory')}</h6>`}
function addHist(){const q=S.q.trim();if(q.length<2)return;S.hist=[q,...S.hist.filter(x=>x!==q)].slice(0,20);save()}
function filtersHTML(){const f=S.flt,o=(a,cur)=>a.map(([v,l])=>`<option value="${v}" ${v===cur?'selected':''}>${esc(l)}</option>`).join('');
 return`<label>${t('scope')}<select data-f="scope">${o([['all',t('allFiles')],['cur',t('curFolder')]],f.scope)}</select></label><label>${t('type')}<select data-f="type">${o([['',t('any')],['image',t('s_image')],['doc',t('documents')],['pdf','PDF'],['word','Word'],['excel','Excel'],['ppt','PowerPoint'],['zip',t('s_zip')],['video',t('s_video')],['audio',t('s_audio')],['text',t('s_text')]],f.type)}</select></label>
 <label>${t('date')}<select data-f="date">${o([['',t('any')],['today',t('today')],['week',t('thisWeek')],['month',t('thisMonth')],['year',t('thisYear')]],f.date)}</select></label><label>${t('size')}<select data-f="size">${o([['',t('any')],['s','< 1 MB'],['m','1 – 50 MB'],['l','> 50 MB']],f.size)}</select></label>`}
/* ---------- events ---------- */
document.addEventListener('click',async e=>{if(S.noClick){S.noClick=false;return}const T=e.target,go_=T.closest('[data-go]');
 if(go_){const id=go_.dataset.go;if(id==='media'||NAV.some(x=>x[0]===id)||TABIDS.includes(id))go(id);return}
 const a=T.closest('[data-act]');if(a)return act(a.dataset.act);
 const sb=T.closest('[data-sb]');if(sb){const ids=[...S.sel],ns=ids.map(lookup).filter(Boolean),k=sb.dataset.sb;
  const H={all:()=>{S.listed.forEach(n=>S.sel.add(n.id));requestRender()},none:clearSel,copy:()=>{S.clip={ids,cut:false};toast(t('copied2'),'ok');clearSel()},cut:()=>{S.clip={ids,cut:true};toast(t('cut2'),'ok');clearSel()},move:()=>moveCopy(ns,true),fav:()=>{ids.forEach(i=>S.fav.add(i));save();toast(t('favAdded'),'ok');clearSel()},pin:()=>{ids.forEach(i=>S.pin.add(i));save();clearSel()},del:()=>doDelete(ns),restore:()=>restore(ns),purge:()=>purge(ns)};return H[k]()}
 const gr=T.closest('[data-grant]');if(gr){const r=rootById(gr.dataset.grant);try{if(await FS.grant(r)){r.ok=true;reindex(r.id)}}catch(er){toast(errMsg(er),'err')}return}
 const rm=T.closest('[data-rmroot]');if(rm){const r=rootById(rm.dataset.rmroot);if(await dlg({title:t('remove'),msg:r.name,ok:t('remove'),danger:true})){await FS.removeRoot(r);for(const id of subIds(r.id))S.ix.map.delete(id);S.ix.map.delete(r.id);S.ix.kids.delete(r.id);S.roots=S.roots.filter(x=>x!==r);DB.del('index',r.id);S.gen++;afterIndex()}return}
 const uf=T.closest('[data-unfav]');if(uf){S.fav.delete(uf.dataset.unfav);save();return requestRender()}
 const tb=T.closest('[data-tab]');if(tb){const id=tb.dataset.tab,d=tb.dataset.d,a2=S.set.tabs,i=a2.indexOf(id);if(d==='up'&&i>0)[a2[i-1],a2[i]]=[a2[i],a2[i-1]];if(d==='down'&&i<a2.length-1)[a2[i+1],a2[i]]=[a2[i],a2[i+1]];if(d==='vis'){const h=S.set.hidden;h.includes(id)?h.splice(h.indexOf(id),1):(a2.length-h.length>1&&h.push(id))}save();return requestRender()}
 const st=T.closest('[data-set]');if(st){const k=st.dataset.set;let v=st.dataset.v;if(k==='trashDays')v=+v;if(k==='confirmTrash')v=v==='1';S.set[k]=v;save();applyAll();return requestRender()}
 const cr=T.closest('[data-crumb]');if(cr){S.cur=cr.dataset.crumb||null;S.limit=120;return requestRender()}
 const hq=T.closest('[data-hq]');if(hq){S.q=hq.dataset.hq;$('#q').value=S.q;$('#hist').hidden=true;return requestRender()}
 const hs=T.closest('[data-hs]');if(hs){const x=hs.dataset.hs;S.saved=S.saved.includes(x)?S.saved.filter(y=>y!==x):[x,...S.saved];save();$('#hist').innerHTML=histHTML();return}
 const hd=T.closest('[data-hd]');if(hd){const x=hd.dataset.hd;S.hist=S.hist.filter(y=>y!==x);S.saved=S.saved.filter(y=>y!==x);save();$('#hist').innerHTML=histHTML();return}
 if(T.closest('#hist'))return;if(!T.closest('.sbox'))$('#hist').hidden=true;
 const it=T.closest('#content .it');if(!it)return;if(S.skipClick){S.skipClick=false;return}const id=it.dataset.id,n=lookup(id);if(!n)return;
 if(T.closest('[data-more]'))return itemMenu(n);if(T.closest('.chk')||S.selMode)return selToggle(id);
 if(n.dir&&S.sec!=='trash')return enter(id);itemMenu(n)});
document.addEventListener('contextmenu',e=>{const it=e.target.closest('#content .it');if(!it)return;e.preventDefault();if(Date.now()-(S.lt||0)<900)return;const n=lookup(it.dataset.id);n&&itemMenu(n)});
let lp;document.addEventListener('touchstart',e=>{S.lt=Date.now();const it=e.target.closest('#content .it');if(!it)return;lp=setTimeout(()=>{S.skipClick=true;if(navigator.vibrate)navigator.vibrate(15);selToggle(it.dataset.id)},500)},{passive:true});
['touchend','touchmove','touchcancel'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(lp),{passive:true}));
document.addEventListener('change',e=>{const f=e.target.closest('[data-f]');if(f){S.flt[f.dataset.f]=f.value;S.limit=120;requestRender()}});
$('#q').addEventListener('input',e=>{S.q=e.target.value;S.limit=120;$('#hist').innerHTML=histHTML();requestRender()});
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){addHist();$('#hist').hidden=true;e.target.blur()}});
$('#q').addEventListener('focus',()=>{$('#hist').innerHTML=histHTML();$('#hist').hidden=false});
$('#q').addEventListener('blur',()=>{addHist();setTimeout(()=>$('#hist').hidden=true,200)});
$('#btnMenu').onclick=()=>innerWidth>=1024?document.body.classList.toggle('collapsed'):document.body.classList.toggle('menu');$('#scrim').onclick=()=>document.body.classList.remove('menu');
$('#btnSettings').onclick=()=>go('settings');$('#btnTrash').onclick=()=>go('trash');$('#btnSort').onclick=sortMenu;$('#btnImport').onclick=()=>$('#fileIn').click();
$('#btnView').onclick=()=>{S.set.view=S.set.view==='grid'?'list':'grid';save();requestRender()};
$('#btnFilters').onclick=()=>{const f=$('#filters');f.hidden=!f.hidden;f.innerHTML=filtersHTML()};
$('#dirIn').onchange=e=>{const l=[...e.target.files];e.target.value='';if(l.length)doImportDir(l)};
$('#fileIn').onchange=e=>{const l=[...e.target.files];e.target.value='';if(l.length)doImport(l)};
document.addEventListener('keydown',e=>{const ed=/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);if(e.key==='Escape'&&!LS.length&&S.selMode)clearSel();if(ed||LS.length)return;
 if(e.key==='/'){e.preventDefault();$('#q').focus()}else if(e.key==='Delete'&&S.sel.size&&S.sec!=='trash')doDelete([...S.sel].map(getN).filter(Boolean));else if((e.ctrlKey||e.metaKey)&&e.key==='a'){e.preventDefault();S.selMode=true;S.listed.forEach(n=>S.sel.add(n.id));requestRender()}
 else if((e.ctrlKey||e.metaKey)&&e.key==='c'&&S.sel.size){S.clip={ids:[...S.sel],cut:false};toast(t('copied2'),'ok')}else if((e.ctrlKey||e.metaKey)&&e.key==='x'&&S.sel.size){S.clip={ids:[...S.sel],cut:true};toast(t('cut2'),'ok')}else if((e.ctrlKey||e.metaKey)&&e.key==='v'&&S.clip&&S.cur)paste(S.cur)});

/* ---------- drag to reorder tabs (long-press then drag, like Telegram Plus) ---------- */
(()=>{const bar=$('#tabs');let el=null,timer,arm=null,sx=0,sy=0,pid=0,grab=0,lx=0,iv;
const all=()=>$$('.tab',bar),left=n=>{const f=n.style.transform;n.style.transform='none';const l=n.getBoundingClientRect().left;n.style.transform=f;return l};
const begin=t0=>{el=t0;S.dragTab=true;bar.classList.add('reordering');t0.classList.add('drag');if(navigator.vibrate)navigator.vibrate(20);grab=sx-left(t0);try{bar.setPointerCapture(pid)}catch{}
 iv=setInterval(()=>{const r=bar.getBoundingClientRect();if(lx<r.left+36)bar.scrollLeft-=10;else if(lx>r.right-36)bar.scrollLeft+=10;place()},30)};
const place=()=>{if(!el)return;for(const o of all()){if(o===el)continue;const r=o.getBoundingClientRect();if(lx>r.left&&lx<r.right){const a=all();bar.insertBefore(el,a.indexOf(o)>a.indexOf(el)?o.nextSibling:o);break}}el.style.transform=`translateX(${lx-grab-left(el)}px)`};
const end=()=>{clearTimeout(timer);clearInterval(iv);arm=null;if(!el)return;const ids=all().map(x=>x.dataset.go);el.classList.remove('drag');el.style.transform='';bar.classList.remove('reordering');
 const hid=S.set.hidden;let k=0;if(ids.length===S.set.tabs.filter(x=>!hid.includes(x)).length)S.set.tabs=S.set.tabs.map(id=>hid.includes(id)?id:ids[k++]);el=null;S.dragTab=false;S.noClick=true;setTimeout(()=>S.noClick=false,80);save();render()};
bar.addEventListener('pointerdown',e=>{const t0=e.target.closest('.tab');if(!t0||e.button>0)return;sx=lx=e.clientX;sy=e.clientY;pid=e.pointerId;clearTimeout(timer);if(e.pointerType==='mouse')arm=t0;else timer=setTimeout(()=>begin(t0),380)});
bar.addEventListener('pointermove',e=>{lx=e.clientX;if(!el){if(arm&&Math.abs(e.clientX-sx)>8){begin(arm);arm=null}else if(timer&&(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10))clearTimeout(timer);return}place()});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>bar.addEventListener(ev,end));
bar.addEventListener('touchmove',e=>{if(el)e.preventDefault()},{passive:false});bar.addEventListener('contextmenu',e=>e.preventDefault())})();
/* ---------- init ---------- */
async function init(){const t0=Date.now();
 try{const st=await DB.get('kv','state');if(st){Object.assign(S.set,st.set);S.fav=new Set(st.fav);S.pin=new Set(st.pin);S.hist=st.hist||[];S.saved=st.saved||[]}}catch{}
 S.set.tabs=[...S.set.tabs.filter(x=>TABIDS.includes(x)),...TABIDS.filter(x=>!S.set.tabs.includes(x))];S.set.flt={...DEF.flt,...S.set.flt};S.flt=S.set.flt;applyAll();matchMedia('(prefers-color-scheme:dark)').addEventListener('change',applyAll);
 try{S.trash=await DB.all('trash')}catch{}
 try{S.roots=await FS.roots()}catch(e){S.roots=[]}for(const r of S.roots){if(r.priv)r.name='AMR Storage';if(r.local)r.name=t('internal');upsertRoot(r);try{const c=await DB.get('index',r.id);if(c){S.cache[r.id]=1;for(const i of c)upsert(mk(i,r,false))}}catch{}}
 S.sec=S.set.sec||'home';S.cur=S.set.cur&&getN(S.set.cur)?S.set.cur:null;if(S.sec==='trash'||S.sec==='settings')S.sec='home';
 render();if(FS.initErr)toast('Native: '+FS.initErr,'err');firstRun();const sp=$('#splash');setTimeout(()=>{sp.classList.add('out');setTimeout(()=>sp.remove(),500)},Math.max(0,900-(Date.now()-t0)));
 refreshStorage();autoPurge();for(const r of S.roots.filter(r=>r.ok))reindex(r.id);try{FS.watch&&await FS.watch(S.roots.filter(r=>r.ok),debRescan)}catch{}
 setInterval(()=>{if(!document.hidden&&!S.busy)reindexAll()},45000);setInterval(pollHot,isNative||S.roots.some(r=>r.dev)?4000:10000);addEventListener('focus',()=>{recheck();pollHot();debRescan()});setInterval(()=>{if(['home','recent'].includes(S.sec)&&!S.selMode&&!LS.length)requestRender()},30000);setInterval(refreshStorage,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){recheck();debRescan();refreshStorage()}});
 if('serviceWorker' in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{})}
init();
