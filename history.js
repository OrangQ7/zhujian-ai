(function(root){
  function snapshot(id,photos,project,status='draft'){
    if(!photos.length)throw new Error('EMPTY_INSPECTION');
    const items=photos.flatMap(p=>p.findings||[]);
    return {id,project:JSON.parse(JSON.stringify(project)),photos:JSON.parse(JSON.stringify(photos)),status,
      updatedAt:new Date().toISOString(),photoCount:photos.length,
      confirmedCount:items.filter(f=>f.decision==='confirmed').length};
  }
  function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open('zhujian-inspections',1);r.onupgradeneeded=()=>r.result.createObjectStore('inspections',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('请关闭其他筑检页面后重试'))})}
  async function operation(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('inspections',mode),req=fn(tx.objectStore('inspections'));let result;req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('历史保存已中断'))})}finally{db.close()}}
  const api={snapshot,save:r=>operation('readwrite',s=>s.put(r)),list:async()=>{const rows=await operation('readonly',s=>s.getAll());return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))},get:id=>operation('readonly',s=>s.get(id))};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InspectionHistory=api;
})(typeof window!=='undefined'?window:globalThis);
