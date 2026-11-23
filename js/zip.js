// Dependency-free ZIP reader (stored + deflate), Office (docx/xlsx/pptx) text parsers, JPEG EXIF reader.
const Zip={
 async open(blob){const buf=await blob.arrayBuffer(),v=new DataView(buf),u=new Uint8Array(buf);let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('not zip');const n=v.getUint16(e+10,true);let p=v.getUint32(e+16,true);const td=new TextDecoder(),ents=[];
  for(let k=0;k<n;k++){if(v.getUint32(p,true)!==0x02014b50)break;const fl=v.getUint16(p+8,true),m=v.getUint16(p+10,true),cs=v.getUint32(p+20,true),us=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
   const name=td.decode(u.subarray(p+46,p+46+nl));ents.push({name,dir:name.endsWith('/'),m,cs,us,off,enc:!!(fl&1)});p+=46+nl+el+cl}
  const z={ents,async read(en){if(en.enc)throw new Error('encrypted');const o=en.off,ds=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true),raw=u.subarray(ds,ds+en.cs);
    if(en.m===0)return new Blob([raw]);if(en.m!==8)throw new Error('method');return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()},
   async text(name){const en=ents.find(x=>x.name===name);return en?(await z.read(en)).text():null}};return z}};
const X={parse:s=>new DOMParser().parseFromString(s,'application/xml'),
 esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))};
const Office={
 async docx(z){const d=X.parse(await z.text('word/document.xml')),W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const para=p=>{let s='';for(const n of p.getElementsByTagNameNS(W,'*'))if(n.localName==='t')s+=X.esc(n.textContent);else if(n.localName==='tab')s+='&emsp;';else if(n.localName==='br')s+='<br>';
   const st=p.getElementsByTagNameNS(W,'pStyle')[0],sv=st?st.getAttributeNS(W,'val')||'':'',b=p.getElementsByTagNameNS(W,'b').length&&!/^\s*$/.test(s);
   return /^(Heading|Title)/i.test(sv)?`<h3>${s}</h3>`:`<p>${b&&s.length<80?'<b>'+s+'</b>':s||'&nbsp;'}</p>`};
  const walk=n=>{let o='';for(const c of n.children){if(c.localName==='p')o+=para(c);else if(c.localName==='tbl')o+='<table>'+[...c.children].filter(r=>r.localName==='tr').map(r=>'<tr>'+[...r.children].filter(x=>x.localName==='tc').map(x=>'<td>'+walk(x)+'</td>').join('')+'</tr>').join('')+'</table>';else if(c.localName==='sdt'||c.localName==='sdtContent')o+=walk(c)}return o};
  return walk(d.getElementsByTagNameNS(W,'body')[0])},
 async xlsx(z){const S=[],ss=await z.text('xl/sharedStrings.xml');if(ss)for(const si of X.parse(ss).getElementsByTagName('si'))S.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));
  const wb=X.parse(await z.text('xl/workbook.xml')),rel=X.parse(await z.text('xl/_rels/workbook.xml.rels')),out=[];
  for(const sh of wb.getElementsByTagName('sheet')){const rid=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),rl=[...rel.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);if(!rl)continue;
   let t=rl.getAttribute('Target').replace(/^\//,'');t=t.startsWith('xl/')?t:'xl/'+t;const xml=await z.text(t);if(!xml)continue;const rows=[];let mc=0;
   for(const r of [...X.parse(xml).getElementsByTagName('row')].slice(0,500)){const row=[];for(const c of r.getElementsByTagName('c')){const ref=c.getAttribute('r')||'',col=ref.replace(/\d/g,'').split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1,ty=c.getAttribute('t'),vn=c.getElementsByTagName('v')[0];
     let val=ty==='s'&&vn?S[+vn.textContent]:ty==='inlineStr'?c.textContent:vn?vn.textContent:'';row[col<0?row.length:col]=val;mc=Math.max(mc,row.length)}rows.push(row)}
   out.push({name:sh.getAttribute('name'),rows,cols:Math.min(mc,60)})}return out},
 async pptx(z){const sl=z.ents.filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a,b)=>parseInt(a.name.match(/\d+/g).pop())-parseInt(b.name.match(/\d+/g).pop())),out=[];
  for(const e of sl){const d=X.parse(await(await z.read(e)).text());out.push([...d.getElementsByTagName('a:p')].map(p=>[...p.getElementsByTagName('a:t')].map(t=>t.textContent).join('')).filter(Boolean))}return out}};
// JPEG EXIF (Make, Model, DateTimeOriginal, ExposureTime, FNumber, ISO, FocalLength)
async function readExif(blob){try{const v=new DataView(await blob.slice(0,131072).arrayBuffer());if(v.getUint16(0)!==0xFFD8)return null;let p=2;
 while(p<v.byteLength){const m=v.getUint16(p);if(m===0xFFE1&&v.getUint32(p+4)===0x45786966){const t=p+10,le=v.getUint16(t)===0x4949,g16=o=>v.getUint16(t+o,le),g32=o=>v.getUint32(t+o,le),str=(o,n)=>{let s='';for(let i=0;i<n-1;i++)s+=String.fromCharCode(v.getUint8(t+o+i));return s.trim()},r={};
   const ifd=(o,map)=>{const c=g16(o);for(let i=0;i<c;i++){const e=o+2+i*12,tag=g16(e),ty=g16(e+2),n=g32(e+4),vo=ty===2&&n<=4?e+8:g32(e+8),k=map[tag];
    if(tag===0x8769)r._x=g32(e+8);if(!k)continue;if(ty===2)r[k]=str(vo,n);else if(ty===5){const a=g32(vo),b=g32(vo+4);r[k]=b?a/b:0}else if(ty===3)r[k]=g16(e+8)}};
   const M={0x10F:'make',0x110:'model'},E={0x829A:'exposure',0x829D:'fnumber',0x8827:'iso',0x9003:'taken',0x920A:'focal'};ifd(g32(4),M);if(r._x)ifd(r._x,E);delete r._x;return r}
  if((m&0xFF00)!==0xFF00)break;p+=2+v.getUint16(p+2)}return null}catch{return null}}
