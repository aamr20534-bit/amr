// Internal previewer. Only real supported formats are previewed; everything else offers "open with external app".
const Preview={
 can:n=>['image','video','audio','text','pdf','zip'].includes(n.type)&&!(n.type==='image'&&['heic','tiff','ico'].includes(n.ext)&&false)||['docx','xlsx','pptx'].includes(n.ext),
 async open(n){
  const ov=document.createElement('div');ov.className='pv';let z=1;
  ov.innerHTML=`<header><button class="ib" data-a="x"><svg class="i"><use href="#i-back"/></svg></button><b>${esc(n.name)}</b>${n.type==='image'?'<button class="ib" data-a="zo"><svg class="i"><use href="#i-zoomout"/></svg></button><button class="ib" data-a="zi"><svg class="i"><use href="#i-zoomin"/></svg></button>':''}<button class="ib" data-a="inf"><svg class="i"><use href="#i-info"/></svg></button><button class="ib" data-a="ext"><svg class="i"><use href="#i-open"/></svg></button></header><div class="body"><div class="empty">…</div></div>`;
  const body=ov.querySelector('.body'),close=()=>{popLayer(ov);body.querySelectorAll('video,audio').forEach(m=>m.pause())};
  ov.onclick=e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(!a)return;if(a==='x')close();else if(a==='inf')showInfo(n);else if(a==='ext')openExternal(n);else if(a==='zi'||a==='zo'){z=Math.min(8,Math.max(.25,z*(a==='zi'?1.25:.8)));const im=body.querySelector('img');if(im)im.style.width=z*100+'%'}};
  ov.addEventListener('wheel',e=>{if(e.ctrlKey&&n.type==='image'){e.preventDefault();ov.querySelector(`[data-a=${e.deltaY<0?'zi':'zo'}]`).click()}},{passive:false});
  ov.tabIndex=0;ov.onkeydown=e=>e.key==='Escape'&&close();pushPv(ov);ov.focus();
  try{
   if(n.type==='image'){body.className='body img';const im=new Image();im.style.width='100%';im.onerror=()=>this.fail(body,n);im.src=await FS.url(n);body.replaceChildren(im)}
   else if(n.type==='video'||n.type==='audio'){const m=document.createElement(n.type);m.controls=true;m.autoplay=false;m.onerror=()=>this.fail(body,n);m.src=await FS.url(n);body.replaceChildren(m)}
   else if(n.type==='text'){const b=await FS.getBlob(n),s=await b.slice(0,2097152).text(),p=document.createElement('pre');p.textContent=s;body.replaceChildren(p);if(b.size>2097152)toast(t('truncated'))}
   else if(n.type==='pdf'){if(FS.pdfInfo){const pg=await FS.pdfInfo(n);body.className='body pages';body.style.display='block';body.innerHTML='';const w=Math.min(1600,Math.round(innerWidth*(devicePixelRatio||1)));const io=new IntersectionObserver(es=>es.forEach(async e=>{if(!e.isIntersecting)return;io.unobserve(e.target);try{e.target.src=await FS.pdfPage(n,+e.target.dataset.p,w)}catch{}}),{root:body,rootMargin:'600px'});
     for(let i=0;i<pg;i++){const im=new Image();im.dataset.p=i;im.alt='';body.appendChild(im);io.observe(im)}}
    else{const f=document.createElement('iframe'),b=await FS.getBlob(n);f.src=URL.createObjectURL(new Blob([b],{type:'application/pdf'}));body.style.padding=0;body.replaceChildren(f)}}
   else if(n.ext==='zip'||n.type==='zip'){if(!['zip','jar','apk'].includes(n.ext))return this.fail(body,n);const zp=await Zip.open(await FS.getBlob(n));body.style.alignItems='stretch';
    body.innerHTML=`<div class="head"><h2>${zp.ents.length} ${t('items')}</h2><button class="btn pr" data-x="all"><svg class="i"><use href="#i-download"/></svg>${t('extractAll')}</button></div>`+zp.ents.map((e,i)=>`<div class="it" style="margin-bottom:6px;cursor:default"><div class="th" style="--c:#f97316"><svg class="i"><use href="#i-${e.dir?'folder':'file'}"/></svg></div><div class="inf"><b>${esc(e.name)}</b><small>${e.dir?'':fmtSize(e.us)}</small></div>${e.dir?'':`<button class="btn" data-x="${i}">${t('extract')}</button>`}</div>`).join('');
    body.onclick=async e=>{const x=e.target.closest('[data-x]')?.dataset.x;if(x==null)return;try{await extractEntries(n,zp,x==='all'?zp.ents.filter(q=>!q.dir):[zp.ents[+x]],x==='all')}catch(er){toast(er.message,'err')}}}
   else if(n.ext==='docx'){const d=document.createElement('div');d.className='doc';d.innerHTML=await Office.docx(await Zip.open(await FS.getBlob(n)));body.replaceChildren(d)}
   else if(n.ext==='xlsx'){const sh=await Office.xlsx(await Zip.open(await FS.getBlob(n)));body.style.alignItems='stretch';const draw=i=>{const s=sh[i];return `<div class="tw"><table class="tbl">${s.rows.map(r=>'<tr>'+Array.from({length:s.cols},(_,c)=>`<td>${X.esc(r[c]??'')}</td>`).join('')+'</tr>').join('')}</table></div>`};
    body.innerHTML=`<div class="seg" style="margin-bottom:10px;flex-wrap:wrap">${sh.map((s,i)=>`<button data-s="${i}" class="${i?'':'on'}">${X.esc(s.name)}</button>`).join('')}</div><div id="sheetv">${sh.length?draw(0):''}</div>`;
    body.onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;body.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('on',x===b));$('#sheetv').innerHTML=draw(+b.dataset.s)}}
   else if(n.ext==='pptx'){const sl=await Office.pptx(await Zip.open(await FS.getBlob(n)));body.innerHTML=sl.map((s,i)=>`<div class="slide"><h4>${t('slide')} ${i+1}</h4>${s.map((l,j)=>j?`<p>${X.esc(l)}</p>`:`<b>${X.esc(l)}</b>`).join('')}</div>`).join('')||'<div class="empty">—</div>'}
   else this.fail(body,n)
  }catch(e){this.fail(body,n,e)}},
 fail(body,n,e){body.className='body';body.innerHTML=`<div class="empty"><svg class="i"><use href="#i-file"/></svg><div>${t('noPreview')}</div>${e?`<small>${esc(e.message||e)}</small>`:''}<button class="btn pr" id="pvx">${t('openExt')}</button></div>`;$('#pvx').onclick=()=>openExternal(n)}};
