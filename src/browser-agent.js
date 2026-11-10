/**
 * Real browser module. Unlike the earlier lightweight version, this agent
 * opens pages with Stagehand/Chromium; it uses Stagehand.observe/extract/act.
 * Groq handles compact JSON extraction; Stagehand handles live Chromium browsing.
 */
import { clean, normalizeUrl, sleep } from './utils.js';

const ALLOWED_PATHS = /kontakt|contact|impressum|ueber-uns|über-uns|about|leistungen|service|team|unternehmen|verwaltung|wohn|referenz/i;
const PAGINATION = /^(weiter|next|nächste|naechste|mehr|seite \d+|\d+)$/i;
const BAD_DOMAINS = /(^|\.)(facebook|instagram|linkedin|xing|google|bing|youtube|twitter|x|tiktok)\.(com|de|org)$/i;

function makeSchema(z){return z.object({
  company_name:z.string().nullable().optional(),
  location_berlin:z.boolean().nullable().optional(),
  management_services:z.array(z.string()).default([]),
  managed_units:z.number().int().nonnegative().nullable().optional(),
  units_quote:z.string().nullable().optional(),
  business_email:z.string().nullable().optional(),
  business_phone:z.string().nullable().optional(),
  website_role:z.enum(['official_company','directory','other','unknown']).optional()
});}


function sameHost(a,b) {
  try {return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');}
  catch{return false;}
}
function validHttpLink(raw, base) {
  try {
    const u = new URL(raw,base);
    if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash='';
    return normalizeUrl(u.href);
  } catch {return null;}
}
function chosenLinks(links,base,limit=8) {
  const result=[];const seen=new Set();
  for (const l of links||[]) {
    const dest=validHttpLink(l.href,base);
    if(!dest || !sameHost(dest,base) || seen.has(dest))continue;
    if(!ALLOWED_PATHS.test(`${l.text||''} ${new URL(dest).pathname}`))continue;
    seen.add(dest);result.push(dest);
    if(result.length>=limit)break;
  }
  return result;
}
export function extractDirectoryLinks(links, currentUrl, max=30) {
  const out=[];const seen=new Set();
  for(const link of links||[]){
    const url=validHttpLink(link.href,currentUrl);
    if(!url || sameHost(url,currentUrl))continue;
    const host=new URL(url).hostname;
    if(BAD_DOMAINS.test(host) || /(?:\.pdf|\.jpg|\.png|\.svg|\.zip|\.docx?)$/i.test(new URL(url).pathname))continue;
    if(!/hausverwaltung|immobilienverwaltung|weg|verwaltung|immobilien|hausverwalter|property|website|webseite|homepage|internetauftritt|zur website/i.test(`${link.text} ${link.href}`))continue;
    if(!seen.has(host)){seen.add(host);out.push({name:clean(link.text).slice(0,160)||host,website:url,source_url:currentUrl,discovery_source:'directory_browser',validation_status:'TO_VERIFY'});}
    if(out.length>=max)break;
  }
  return out;
}
export function detectPaginationLinks(links, baseUrl, max=2) {
  const result=[];
  for(const l of links||[]) {
    const url=validHttpLink(l.href,baseUrl);
    if(!url || !sameHost(url,baseUrl) || url===baseUrl || result.includes(url))continue;
    if(PAGINATION.test(clean(l.text)) || /[?&](?:page|p|seite)=\d+/i.test(url) || /\/(?:page|seite)\/\d+/i.test(url)) result.push(url);
    if(result.length>=max)break;
  }
  return result;
}

async function snapshot(page) {
  // Executes against a real rendered DOM, including JavaScript-rendered content.
  return page.evaluate(() => {
    const kill='script,style,noscript,svg,footer nav,header nav';
    const original=document.body;
    const clone=original?.cloneNode(true);
    clone?.querySelectorAll(kill).forEach(el=>el.remove());
    const text=(clone?.innerText || clone?.textContent || '').replace(/\s+/g,' ').trim().slice(0,24000);
    const links=[...document.querySelectorAll('a[href]')].slice(0,650).map(a=>({href:a.href,text:(a.innerText||a.textContent||'').trim().slice(0,160)}));
    const emails=[...document.querySelectorAll('a[href^="mailto:"]')].map(a=>a.getAttribute('href').replace(/^mailto:/,'').split('?')[0]);
    const phones=[...document.querySelectorAll('a[href^="tel:"]')].map(a=>a.getAttribute('href').replace(/^tel:/,''));
    const meta=document.querySelector('meta[name="description"]')?.content||'';
    return {title:document.title,text,links,emails,phones,meta,raw_url:location.href};
  });
}

export function selectBestEvidencePages(pages) {
  const joined=pages.map(p=>p.text).filter(Boolean).join('\n\n');
  const emails=[...new Set(pages.flatMap(p=>p.emails||[]).map(clean))].filter(Boolean);
  const phones=[...new Set(pages.flatMap(p=>p.phones||[]).map(clean))].filter(Boolean);
  return {page_text:joined.slice(0,32000),emails,phones,source_pages:pages.map(p=>p.url),pages};
}
export async function startBrowser({headless=process.env.HEADLESS!=='false',stagehandFactory=null}={}) {
  const Stagehand = stagehandFactory?null:(await import('@browserbasehq/stagehand')).Stagehand;
  const executablePath=process.env.CHROME_PATH?.trim();
  const options={env:'LOCAL',model:'groq/'+(process.env.GROQ_MODEL||'openai/gpt-oss-20b'),verbose:0,selfHeal:true,
    localBrowserLaunchOptions:{headless,...(executablePath?{executablePath}:{})}};
  const stagehand=stagehandFactory?await stagehandFactory(options):new Stagehand(options);
  await stagehand.init();
  let page=stagehand.context.pages()[0];
  if(!page)page=await stagehand.context.newPage();
  return {stagehand,page,close:async()=>stagehand.close()};
}
export async function navigateSnapshot(browser,url,{robots,logger=console,delayMs=900}={}) {
  const validated=normalizeUrl(url);
  if(!validated)return {status:'invalid_url',url};
  if(robots && !await robots.allowed(validated))return {status:'blocked_by_robots',url:validated};
  try {
    await browser.page.goto(validated,{waitUntil:'domcontentloaded',timeout:35000});
    await sleep(delayMs);
    const result=await snapshot(browser.page);
    return {status:'ok',url:browser.page.url()||validated,...result};
  } catch(error){ logger.warn(`Navigateur: ${validated} -> ${error.message}`);return {status:'failed',url:validated,error:error.message}; }
}
export async function browseCompany(browser,company,{robots,logger=console,maxPages=4,stagehandAI=true,delayMs=900}={}) {
  if(!company.website)return {...company,scrape_status:'NO_WEBSITE',source_pages:[]};
  const first=await navigateSnapshot(browser,company.website,{robots,logger,delayMs});
  if(first.status!=='ok')return {...company,scrape_status:first.status,source_pages:[],error:first.error||null};
  const visited=new Set([first.url]);const pages=[first];
  const queue=chosenLinks(first.links,first.url,Math.max(0,maxPages-1));
  for(const url of queue){
    if(pages.length>=maxPages)break;
    if(visited.has(url))continue;
    visited.add(url);
    const p=await navigateSnapshot(browser,url,{robots,logger,delayMs});
    if(p.status==='ok' && sameHost(p.url,first.url))pages.push(p);
  }
  const info=selectBestEvidencePages(pages);
  let agentExtraction=null;let stagehandError=null;
  // Stagehand is used for semantic extraction from the LIVE rendered page,
  // not merely a pre-downloaded HTML string.
  if(stagehandAI && process.env.GROQ_API_KEY){
    try{
      const p=pages[0];
      await browser.page.goto(p.url,{waitUntil:'domcontentloaded',timeout:30000});
      const {z}=await import('zod');
      agentExtraction=await browser.stagehand.extract('Extract only verifiable facts about this German property-management company from the CURRENT PAGE. If unknown use null. Do not invent contacts or housing units.',makeSchema(z));
    }catch(e){stagehandError=e.message;logger.warn(`Stagehand AI extract skipped: ${e.message}`);}
  }
  const email=company.email||info.emails.find(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))||null;
  const berlinMatch=info.page_text.match(/\b1[0-4]\d{3}\s+Berlin\b/i);
  const activityMatch=/Hausverwaltung|WEG[ -]?Verwaltung|Mietverwaltung|Immobilienverwaltung|Wohnungsverwaltung|Property Management/i.test(info.page_text);
  const siteQualification=activityMatch?'POTENTIAL_MANAGEMENT_SITE':'ACTIVITY_NOT_CONFIRMED';
  const candidateName=clean(company.name);
  const titleName=clean(first.title).split(/\s[|–—]\s|\s-\s/)[0];
  const suggestedName=/^(Kontakt|Contact|Impressum|Über uns|Ueber uns|Home|Startseite)$/i.test(candidateName)
    ? (!/^(Kontakt|Contact|Impressum|Home|Startseite)$/i.test(titleName) && titleName ? titleName : new URL(first.url).hostname.replace(/^www\./,''))
    : candidateName;
  return {...company,name:suggestedName,email,phone:company.phone||info.phones[0]||null,
    page_text:info.page_text,source_pages:info.source_pages,scrape_status:'OK',
    berlin_presence:company.berlin_presence===true?true:berlinMatch?true:null,
    berlin_evidence:berlinMatch?.[0]||null,site_qualification:siteQualification,
    stagehand_ai:agentExtraction,stagehand_error:stagehandError,documents_visited:pages.length};
}
export async function browseDirectory(browser,url,{robots,maxPages=2,logger=console,delayMs=900,stagehandAI=false}={}){
  const queue=[url],visited=new Set(),candidates=[];
  while(queue.length && visited.size<maxPages){
    const next=queue.shift();if(visited.has(next))continue;visited.add(next);
    const p=await navigateSnapshot(browser,next,{robots,logger,delayMs});
    if(p.status!=='ok')continue;
    candidates.push(...extractDirectoryLinks(p.links,p.url,40));
    for(const n of detectPaginationLinks(p.links,p.url,2))if(!visited.has(n))queue.push(n);
    // Complex JS pagination: AI can observe and act on Next buttons if no URL exists.
    if(!queue.length && stagehandAI && process.env.GROQ_API_KEY && visited.size<maxPages){
      try{
        const actions=await browser.stagehand.observe('Find an enabled Next page or Weiter button for more company listings, not an ad, login or cookie dialog.');
        const nextAction=actions?.find(x=>/next|weiter|nächste|pagination|seite/i.test(x.description||''));
        if(nextAction){
          await browser.stagehand.act(nextAction);
          const q=await snapshot(browser.page);
          if(q.links?.length)candidates.push(...extractDirectoryLinks(q.links,p.url,40));
        }
      }catch(e){logger.warn(`Pagination IA ignoree: ${e.message}`);}
    }
  }
  return candidates;
}
