const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),ctx={};vm.createContext(ctx);
for(const name of ['photoState','batchStatus'])vm.runInContext(html.split('\n').find(l=>l.startsWith('function '+name+'(')),ctx);
test('distinguishes unprocessed, successful empty, failed and busy photos',()=>{const p={findings:[]};assert.equal(ctx.photoState(p),'未识别');assert.equal(ctx.photoState({...p,analyzed:true}),'已识别，未检出问题');assert.equal(ctx.photoState({...p,error:'timeout'}),'识别失败');assert.equal(ctx.photoState({...p,busy:true}),'识别中')});
test('batch cannot say complete when another photo was not analyzed',()=>{const ps=[{findings:[{decision:'confirmed'}],analyzed:true},{findings:[]}];assert.equal(ctx.batchStatus(ps),'1 张未识别');ps[1].error='timeout';assert.equal(ctx.batchStatus(ps),'1 张识别失败')});
