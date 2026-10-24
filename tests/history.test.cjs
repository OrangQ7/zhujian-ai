const {test}=require('node:test'),assert=require('node:assert/strict');
const history=require('../history.js');
test('archive copies data and retains inspection identity',()=>{const photos=[{image:'data:image/jpeg;base64,YQ==',findings:[{title:'原记录',decision:'confirmed'}]}],project={name:'工程'};const r=history.snapshot('inspection-1',photos,project,'completed');photos[0].findings[0].title='修改';project.name='其他';assert.equal(r.photos[0].findings[0].title,'原记录');assert.equal(r.project.name,'工程');assert.equal(r.id,'inspection-1');assert.equal(r.photoCount,1);assert.equal(r.confirmedCount,1);assert.equal(r.status,'completed')});
test('empty inspection cannot become a history record',()=>{assert.throws(()=>history.snapshot('empty',[],{}),/EMPTY_INSPECTION/)});
