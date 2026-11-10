/** Minimal conservative robots.txt enforcement for ordinary public websites.
 * Site-specific access restrictions/TOS must also be respected by the operator.
 */
import { normalizeUrl, sleep } from './utils.js';
function testRule(path,rule){
  let p=rule.trim();if(!p)return false;
  const anchor=p.endsWith('$');if(anchor)p=p.slice(0,-1);
  const escaped=p.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');
  try{return new RegExp('^'+escaped+(anchor?'$':'')).test(path);}catch{return false;}
}
export function parseRobots(content,agent='BerlinPropertyResearch') {
  let agents=[],entries=[],groups=[],hasRules=false;
  function commit(){if(agents.length)groups.push({agents:[...agents],rules:[...entries]});agents=[];entries=[];hasRules=false;}
  for(const raw of String(content).split(/\r?\n/)){
    const s=raw.split('#')[0].trim();const match=s.match(/^([^:]+)\s*:\s*(.*)$/);if(!match)continue;
    const key=match[1].trim().toLowerCase(),value=match[2].trim();
    if(key==='user-agent'){
      if(hasRules)commit();agents.push(value.toLowerCase());
    } else if(key==='allow'||key==='disallow'){
      if(!agents.length)continue;
      hasRules=true; entries.push({kind:key,path:value});
    }
  }
  commit();
  const ua=agent.toLowerCase();
  const selection=groups.filter(g=>g.agents.some(a=>a!=='*' && ua.includes(a)));
  const applicable=selection.length?selection:groups.filter(g=>g.agents.includes('*'));
  return target=>{
    const url=new URL(target);const path=url.pathname+url.search;
    const matching=applicable.flatMap(g=>g.rules).filter(r=>r.path && testRule(path,r.path));
    if(!matching.length)return true;
    matching.sort((a,b)=>b.path.replace(/\*/g,'').length-a.path.replace(/\*/g,'').length || (a.kind==='allow'?-1:1));
    return matching[0].kind==='allow';
  };
}
export class RobotsPolicy {
  constructor({fetchImpl=fetch,agent='BerlinPropertyResearch',delayMs=900,logger=console}={}) {
    this.fetchImpl=fetchImpl;this.agent=agent;this.delayMs=delayMs;this.logger=logger;this.cache=new Map();this.lastVisit=new Map();
  }
  async allowed(rawUrl){
    const url=normalizeUrl(rawUrl);if(!url)return false;
    const origin=new URL(url).origin;
    if(!this.cache.has(origin)){
      this.cache.set(origin,(async()=>{
        try{
          const r=await this.fetchImpl(origin+'/robots.txt',{headers:{'User-Agent':this.agent},signal:AbortSignal.timeout(12000)});
          if(r.status===401||r.status===403)return ()=>false;
          if(r.status===404)return ()=>true;
          if(!r.ok) {this.logger.warn(`robots.txt non disponible (${origin}, ${r.status}): site ignore`);return ()=>false;}
          const body=await r.text();return parseRobots(body,this.agent);
        }catch(e){this.logger.warn(`robots.txt erreur (${origin}): ${e.message}. Site ignore.`);return ()=>false;}
      })());
    }
    const predicate=await this.cache.get(origin);
    const permitted=predicate(url);
    if(!permitted)this.logger.warn(`robots.txt interdit : ${url}`);
    if(permitted && this.delayMs>0){
      const remaining=this.delayMs-(Date.now()-(this.lastVisit.get(origin)||0));
      if(remaining>0)await sleep(remaining);
      this.lastVisit.set(origin,Date.now());
    }
    return permitted;
  }
}
