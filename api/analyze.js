const { timingSafeEqual } = require('node:crypto');

const INSTRUCTIONS = `你是施工现场检查辅助工具。仅依据提供的照片和检查人补充内容记录可见事实。
不能从照片编造尺寸、检测值、隐蔽状况或具体规范条号；未拍到不等于现场缺失。
规范依据仅作建议，只有确定时填写编号和名称，条号不确定时留空，不得声称已核验。
疑似问题写明需核实条件，不自动判定重大事故隐患，不对整个工程作合格判断。
输出一个JSON对象，不要Markdown，结构：
{"findings":[{"title":"简短问题标题","description":"部位和可见事实","risk":"高|中|低","severity":"一般隐患|不符合项|一般缺陷","deadline":"整改时限建议","rectification":"可执行整改建议","basis":[{"code":"规范编号，未知留空","name":"规范名称","clause":"条号，未知留空","requirement":"要求概述"}],"bbox":null}],"questions":[{"q":"需要现场核实的问题","affects":[1]}]}
affects对应findings中从1开始的问题序号。最多输出10项；没有可见问题时findings为空数组。`;

function validCode(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string') return false;
  const a=Buffer.from(value), b=Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
const txt=(v,n=1600)=>typeof v==='string'?v.slice(0,n):'';
function normalize(raw) {
  if(!raw || !Array.isArray(raw.findings)) throw new Error('INVALID_OUTPUT');
  const findings=raw.findings.slice(0,10).map(f=>({
    title:txt(f.title,150),description:txt(f.description),
    risk:['高','中','低'].includes(f.risk)?f.risk:'中',
    severity:['一般隐患','不符合项','一般缺陷'].includes(f.severity)?f.severity:'不符合项',
    deadline:txt(f.deadline,80),rectification:txt(f.rectification),
    basis:(Array.isArray(f.basis)?f.basis:[]).slice(0,4).map(b=>({code:txt(b.code,100),name:txt(b.name,200),clause:txt(b.clause,100),requirement:txt(b.requirement),clause_verified:false})),
    bbox:null,verified:false,decision:'pending'
  })).filter(f=>f.title&&f.description);
  const questions=(Array.isArray(raw.questions)?raw.questions:[]).slice(0,10).map(q=>({q:txt(q.q,500),affects:(Array.isArray(q.affects)?q.affects:[]).filter(n=>Number.isInteger(n)&&n>0&&n<=findings.length)})).filter(q=>q.q);
  return {findings,questions};
}

async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const allowed=new Set(['https://orangq7.github.io',...(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)]);
  const origin=req.headers.origin;
  const sameOrigin=origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;
  if(origin&&!allowed.has(origin)&&!sameOrigin)return res.status(403).json({error:'此网站未获授权'});
  if(origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'只支持POST请求'});
  if(!process.env.ARK_API_KEY||!process.env.APP_ACCESS_CODE)return res.status(503).json({error:'后台尚未配置模型密钥或使用口令'});
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!validCode(token,process.env.APP_ACCESS_CODE))return res.status(401).json({error:'使用口令不正确'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'请求格式无效'})}}
  const image=body?.image;
  if(typeof image!=='string'||image.length>3_500_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return res.status(400).json({error:'请上传小于约2.5MB的图片'});
  try {
    const response=await fetch('https://ark.cn-beijing.volces.com/api/v3/responses',{
      method:'POST',signal:AbortSignal.timeout(110000),
      headers:{Authorization:`Bearer ${process.env.ARK_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.ARK_MODEL||'doubao-seed-2-1-pro-260915',max_output_tokens:5000,
        input:[{role:'system',content:[{type:'input_text',text:INSTRUCTIONS}]},{role:'user',content:[{type:'input_image',image_url:image},{type:'input_text',text:'检查部位：'+txt(body.part,300)+'。现场说明：'+txt(body.note,800)}]}]})
    });
    if(!response.ok) return res.status(502).json({error:response.status===401?'豆包密钥无效，请检查云端配置':response.status===429?'模型繁忙或额度受限，请稍后重试':'豆包调用失败，请检查模型开通状态',upstreamStatus:response.status});
    const data=await response.json();
    const text=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
    let parsed;try{parsed=JSON.parse(cleaned)}catch{return res.status(502).json({error:'模型未返回有效记录，请重试'})}
    return res.status(200).json({...normalize(parsed),usage:data.usage||null});
  } catch(e) {
    return res.status(502).json({error:e.name==='TimeoutError'?'识别超时，请稍后重试':'识别暂未完成，请稍后重试'});
  }
}
module.exports=handler;
module.exports.normalize=normalize;
