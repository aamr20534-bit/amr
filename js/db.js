// IndexedDB wrapper: stores kv (settings/favs/...), trash, handles (web folder handles), index (cached file index)
const DB=(()=>{let p;
const open=()=>p||(p=new Promise((ok,no)=>{const r=indexedDB.open('amr',1);r.onupgradeneeded=()=>['kv','trash','handles','index'].forEach(s=>r.result.createObjectStore(s));r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
const tx=async(s,m,f)=>{const d=await open();return new Promise((ok,no)=>{const t=d.transaction(s,m);const q=f(t.objectStore(s));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})};
return{get:(s,k)=>tx(s,'readonly',o=>o.get(k)),set:(s,k,v)=>tx(s,'readwrite',o=>o.put(v,k)),del:(s,k)=>tx(s,'readwrite',o=>o.delete(k)),all:s=>tx(s,'readonly',o=>o.getAll()),clear:s=>tx(s,'readwrite',o=>o.clear())}})();
