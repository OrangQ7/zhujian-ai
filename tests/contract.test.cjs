const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseModelText,schema}=require('../lib/contract.cjs');
const {normalize}=require('../api/analyze.js');
test('accepts JSON and fenced JSON without inventing missing content',()=>{for(const s of ['{"findings":[]}','```json\n{"findings":[]}\n```','说明\n{"findings":[]}\n结束'])assert.deepEqual(parseModelText(s),{findings:[]});assert.throws(()=>parseModelText(''));assert.throws(()=>parseModelText('{"findings":['))});
test('repairs common model JSON mistakes but still rejects truncated output',()=>{
  const ok=parseModelText('{"findings":[{"title":"配电箱门未关闭","description":"箱内有"螺丝刀"等杂物"}],"questions":[],"quality_notes":["照片为翻拍",]}');
  assert.equal(ok.findings[0].title,'配电箱门未关闭');assert.deepEqual(ok.quality_notes,['照片为翻拍']);
  assert.throws(()=>parseModelText('{"findings":[{"title":"a","description":"b"}],"questions":[{"q":"c"}'),/INVALID_MODEL_JSON/);
});
test('photo quality and verification are not counted as engineering defects',()=>{const data=normalize({findings:[{kind:'image_quality',title:'照片模糊',description:'补拍'},{kind:'verification',title:'接地无法确认',description:'核查接地'},{kind:'engineering',title:'箱内杂物',description:'可见工具',evidence:'箱体底部有工具'}],questions:[{q:'确认工具是否临时放置',affects:[3]}]});assert.equal(data.findings.length,1);assert.equal(data.findings[0].title,'箱内杂物');assert.deepEqual(data.quality_notes,['补拍']);assert.equal(data.questions.length,2);assert.deepEqual(data.questions[1].affects,[1])});
test('schema disallows extra root fields and requires all result categories',()=>{assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.required,['findings','questions','quality_notes'])});
