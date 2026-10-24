(function(root){
  function snapshot(id,photos,project,status='draft'){
    if(!photos.length)throw new Error('EMPTY_INSPECTION');
    const items=photos.flatMap(p=>p.findings||[]);
    return {id,project:JSON.parse(JSON.stringify(project)),photos:JSON.parse(JSON.stringify(photos)),status,
      updatedAt:new Date().toISOString(),photoCount:photos.length,
      confirmedCount:items.filter(f=>f.decision==='confirmed').length};
  }
  function open(name,store,key){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore(store,key?{keyPath:key}:undefined);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('请关闭其他筑检页面后重试'))})}
  async function operation(db,store,mode,fn){db=await db();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),req=fn(tx.objectStore(store));let result;req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存已中断'))})}finally{db.close()}}
  const archive=(mode,fn)=>operation(()=>open('zhujian-inspections','inspections','id'),'inspections',mode,fn);
  // 正在进行的检查单独存一份，照片较多时不受 localStorage 约 5MB 的限制
  const current=(mode,fn)=>operation(()=>open('zhujian-current','state'),'state',mode,fn);
  const api={snapshot,save:r=>archive('readwrite',s=>s.put(r)),list:async()=>{const rows=await archive('readonly',s=>s.getAll());return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))},get:id=>archive('readonly',s=>s.get(id)),
    saveCurrent:state=>current('readwrite',s=>s.put(state,'current')),loadCurrent:()=>current('readonly',s=>s.get('current'))};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InspectionHistory=api;
})(typeof window!=='undefined'?window:globalThis);
