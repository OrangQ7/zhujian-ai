const string={type:'string'};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=items=>({type:'array',items});
const schema=object({
  findings:array(object({kind:{type:'string',enum:['engineering','verification','image_quality']},title:string,description:string,evidence:string,risk:{type:'string',enum:['高','中','低']},severity:{type:'string',enum:['一般隐患','不符合项','一般缺陷']},deadline:string,rectification:string,basis:array(object({code:string,name:string,clause:string,requirement:string})),bbox:{anyOf:[array({type:'number'}),{type:'null'}]}})),
  questions:array(object({q:string,affects:array({type:'integer'})})),
  quality_notes:array(string)
});
function parseModelText(text){
  if(typeof text!=='string'||!text.trim())throw new Error('EMPTY_MODEL_TEXT');
  const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  try{return JSON.parse(cleaned)}catch{}
  const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
  if(first<0||last<=first)throw new Error('INVALID_MODEL_JSON');
  return JSON.parse(cleaned.slice(first,last+1));
}
module.exports={schema,parseModelText};
