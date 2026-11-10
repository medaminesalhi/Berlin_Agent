import { loadEnv } from './utils.js';
loadEnv();
console.log('\nHEIDI RESEARCH AGENT - Diagnostic environnement\n');
console.log('Node.js:',process.version,Number(process.versions.node.split('.')[0])>=20?'OK':'Node 20+ requis');
for(const m of ['@browserbasehq/stagehand','zod']){
  try {await import(m);console.log(m,': installe');}
  catch {console.log(m,': manquant -> npm install');}
}
console.log('Groq:',process.env.GROQ_API_KEY?'cle presente (non verifiee)':'cle manquante -> .env');
console.log('SearXNG:',process.env.SEARXNG_URL||'(non configure)');
console.log('Chrome:',process.env.CHROME_PATH||'decouverte automatique Stagehand');
if(process.env.SEARXNG_URL){
  try {const u=new URL('/search',process.env.SEARXNG_URL);u.searchParams.set('q','Hausverwaltung Berlin');u.searchParams.set('format','json');
    const r=await fetch(u,{signal:AbortSignal.timeout(5500)}); const j=await r.json();
    console.log('SearXNG API:',r.ok&&Array.isArray(j.results)?`OK (${j.results.length} resultats)`:`erreur HTTP ${r.status}`);
  }catch(e){console.log('SearXNG API: indisponible',e.message);}
}
console.log('\nLancez npm run berlin:small pour une premiere collecte reelle.\n');
