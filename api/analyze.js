const {schema,parseModelText}=require('../lib/contract.cjs');
const INSTRUCTIONS = `你是施工现场检查辅助工具。仅依据提供的照片和检查人补充内容记录可见事实。
不能从照片编造尺寸、检测值、隐蔽状况或具体规范条号；未拍到不等于现场缺失。
规范依据仅作建议，只有确定时填写编号和名称，条号不确定时留空，不得声称已核验。
检查人提供了工程类型时，按该类工程的作业特点判断；提供了适用规范时，依据优先从这些规范中选择，没有对应要求时才引用其他规范。
consequence写该问题可能导致的后果，只写由可见事实能合理推出的后果，不夸大。
work_type写从照片和检查人说明判断的工程类型及作业内容，如「铁路桥梁墩身支架施工」；suggested_standards列出对该作业最适用的现行规范，每项写「编号 名称」，最多5项，不确定的不列。
疑似问题写明需核实条件，不自动判定重大事故隐患，不对整个工程作合格判断。
先判断拍摄视角，俯拍、仰拍不等于倒置。没有可靠方向证据不得声称照片倒置或旋转。
照片模糊、翻拍、遮挡、曝光、方向无法确认只能进入quality_notes，不是工程缺陷，不得作为隐患编号或引用整改规范。照片质量差不影响记录照片中仍能看清的现场状态。
每项finding必须有kind和evidence。照片中直接看得到的不安全状态或质量问题，即使需要人工确认，也列为engineering，例如高处或临边散放未固定的物料、电缆拖地或浸水、配电箱门敞开或箱内有杂物、防护网破损、作业面堆放杂乱；所有engineering问题都由检查人员逐项确认或驳回，不是最终结论。只有需要推测、照片中看不到的事项才为verification，只供现场核实。看不到栏杆、漏保、接地线不能直接证明未设置。照片中没有可见问题时允许没有工程问题，不能为了输出而编造。
逐项检查照片可见的防护、作业面、架体、用电及实体质量。不同部位、不同缺陷或需要不同整改措施的问题分别列项；不要把安全网缺失与安全网破损合成一项，也不要把同一事实重复拆分。证据不足的内容放入questions，不为增加数量而推断缺陷。
每个可定位问题返回bbox=[左,上,右,下]，以整张图片左上角为原点，宽和高分别归一化为0到1000。框选问题实际所在区域，不能一律返回整张图；无法可靠定位则返回null。
输出一个合法JSON对象，不要Markdown；字符串内不要使用英文双引号，需要引用时用「」。结构：
{"findings":[{"kind":"engineering|verification|image_quality","title":"简短问题标题","description":"部位和可见事实","evidence":"照片中直接可见的依据","risk":"高|中|低","severity":"一般隐患|不符合项|一般缺陷","deadline":"整改时限建议","rectification":"可执行整改建议","consequence":"可能导致的后果","basis":[{"code":"规范编号，未知留空","name":"规范名称","clause":"条号，未知留空","requirement":"要求概述"}],"bbox":[100,100,400,600]}],"questions":[{"q":"需要现场核实的问题","affects":[1]}],"quality_notes":["照片质量说明，没有则为空数组"],"work_type":"工程类型及作业内容","suggested_standards":["JGJ 130 建筑施工扣件式钢管脚手架安全技术规范"]}
affects对应findings中从1开始的问题序号。最多输出10项；没有可见问题时findings为空数组。`;

const txt=(v,n=1600)=>typeof v==='string'?v.slice(0,n):'';
function box(value){
  if(!Array.isArray(value)||value.length!==4||!value.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000))return null;
  const b=value.map(Math.round);
  return b[2]>b[0]&&b[3]>b[1]?b:null;
}
function normalize(raw) {
  if(!raw || !Array.isArray(raw.findings)) throw new Error('INVALID_OUTPUT');
  const quality_notes=(Array.isArray(raw.quality_notes)?raw.quality_notes:[]).map(n=>txt(n,500)).filter(Boolean).slice(0,8);
  const verification=[];
  const source=raw.findings.map((f,i)=>({f,index:i+1})).filter(({f})=>f&&typeof f==='object');
  const mapping={};
  const engineering=source.filter(({f,index})=>{
    if(f.kind==='image_quality'||/^(照片|图像|画面).*(模糊|倒置|旋转|不清|清晰度|曝光|翻拍)/.test(f.title||'')){quality_notes.push(txt(f.description||f.title,500));return false}
    if(f.kind==='verification'){verification.push({q:txt(f.description||f.title,500),affects:[]});return false}
    return true;
  }).slice(0,10);
  const findings=engineering.map(({f,index})=>{mapping[index]=Object.keys(mapping).length+1;return ({
    title:txt(f.title,150),description:txt(f.description),evidence:txt(f.evidence,700),
    risk:['高','中','低'].includes(f.risk)?f.risk:'中',
    severity:['一般隐患','不符合项','一般缺陷'].includes(f.severity)?f.severity:'不符合项',
    deadline:txt(f.deadline,80),rectification:txt(f.rectification),consequence:txt(f.consequence,500),
    basis:(Array.isArray(f.basis)?f.basis:[]).slice(0,4).map(b=>({code:txt(b.code,100),name:txt(b.name,200),clause:txt(b.clause,100),requirement:txt(b.requirement),clause_verified:false})),
    bbox:box(f.bbox),verified:false,decision:'pending'
  })});
  if(findings.some(f=>!f.title||!f.description))throw new Error('INVALID_FINDING');
  const questions=verification.concat((Array.isArray(raw.questions)?raw.questions:[]).slice(0,10).map(q=>({q:txt(q.q,500),affects:(Array.isArray(q.affects)?q.affects:[]).map(n=>mapping[n]).filter(Boolean)}))).filter(q=>q.q).slice(0,12);
  const suggested_standards=[...new Set((Array.isArray(raw.suggested_standards)?raw.suggested_standards:[]).map(s=>txt(s,150).trim()).filter(Boolean))].slice(0,5);
  return {findings,questions,quality_notes:[...new Set(quality_notes)].slice(0,8),work_type:txt(raw.work_type,100),suggested_standards};
}

async function handler(req,res) {
  const requestId=require('node:crypto').randomUUID();
  const started=Date.now();
  const log=(event,info={})=>console.info(JSON.stringify({requestId,event,elapsedMs:Date.now()-started,...info}));
  res.setHeader('X-Inspection-Request-Id',requestId);
  res.setHeader('Cache-Control','no-store');
  const allowed=new Set(['https://orangq7.github.io','https://zhujianai.site','https://www.zhujianai.site',...(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)]);
  const origin=req.headers.origin;
  const sameOrigin=origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;
  if(origin&&!allowed.has(origin)&&!sameOrigin)return res.status(403).json({error:'此网站未获授权'});
  if(origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'只支持POST请求'});
  if(!process.env.ARK_API_KEY)return res.status(503).json({error:'后台尚未配置模型密钥'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'请求格式无效'})}}
  const image=body?.image;
  if(typeof image!=='string'||image.length>3_500_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return res.status(400).json({error:'请上传小于约2.5MB的图片'});
  const model=process.env.ARK_MODEL||'doubao-seed-2-1-pro-260915';
  // stream=true 时按行返回 NDJSON：先 started，模型写作中推送 stage/finding，最后一行是 result 或 error。
  // 进度只取自模型真实写出的内容；最终结果与一次性返回完全相同
  const stream=body.stream===true;
  const emit=event=>{if(stream)res.write(JSON.stringify(event)+'\n')};
  const send=(status,payload)=>{if(!stream)return res.status(status).json(payload);emit({type:status===200?'result':'error',...payload});return res.end()};
  if(stream){res.status(200);res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('X-Accel-Buffering','no');emit({type:'started'})}
  log('model_request_started',{model,stream});
  try {
    const response=await fetch('https://ark.cn-beijing.volces.com/api/v3/responses',{
      method:'POST',signal:AbortSignal.timeout(150000),
      headers:{Authorization:`Bearer ${process.env.ARK_API_KEY.trim()}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,stream,max_output_tokens:7000,thinking:{type:'disabled'},text:{format:{type:'json_schema',name:'inspection_result',strict:true,schema}},
        input:[{role:'system',content:[{type:'input_text',text:INSTRUCTIONS}]},{role:'user',content:[{type:'input_image',image_url:image},{type:'input_text',text:'工程类型：'+(txt(body.type,100)||'未填写')+'。适用规范：'+(txt(body.standards,800)||'未填写')+'。检查部位：'+txt(body.part,300)+'。现场说明：'+txt(body.note,800)}]}]})
    });
    if(!response.ok) {
      let detail={};try{detail=await response.json()}catch{}
      const upstreamCode=String(detail.error?.code||'').slice(0,100);
      log('model_request_failed',{upstreamStatus:response.status,upstreamCode});
      return send(502,{error:response.status===401?'豆包鉴权失败，请检查云端密钥':response.status===429?'模型繁忙或额度受限，请稍后重试':'豆包调用失败，请检查模型开通状态',upstreamStatus:response.status,upstreamCode,requestId});
    }
    let data,text;
    if(stream){const progress=watchProgress(emit);({data,text}=await readModelStream(response,progress))}
    else {data=await response.json();text=outputText(data)}
    log('model_response_received',{status:data.status,usage:data.usage||null,responseId:data.id});
    if(data.status==='incomplete')return send(502,{error:'模型输出被截断，未生成完整记录，请重试',code:'MODEL_INCOMPLETE',requestId,usage:data.usage||null});
    if(data.status==='failed'||data.error)return send(502,{error:'模型未完成分析，请稍后重试',code:'MODEL_FAILED',requestId});
    let parsed;try{parsed=parseModelText(text)}catch{log('invalid_model_json',{textLength:text.length,outputTypes:(data.output||[]).map(x=>x.type),textHead:text.slice(0,300),textTail:text.slice(-300)});return send(502,{error:'模型返回的记录无法解析，请稍后重试',code:text.length?'INVALID_MODEL_JSON':'EMPTY_MODEL_TEXT',requestId,usage:data.usage||null,diagnostic:{outputCount:(data.output||[]).length,text:text.slice(0,12000)}})}
    const result=normalize(parsed);log('analysis_completed',{model,stream,findingCount:result.findings.length,boxedCount:result.findings.filter(f=>f.bbox).length,outputTokens:data.usage?.output_tokens});
    return send(200,{...result,usage:data.usage||null,model:data.model||model,requestId,elapsedMs:Date.now()-started});
  } catch(e) {
    log('analysis_failed',{errorType:e.name,message:String(e.message).slice(0,200),cause:String(e.cause?.code||e.cause?.message||'').slice(0,200)});
    return send(502,{error:e.name==='TimeoutError'?'等待豆包响应超时，本次未取得识别结果。请稍后重试':'识别暂未完成，请稍后重试',requestId});
  }
}
const outputText=data=>(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('');
// 读取豆包的 SSE 流：累积文字增量，拿到 completed/incomplete/failed 事件里的完整响应
async function readModelStream(response,onDelta){
  let buf='',text='',final=null;const dec=new TextDecoder();
  for await(const chunk of response.body){
    buf+=dec.decode(chunk,{stream:true});let i;
    while((i=buf.indexOf('\n'))>=0){
      const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
      if(!line.startsWith('data:'))continue;
      let ev;try{ev=JSON.parse(line.slice(5))}catch{continue}
      if(ev.type==='response.output_text.delta'&&typeof ev.delta==='string'){text+=ev.delta;onDelta(text)}
      else if(/^response\.(completed|incomplete|failed)$/.test(ev.type))final=ev.response||{};
      else if(ev.type==='error')final={status:'failed',error:ev};
    }
  }
  final=final||{status:'failed',error:'STREAM_ENDED'};
  return {data:final,text:outputText(final)||text};
}
// 从模型已写出的 JSON 片段里取真实进度：开始写、每个问题标题、写到核实问题和推荐规范
function watchProgress(emit){
  const seen=new Set();let count=0;
  return text=>{
    if(!seen.has('writing')){seen.add('writing');emit({type:'stage',stage:'writing'})}
    const items=[...text.matchAll(/"kind"\s*:\s*"(\w+)"[^{}]*?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
    for(;count<items.length;count++){const [,kind,raw]=items[count];if(kind==='image_quality')continue;let title=raw;try{title=JSON.parse('"'+raw+'"')}catch{}emit({type:'finding',kind,title:title.slice(0,150)})}
    for(const [key,stage] of [['"questions"','questions'],['"suggested_standards"','standards']])if(!seen.has(stage)&&text.includes(key)){seen.add(stage);emit({type:'stage',stage})}
  };
}
module.exports=handler;
module.exports.normalize=normalize;
