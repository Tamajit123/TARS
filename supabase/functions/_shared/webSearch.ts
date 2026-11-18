// API search does not allocate a cloud browser. Provider choice is explicit;
// failure never silently switches vendors or fabricates a successful result.
export class SearchError extends Error{}
export function searchProvider(){return Deno.env.get('WEB_SEARCH_PROVIDER')||(Deno.env.get('SEARXNG_BASE_URL')?'searxng':Deno.env.get('BRAVE_SEARCH_API_KEY')?'brave':'browserbase');}
export async function searchAPI(query:string){
  if(typeof query!=='string'||!query.trim()||query.length>300)throw new SearchError('Use a search query of up to 300 characters.');
  const provider=searchProvider();let url:URL;const headers:Record<string,string>={Accept:'application/json'};
  if(provider==='brave'){
    const key=Deno.env.get('BRAVE_SEARCH_API_KEY');if(!key)throw new SearchError('Configure BRAVE_SEARCH_API_KEY on the server.');
    url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('count','10');headers['X-Subscription-Token']=key;
  }else if(provider==='searxng'){
    const base=Deno.env.get('SEARXNG_BASE_URL');if(!base)throw new SearchError('Configure SEARXNG_BASE_URL with your hosted instance and enable JSON search.');
    url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new SearchError('SEARXNG_BASE_URL must be a trusted HTTPS server origin.');
    url.pathname=url.pathname.replace(/\/$/,'')+'/search';url.searchParams.set('format','json');url.searchParams.set('categories','general');
  }else throw new SearchError('Choose searxng, brave or browserbase for WEB_SEARCH_PROVIDER.');
  url.searchParams.set('q',query.trim());
  let response:Response;try{response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new SearchError('The search API could not be reached in time.');}
  if(!response.ok){await response.body?.cancel();throw new SearchError(response.status===429?'The search API quota was reached. Retry later.':`The search API returned HTTP ${response.status}. Check its server configuration.`);}
  const raw=await response.text();if(raw.length>1500000)throw new SearchError('The search response was too large.');
  let data:Record<string,any>;try{data=JSON.parse(raw);}catch{throw new SearchError('The search API returned invalid JSON.');}
  const rows=provider==='brave'?data.web?.results:data.results;
  if(!Array.isArray(rows))throw new SearchError('The search API returned no verified results array.');
  const seen=new Set<string>();const links:{text:string;url:string;description:string}[]=[];
  for(const row of rows){
    let target:URL;try{target=new URL(row.url);}catch{continue;}
    if(target.protocol!=='https:'||target.username||target.password||!target.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.)/.test(target.hostname))continue;
    target.hash='';if(seen.has(target.href))continue;seen.add(target.href);
    if(typeof row.title!=='string'||!row.title.trim())continue;
    links.push({text:row.title.slice(0,200),url:target.href,description:String(row.description||row.content||'').replace(/<[^>]*>/g,'').slice(0,1000)});if(links.length===10)break;
  }
  if(rows.length&&!links.length)throw new SearchError('The search API returned no usable source links.');
  const source=new URL(url);source.searchParams.delete('format');
  return {title:`Web search: ${query}`,url:source.href,text:links.map(link=>`${link.text}\n${link.url}\n${link.description}`).join('\n\n')||'No results returned by the search provider.',links,tables:[] as any[],retrievedAt:new Date().toISOString(),previewExpiresAt:undefined,provider};
}
