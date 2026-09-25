const axios=require("axios");const cheerio=require("cheerio");const dns=require("dns").promises;const net=require("net");
const MAX_HTML=2*1024*1024,MAX_FILE=2*1024*1024,MAX_FILES=45,USER_AGENT="JOSVEXA-CODEX/1.0";
function cleanName(n,f="file"){return String(n||f).replace(/[<>:"/\\|?*\x00-\x1F]/g,"_").replace(/\s+/g,"_").slice(0,100)||f}
function privateIP(ip){if(!net.isIP(ip))return true;if(ip==="127.0.0.1"||ip==="::1")return true;if(/^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)||/^169\.254\./.test(ip)||/^0\./.test(ip)||/^(fc|fd)/i.test(ip)||/^fe80:/i.test(ip))return true;return false}
async function validateURL(input){let u;try{u=new URL(input)}catch{throw new Error("Invalid website URL.")}if(!["http:","https:"].includes(u.protocol))throw new Error("Only HTTP and HTTPS websites are supported.");if(u.username||u.password)throw new Error("URL credentials are not allowed.");const a=await dns.lookup(u.hostname,{all:true});if(!a.length||a.some(x=>privateIP(x.address)))throw new Error("This host cannot be accessed.");return u}
async function fetchURL(u,type="text",max=MAX_FILE){return axios.get(u.toString(),{responseType:type,timeout:12000,maxContentLength:max,maxBodyLength:max,headers:{"User-Agent":USER_AGENT,Accept:"*/*"},validateStatus:s=>s>=200&&s<400})}
function resolveURL(base,v){try{if(!v||v.startsWith("#")||/^(data|mailto|javascript):/i.test(v))return null;return new URL(v,base)}catch{return null}}
function fileName(u,f){const p=decodeURIComponent(u.pathname.split("/").pop()||"");return cleanName(p||f)}
module.exports=async function(req,res){res.setHeader("Access-Control-Allow-Origin","*");if(req.method==="OPTIONS")return res.status(204).end();if(req.method!=="POST")return res.status(405).json({error:"POST only"});
try{const input=String(req.body?.url||"").trim();if(!input)return res.status(400).json({error:"Enter a website URL."});const website=await validateURL(input);const page=await fetchURL(website,"text",MAX_HTML);const html=String(page.data);const $=cheerio.load(html);const files=[],used=new Set();
function addFile(name,content,type,source,binary=false){if(files.length>=MAX_FILES)return;let final=cleanName(name,"file"),original=final,count=2;while(used.has(final))final=original+"_"+count++;used.add(final);const buf=Buffer.isBuffer(content)?content:Buffer.from(String(content));files.push({name:final,type:type||"text/plain",size:buf.length,encoding:binary?"base64":"utf8",content:binary?buf.toString("base64"):buf.toString("utf8"),sourceUrl:source})}
addFile("index.html",html,"text/html",website.toString());
const cssFiles=[],jsFiles=[],assets=[];
$("link[rel='stylesheet'][href]").each((_,e)=>{const u=resolveURL(website,$(e).attr("href"));if(u)cssFiles.push(u)});
$("script[src]").each((_,e)=>{const u=resolveURL(website,$(e).attr("src"));if(u)jsFiles.push(u)});
$("img[src],source[src],video[src],audio[src]").each((_,e)=>{const u=resolveURL(website,$(e).attr("src"));if(u)assets.push(u)});
for(const u of cssFiles){if(files.length>=MAX_FILES)break;try{const r=await fetchURL(u,"text");addFile(fileName(u,"style.css"),r.data,r.headers["content-type"],u.toString())}catch{}}
for(const u of jsFiles){if(files.length>=MAX_FILES)break;try{const r=await fetchURL(u,"text");addFile(fileName(u,"script.js"),r.data,r.headers["content-type"],u.toString())}catch{}}
for(const u of assets){if(files.length>=MAX_FILES)break;try{const r=await fetchURL(u,"arraybuffer");addFile("assets_"+fileName(u,"asset"),Buffer.from(r.data),r.headers["content-type"],u.toString(),true)}catch{}}
res.status(200).json({title:$("title").text().trim()||website.hostname,website:website.toString(),files})}
catch(e){res.status(400).json({error:e.message||"Extraction failed."})}};
