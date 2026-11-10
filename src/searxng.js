/**
 * Source complementaire SearXNG: les resultats sont des CANDIDATS, jamais des faits verifies.
 * L'instance SearXNG est facultative. Sans elle --mode live utilise uniquement Overpass.
 */
import {clean,normalizeUrl,sleep,stripAccents} from './utils.js';

export const searchQueries = [
  'Hausverwaltung Berlin GmbH Kontakt',
  'WEG Verwaltung Berlin Unternehmen',
  'Mietverwaltung Berlin Hausverwaltung',
  'Hausverwaltung Berlin Pankow Charlottenburg',
  'Hausverwaltung Berlin Mitte Kreuzberg',
  'Immobilienverwaltung Berlin Wohnungsverwaltung',
  'Hausverwaltung Berlin Spandau Steglitz',
  'Berlin Hausverwaltung Immobilienmanagement Firmen'
];
const blockedDomains = [
  'google.com','bing.com','yahoo.com','duckduckgo.com','searxng.org',
  'gelbeseiten.de','dasoertliche.de','11880.com','11880.de',
  'hausverwalter-register.de','vdiv-bb.de',
  'immobilienscout24.de','immowelt.de','kleinanzeigen.de',
  'facebook.com','instagram.com','linkedin.com','xing.com','youtube.com',
  'wikipedia.org','indeed.com','stepstone.de','meinestadt.de','trustpilot.com'
];
function blocked(host) {
  const hostname=host.replace(/^www\./,'');
  return blockedDomains.some(x=>hostname===x||hostname.endsWith('.'+x));
}
export function resultToCandidate(r) {
  const website=normalizeUrl(r.url);
  if(!website)return null;
  const host=new URL(website).hostname;
  if(blocked(host))return null;
  const title=clean(r.title||'');
  const snippet=clean(r.content||r.snippet||'');
  if(!/(hausverwaltung|weg[ -]?verwaltung|mietverwaltung|immobilienverwaltung|wohnungsverwaltung|property management)/i.test(title+' '+snippet))return null;
  let name=title.split(/\s[|–—]\s|\s-\s/)[0].replace(/\s*\|.*/,'').trim();
  // Titre generique : le domaine est plus transparent qu'un nom d'entreprise invente
  if(!name||/^(hausverwaltung|weg.?verwaltung|mietverwaltung|immobilienverwaltung)(\s+berlin)?$/i.test(name)) {
    name=host.replace(/^www\./,'');
  }
  return {
    name:name.slice(0,180),website,address:null,city:'Berlin',phone:null,email:null,
    units_managed:null,management_type:null,berlin_presence:null,
    source_url:website,source_pages:[],
    evidence:`Moteur de recherche : titre « ${title.slice(0,180)} »`,
    discovery_source:'SearXNG',validation_status:'TO_VERIFY'
  };
}
export async function discoverSearxng({baseUrl=process.env.SEARXNG_URL,limit=100,fetchImpl=fetch,pages=1,queries=searchQueries,delayMs=1200,logger=console}={}) {
  if(!baseUrl)throw Error('SEARXNG_URL manquant. Utilise le mode live sans --search ou renseigne SEARXNG_URL.');
  let endpoint;
  try {
    endpoint=new URL('/search',baseUrl);
    if(!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)throw new Error();
  }catch {throw Error('SEARXNG_URL doit etre une URL http(s) valide.');}
  const out=[]; const seen=new Set();let successes=0;
  for(const q of queries){
    for(let page=1;page<=pages;page++){
      const url=new URL(endpoint);
      url.searchParams.set('q',q);url.searchParams.set('format','json');
      url.searchParams.set('language','de-DE');url.searchParams.set('pageno',String(page));
      try {
        const response=await fetchImpl(url.href,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(25000)});
        if(response.status===403)throw Error('HTTP 403 : activer JSON dans les settings SearXNG');
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const body=await response.json();
        if(!Array.isArray(body.results))throw Error('Format SearXNG inattendu : results absent');
        successes++;
        for(const result of body.results){
          const candidate=resultToCandidate(result);
          if(!candidate)continue;
          const key=stripAccents(new URL(candidate.website).hostname);
          if(seen.has(key))continue;
          seen.add(key);out.push(candidate);
          if(out.length>=limit)return out;
        }
      }catch(err){logger.warn(`Recherche web ignoree (${q}, page ${page}) : ${err.message}`);}
      if(delayMs>0)await sleep(delayMs);
    }
  }
  if(!successes)throw Error('Aucune requete SearXNG reussie. Verifie son URL, JSON et l acces reseau.');
  return out;
}
