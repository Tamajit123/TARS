/** RFC-style wildcard group matching; consecutive user-agent lines share rules. */
export function robotsAllows(text:string,path:string){
  const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];
  let group={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]};
  for(const line of text.split(/\r?\n/)){
    const match=line.replace(/#.*/,'').trim().match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);if(!match)continue;
    const kind=match[1].toLowerCase(),value=match[2].trim();
    if(kind==='user-agent'){if(group.rules.length){groups.push(group);group={agents:[],rules:[]};}group.agents.push(value.toLowerCase());}
    else if(value&&group.agents.length)group.rules.push({allow:kind==='allow',path:value});
  }
  groups.push(group);
  const rules=groups.filter(group=>group.agents.includes('*')).flatMap(group=>group.rules).filter(rule=>{
    const anchored=rule.path.endsWith('$'),pattern=(anchored?rule.path.slice(0,-1):rule.path).split('*').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return new RegExp('^'+pattern+(anchored?'$':'')).test(path);
  }).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return !rules[0]||rules[0].allow;
}

const cache=new Map<string,{until:number;text:string}>();
/** Called only after public URL/DNS validation. Uses the existing server key. */
export async function checkPublicRobots(url:URL,signal?:AbortSignal){
  let saved=cache.get(url.origin);if(!saved||saved.until<Date.now()){
    const key=Deno.env.get('BROWSERBASE_API_KEY');if(!key)throw new Error('Browserbase is not configured.');
    const response=await fetch('https://api.browserbase.com/v1/fetch',{method:'POST',headers:{'x-bb-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({url:url.origin+'/robots.txt',allowRedirects:false,allowInsecureSsl:false,proxies:false,format:'raw'}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('The website robots policy could not be verified.');
    const page=await response.json();if(![200,404].includes(page.statusCode)||page.statusCode===200&&typeof page.content!=='string')throw new Error('The website robots policy could not be verified.');
    saved={until:Date.now()+3600000,text:page.statusCode===200?page.content.slice(0,64000):''};cache.set(url.origin,saved);
  }
  if(!robotsAllows(saved.text,url.pathname+url.search))throw new Error('This website disallows automated retrieval for this path. Choose another source.');
}
