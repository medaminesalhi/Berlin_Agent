import {loadEnv} from './utils.js';
loadEnv();
console.log('\nHEIDI BERLIN AGENT — DIAGNOSTIC GROQ\n');
console.log('Node.js:',process.version);
for(const name of ['@browserbasehq/stagehand','zod']){
  try{await import(name);console.log(name+': OK');}
  catch(e){console.error(name+': absent, execute npm install');}
}
console.log('GROQ_API_KEY:',process.env.GROQ_API_KEY?'presente (non verifiee)':'ABSENTE');
console.log('GROQ_MODEL:',process.env.GROQ_MODEL||'openai/gpt-oss-20b');
console.log('GROQ_MAX_CHARS:',process.env.GROQ_MAX_CHARS||'3600');
console.log('GROQ_MIN_INTERVAL_MS:',process.env.GROQ_MIN_INTERVAL_MS||'16000');
console.log('SearXNG:',process.env.SEARXNG_URL||'non configure');
console.log('HEADLESS:',process.env.HEADLESS||'true');
if(process.env.SEARXNG_URL){
  try{
    const url=new URL('/search',process.env.SEARXNG_URL);
    url.searchParams.set('q','Hausverwaltung Berlin');url.searchParams.set('format','json');
    const r=await fetch(url,{signal:AbortSignal.timeout(7000)});
    const data=await r.json();
    console.log('SearXNG API:',r.ok&&Array.isArray(data.results)?`OK (${data.results.length} resultats)`:`Erreur ${r.status}`);
  }catch(e){console.warn('SearXNG API indisponible:',e.message);}
}
console.log('\nDiagnostic de configuration uniquement (sans appel Groq).');
