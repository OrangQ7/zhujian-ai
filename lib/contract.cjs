const {jsonrepair}=require('jsonrepair');
const string={type:'string'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=items=>({type:'array',items});
const schema=object({
  findings:array(object({kind:{type:'string',enum:['engineering','verification','image_quality']},title:string,description:string,evidence:string,risk:{type:'string',enum:['高','中','低']},severity:{type:'string',enum:['一般隐患','不符合项','一般缺陷']},deadline:string,rectification:string,consequence:string,basis:array(object({code:string,name:string,clause:string,requirement:string})),bbox:{anyOf:[array({type:'number'}),{type:'null'}]}})),
  questions:array(object({q:string,affects:array({type:'integer'})})),
  quality_notes:array(string),
  work_type:string,
  suggested_standards:array(string)
});
function parseModelText(text){
  if(typeof text!=='string'||!text.trim())throw new Error('EMPTY_MODEL_TEXT');
  const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  try{return JSON.parse(cleaned)}catch{}
  const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
  if(first<0||last<=first)throw new Error('INVALID_MODEL_JSON');
  const body=cleaned.slice(first,last+1);
  try{return JSON.parse(body)}catch{}
  // 模型常在中文字符串里夹未转义的引号、漏逗号；修复后必须三类结果齐全，截断的输出仍按失败处理
  let repaired;
  try{repaired=JSON.parse(jsonrepair(body))}catch{throw new Error('INVALID_MODEL_JSON')}
  if(!repaired||typeof repaired!=='object'||!['findings','questions','quality_notes'].every(k=>Array.isArray(repaired[k])))throw new Error('INVALID_MODEL_JSON');
  return repaired;
}
module.exports={schema,parseModelText};
