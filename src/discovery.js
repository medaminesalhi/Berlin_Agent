import { clean, normalizeUrl } from './utils.js';
const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

export function overpassQuery() {
  return `[out:json][timeout:55];
area["wikidata"="Q64"]->.berlin;
(
 nwr["office"="property_management"](area.berlin);
 nwr["name"~"Hausverwaltung|Immobilienverwaltung|Immobilienmanagement",i](area.berlin);
);
out center tags;`;
}
export function mapOsmElement(element) {
  const tags=element.tags??{};
  const name=clean(tags.name || tags.operator);
  if (!name) return null;
  const address=clean([tags['addr:street'],tags['addr:housenumber'],tags['addr:postcode'],tags['addr:city']||'Berlin'].filter(Boolean).join(' '));
  const website=normalizeUrl(tags.website || tags['contact:website'] || '');
  return {
    name,
    website,
    address,
    city:'Berlin',
    phone:tags.phone || tags['contact:phone'] || null,
    email:tags.email || tags['contact:email'] || null,
    units_managed:null,
    management_type:null,
    berlin_presence:true,
    source_url:`https://www.openstreetmap.org/${element.type}/${element.id}`,
    source_pages:[],
    evidence:'OpenStreetMap : fiche a verifier',
    validation_status:'TO_VERIFY'
  };
}
export async function discoverBerlin({limit=30, fetchImpl=fetch, endpointsToUse=endpoints}={}) {
  let lastError;
  for (const endpoint of endpointsToUse) {
    try {
      const resp=await fetchImpl(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':process.env.SCRAPER_USER_AGENT || 'HeidiStudentResearchBot/1.0 (academic research)'},
        body:new URLSearchParams({data:overpassQuery()}),
        signal:AbortSignal.timeout(90000)
      });
      if (!resp.ok)throw Error(`HTTP ${resp.status}`);
      const json=await resp.json();
      if (!Array.isArray(json.elements))throw Error('Reponse Overpass invalide');
      const records=json.elements.map(mapOsmElement).filter(Boolean);
      return records.slice(0,limit);
    } catch(e) { lastError=e; console.warn(`⚠ Overpass indisponible (${endpoint}): ${e.message}`); }
  }
  throw Error(`Impossible de consulter OpenStreetMap: ${lastError?.message || 'erreur inconnue'}. Reessaie plus tard ou utilise --mode sites --input data/sites.csv.`);
}
